import { NextRequest, NextResponse } from 'next/server';
import { Prisma, DelegationStatus } from '@prisma/client';
import { createPublicClient, http, parseEventLogs, parseEther } from 'viem';
import { getNetworkConfig } from '@/config/chains';
import { capitalVaultAbi } from '@/config/contracts';
import { getRpcUrl } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { setAgentWalletOnVault, releaseFundsToAgentOnChain } from '@/lib/vault-operator';

// GET /api/delegations - Get delegations for a user or agent
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get('userAddress');
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: Prisma.DelegationWhereInput = {};
    
    if (userAddress) {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() },
      });
      if (user) {
        where.userId = user.id;
      } else {
        return NextResponse.json({
          success: true,
          data: {
            delegations: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
            stats: { totalDelegated: 0, activeDelegations: 0 },
          },
        });
      }
    }
    
    if (agentId) {
      where.agentId = agentId;
    }
    
    if (status && status !== 'all') {
      where.status = status.toUpperCase() as DelegationStatus;
    }

    const [delegations, total] = await Promise.all([
      prisma.delegation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { address: true },
          },
          agent: {
            select: {
              id: true,
              name: true,
              strategy: true,
              trustScore: true,
              totalPnl: true,
            },
          },
        },
      }),
      prisma.delegation.count({ where }),
    ]);

    // Calculate stats
    const stats = await prisma.delegation.aggregate({
      where: { ...where, status: 'ACTIVE' },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        delegations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalDelegated: stats._sum.amount || 0,
          activeDelegations: stats._count,
          maxDelegations: 5,
          slotsAvailable: Math.max(0, 5 - stats._count),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch delegations' },
      { status: 500 }
    );
  }
}

// POST /api/delegations - Create a new delegation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, agentId, amount, txHash } = body;

    // Validate required fields
    if (!userAddress || !agentId || amount === undefined || !txHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userAddress, agentId, amount, txHash' },
        { status: 400 }
      );
    }

    // Enforce minimum delegation of 1,000 MON
    if (parseFloat(String(amount)) < 1000) {
      return NextResponse.json(
        { success: false, error: 'Minimum delegation is 1,000 MON' },
        { status: 400 }
      );
    }

    // Verify agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Agent is not active' },
        { status: 400 }
      );
    }

    // Enforce maximum 5 active delegators per agent
    const activeDelegationCount = await prisma.delegation.count({
      where: { agentId, status: 'ACTIVE' },
    });
    if (activeDelegationCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 active delegators per agent reached. Wait for a slot to open.' },
        { status: 400 }
      );
    }

    // Verify txHash is a confirmed on-chain transaction
    try {
      const { chain } = getNetworkConfig();
      const publicClient = createPublicClient({ chain, transport: http(getRpcUrl()) });
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      if (!receipt || receipt.status === 'reverted') {
        return NextResponse.json(
          { success: false, error: 'Transaction not confirmed or reverted on-chain' },
          { status: 400 }
        );
      }

      // Extract on-chain delegation ID from CapitalDelegated event
      var onChainDelegationId: bigint | null = null;
      try {
        const logs = parseEventLogs({
          abi: capitalVaultAbi,
          eventName: 'CapitalDelegated',
          logs: receipt.logs,
        });
        if (logs.length > 0) {
          onChainDelegationId = logs[0].args.delegationId;
        }
      } catch {
        console.warn('Could not parse CapitalDelegated event from tx receipt');
      }
    } catch (txError) {
      console.warn('txHash verification failed:', txError instanceof Error ? txError.message : txError);
      return NextResponse.json(
        { success: false, error: 'Could not verify transaction on-chain. Ensure txHash is valid and confirmed.' },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: userAddress.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { address: userAddress.toLowerCase() },
      });
    }

    // Create new delegation
    const delegation = await prisma.delegation.create({
      data: {
        userId: user.id,
        agentId,
        amount,
        txHash,
        status: 'ACTIVE',
        onChainDelegationId: onChainDelegationId ? Number(onChainDelegationId) : null,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    // Update agent's total capital
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        totalCapital: { increment: amount },
      },
    });

    // ── Capital Flow: Release funds to agent wallet (non-blocking) ──
    // After delegation is confirmed, operator releases capital from vault → agent wallet
    if (agent.erc8004AgentId && agent.walletAddr && onChainDelegationId) {
      const onChainAgentId = BigInt(agent.erc8004AgentId.toString());
      const amountWei = parseEther(String(amount));

      // Set agent wallet on vault if not already set (idempotent)
      setAgentWalletOnVault(onChainAgentId, agent.walletAddr as `0x${string}`)
        .then(() => {
          console.log(`Vault: setAgentWallet(${onChainAgentId}, ${agent.walletAddr}) OK`);
          // Then release funds to agent wallet for trading
          return releaseFundsToAgentOnChain(onChainAgentId, amountWei);
        })
        .then((txHash) => {
          console.log(`Vault: releaseFundsToAgent(${onChainAgentId}, ${amount} MON) tx=${txHash}`);
        })
        .catch((err) => {
          console.warn('Capital release failed (non-blocking):', err instanceof Error ? err.message : err);
        });
    }

    return NextResponse.json({
      success: true,
      data: delegation,
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delegation' },
      { status: 500 }
    );
  }
}

// DELETE /api/delegations - Revoke a delegation
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { delegationId, userAddress } = body;

    if (!delegationId || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: delegationId, userAddress' },
        { status: 400 }
      );
    }

    // Find delegation
    const delegation = await prisma.delegation.findUnique({
      where: { id: delegationId },
      include: {
        user: true,
        agent: true,
      },
    });

    if (!delegation) {
      return NextResponse.json(
        { success: false, error: 'Delegation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (delegation.user.address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to revoke this delegation' },
        { status: 403 }
      );
    }

    // Revoke delegation
    await prisma.delegation.update({
      where: { id: delegationId },
      data: { status: 'WITHDRAWN' },
    });

    // Update agent's total capital
    await prisma.agent.update({
      where: { id: delegation.agentId },
      data: {
        totalCapital: { decrement: delegation.amount },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        action: 'withdrawn',
        withdrawnAmount: delegation.amount,
        accumulatedPnl: delegation.accumulatedPnl,
      },
    });
  } catch (error) {
    console.error('Error revoking delegation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke delegation' },
      { status: 500 }
    );
  }
}
