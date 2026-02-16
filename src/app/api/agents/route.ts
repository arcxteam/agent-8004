import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Strategy, AgentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateNextWalletIndex, deriveWalletAddress, isHDWalletConfigured, getAgentWallet as getAgentWalletHD } from '@/lib/agent-wallet';
import { getMonUsdPrice } from '@/lib/pnl-tracker';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig } from '@/config/chains';
import { getRpcUrl } from '@/lib/config';
import { generateWalletConsentSignature } from '@/lib/erc8004';

// Registration fee: 100 MON (must match vault feeConfig.registrationFee on-chain)
const REGISTRATION_FEE_MON = 100;

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const strategy = searchParams.get('strategy');
    const status = searchParams.get('status');
    const owner = searchParams.get('owner'); // Filter by owner wallet address
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Prisma.AgentWhereInput = {};
    if (strategy && strategy !== 'all') {
      where.strategy = strategy.toUpperCase() as Strategy;
    }
    if (status && status !== 'all') {
      where.status = status.toUpperCase() as AgentStatus;
    }
    // Filter by owner wallet address
    if (owner) {
      where.user = {
        address: owner.toLowerCase(),
      };
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { trustScore: 'desc' },
        include: {
          user: {
            select: {
              address: true,
            },
          },
          _count: {
            select: {
              executions: true,
              delegations: true,
              validations: true,
            },
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    // ── Real-time Balance Reconciliation ──
    // Sync on-chain balance to DB for agents with wallets
    try {
      const { network } = getNetworkConfig();
      const rpcUrl = getRpcUrl(network);
      const chain = network === 'mainnet'
        ? (await import('@/config/chains')).monadMainnet
        : (await import('@/config/chains')).monadTestnet;
      const publicClient = createTimeoutPublicClient(chain, rpcUrl, 8000);

      const agentsWithWallets = agents.filter(a => a.walletAddr);
      const balancePromises = agentsWithWallets.map(async (a) => {
        try {
          const bal = await publicClient.getBalance({ address: a.walletAddr as `0x${string}` });
          return { id: a.id, balance: Number(bal) / 1e18, dbCapital: parseFloat(a.totalCapital?.toString() || '0') };
        } catch {
          return null;
        }
      });

      const balances = await Promise.all(balancePromises);
      for (const b of balances) {
        if (b && Math.abs(b.balance - b.dbCapital) > 0.1) {
          await prisma.agent.update({
            where: { id: b.id },
            data: { totalCapital: b.balance },
          }).catch(() => {});
          // Update local agent object for response
          const agent = agents.find(a => a.id === b.id);
          if (agent) {
            (agent as Record<string, unknown>).totalCapital = b.balance;
          }
        }
      }
    } catch {
      // Non-blocking
    }

    // Fetch live MON→USD price for TVL conversion
    let monPrice = 0;
    try {
      monPrice = await getMonUsdPrice();
    } catch {
      // Non-blocking
    }

    // Batch query active delegation stats per agent
    const agentIds = agents.map(a => a.id);
    const delegationStats = await prisma.delegation.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, status: 'ACTIVE' },
      _count: true,
      _sum: { amount: true },
    });
    const delegationStatsMap = new Map(
      delegationStats.map(d => [d.agentId, { count: d._count, total: d._sum.amount }])
    );

    // Add USD-converted fields to each agent
    // Fix BigInt serialization: erc8004AgentId is BigInt in Prisma but JSON.stringify can't handle it
    const agentsWithUsd = agents.map(agent => ({
      ...agent,
      erc8004AgentId: agent.erc8004AgentId ? Number(agent.erc8004AgentId) : null,
      totalCapitalUsd: parseFloat(agent.totalCapital?.toString() || '0') * monPrice,
      totalPnlUsd: parseFloat(agent.totalPnl?.toString() || '0') * monPrice,
      activeDelegations: delegationStatsMap.get(agent.id)?.count ?? 0,
      totalDelegated: parseFloat(delegationStatsMap.get(agent.id)?.total?.toString() || '0'),
    }));

    return NextResponse.json({
      success: true,
      data: agentsWithUsd,
      monPrice,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      strategy,
      description,
      maxDrawdown,
      initialCapital,
      userAddress,
      onChainId,
      riskParams,
      // ERC-8004 fields
      erc8004AgentId,
      erc8004TxHash,
      metadataUri,
      imageUrl,
      handle,
      trustModels,
      a2aEndpoint,
      capabilities,
      // Registration fee tx hash (user pays 100 MON to AnoaCapitalVault on-chain)
      registrationFeeTxHash,
    } = body;

    // Validate required fields
    if (!name || !strategy || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, strategy, userAddress' },
        { status: 400 }
      );
    }

    // Registration fee is optional when Capital Vault is not yet deployed.
    // When vault IS deployed, the frontend pays via payRegistrationFee() and sends the tx hash.
    // When vault is NOT deployed, the frontend sends the ERC-8004 registration tx hash.
    // Either way, we record whatever hash is provided.

    // Check if agent with same onChainId already exists
    if (onChainId) {
      const existingAgent = await prisma.agent.findUnique({
        where: { onChainId },
      });

      if (existingAgent) {
        return NextResponse.json(
          { success: false, error: 'Agent with this onChainId already exists' },
          { status: 409 }
        );
      }
    }

    // Check if agent with same erc8004AgentId already exists
    if (erc8004AgentId) {
      const existingByErc8004 = await prisma.agent.findUnique({
        where: { erc8004AgentId: BigInt(erc8004AgentId) },
      });

      if (existingByErc8004) {
        return NextResponse.json(
          { success: false, error: 'Agent with this ERC-8004 ID already exists' },
          { status: 409 }
        );
      }
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

    // Derive HD wallet for this agent (server-side, deterministic)
    let agentWalletAddr: string | undefined;
    let walletIndex: number | undefined;

    if (isHDWalletConfigured()) {
      walletIndex = await generateNextWalletIndex();
      agentWalletAddr = deriveWalletAddress(walletIndex);
    }

    // Auto-generate A2A endpoint if not provided
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anoa.app';
    const autoA2aEndpoint = a2aEndpoint || `${appUrl}/api/a2a`;

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        name,
        strategy: strategy.toUpperCase(),
        description,
        walletAddr: agentWalletAddr || null,
        walletIndex: walletIndex ?? null,
        maxDrawdown: maxDrawdown || 10,
        totalCapital: initialCapital || 0,
        userId: user.id,
        status: 'ACTIVE',
        trustScore: 50, // Initial trust score
        totalPnl: 0,
        totalTrades: 0,
        winRate: 0,
        onChainId,
        riskParams: riskParams || {},
        // ERC-8004 fields
        erc8004AgentId: erc8004AgentId ? BigInt(erc8004AgentId) : null,
        erc8004TxHash: erc8004TxHash || null,
        metadataUri: metadataUri || null,
        imageUrl: imageUrl || null,
        handle: handle?.toLowerCase() || null,
        trustModels: trustModels || ['reputation'],
        a2aEndpoint: autoA2aEndpoint,
        capabilities: capabilities || 0,
        isActive: true,
      },
      include: {
        user: {
          select: { address: true },
        },
      },
    });

    // Record registration fee payment in Prisma (if fee hash provided)
    // Fee goes to AnoaCapitalVault on-chain -> accumulatedFees -> admin withdrawFees()
    if (registrationFeeTxHash) {
      await prisma.feePayment.create({
        data: {
          agentId: agent.id,
          userId: user.id,
          feeType: 'REGISTRATION',
          amount: REGISTRATION_FEE_MON,
          txHash: registrationFeeTxHash,
          chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '143'),
        },
      });
    }

    // Generate setAgentWallet consent signature (for on-chain wallet linking)
    // This allows the frontend to call setAgentWallet on Identity Registry
    let walletConsent: { signature: string; deadline: string; agentWallet: string } | null = null;
    if (erc8004AgentId && walletIndex != null && isHDWalletConfigured()) {
      try {
        const { chain } = getNetworkConfig();
        const agentWalletData = getAgentWalletHD(walletIndex);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes (contract rejects > ~5 min)
        const signature = await generateWalletConsentSignature(
          agentWalletData.account,
          BigInt(erc8004AgentId),
          deadline,
          chain.id,
        );
        walletConsent = {
          signature,
          deadline: deadline.toString(),
          agentWallet: agentWalletData.account.address,
        };
      } catch (consentErr) {
        console.warn('Failed to generate wallet consent signature (non-critical):', consentErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...agent,
        erc8004AgentId: agent.erc8004AgentId ? Number(agent.erc8004AgentId) : null,
      },
      agentWallet: agentWalletAddr || null,
      walletConsent,
      registrationFee: {
        amount: `${REGISTRATION_FEE_MON} MON`,
        txHash: registrationFeeTxHash,
        destination: 'AnoaCapitalVault (accumulatedFees)',
      },
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
