import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatEther, type Address } from 'viem';
import { monadTestnet, monadMainnet } from '@/config/chains';
import { createTimeoutPublicClient, safeRpcCall } from '@/lib/rpc-client';
import { getRpcUrl, getCurrentNetwork, RPC_TIMEOUT } from '@/lib/config';
import { getMonUsdPrice } from '@/lib/pnl-tracker';

// Create public client with timeout protection
const network = getCurrentNetwork();
const chain = network === 'mainnet' ? monadMainnet : monadTestnet;
const publicClient = createTimeoutPublicClient(chain, getRpcUrl(network), RPC_TIMEOUT);

// GET /api/portfolio - Get user portfolio
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const period = searchParams.get('period') || '30d';

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: address' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        agents: {
          select: {
            id: true,
            name: true,
            strategy: true,
            status: true,
            trustScore: true,
            totalPnl: true,
          },
        },
        delegations: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                strategy: true,
              },
            },
          },
        },
      },
    });

    // Get token holdings separately (not a direct relation on User)
    const tokenHoldings = await prisma.tokenHolding.findMany({
      where: { walletAddr: address.toLowerCase() },
    });

    // Get native balance from chain with timeout protection
    let nativeBalance = '0';
    const balanceResult = await safeRpcCall(
      () => publicClient.getBalance({ address: address as Address }),
      RPC_TIMEOUT,
      'getBalance'
    );

    if (balanceResult.success) {
      nativeBalance = formatEther(balanceResult.data);
    } else {
      console.error('Failed to fetch native balance:', balanceResult.error);
    }

    // Get live MON price (from CoinGecko with cache, ENV fallback)
    let monPrice = 0;
    try {
      monPrice = await getMonUsdPrice();
    } catch {
      console.warn('MON price unavailable for portfolio calculation');
    }

    // If user doesn't exist in DB, return minimal data
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          address,
          nativeBalance,
          tokenHoldings,
          agents: [],
          delegations: [],
          totalValue: parseFloat(nativeBalance) * monPrice,
          stats: {
            totalPnl: 0,
            totalPnlPercent: 0,
            totalTrades: 0,
            winRate: 0,
          },
          pnlHistory: [],
          transactions: [],
        },
      });
    }

    // Calculate portfolio stats
    // Note: totalTokenBalance is raw balance sum (not USD). Token USD values are calculated client-side.
    const totalTokenBalance = tokenHoldings.reduce((sum, holding) => {
      return sum + parseFloat(holding.balance?.toString() || '0');
    }, 0);

    const totalAgentPnl = user.agents.reduce((sum, agent) => {
      return sum + parseFloat(agent.totalPnl?.toString() || '0');
    }, 0);

    const totalDelegatedValue = user.delegations.reduce((sum, delegation) => {
      return sum + parseFloat(delegation.amount.toString());
    }, 0);

    // Determine date range from period param
    const now = new Date();
    let executionSince: Date | undefined;
    switch (period) {
      case '1d':
      case '24h':
        executionSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        executionSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        executionSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        executionSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      // 'all' -> no date filter
    }

    // Fetch executions for PnL history (from user's agents)
    const agentIds = user.agents.map(a => a.id);
    const executions = agentIds.length > 0 ? await prisma.execution.findMany({
      where: {
        agentId: { in: agentIds },
        status: 'SUCCESS',
        pnl: { not: null },
        ...(executionSince && { executedAt: { gte: executionSince } }),
      },
      orderBy: { executedAt: 'asc' },
    }) : [];

    // Build PnL history from executions (group by actual date)
    const pnlByDate: Record<string, { pnl: number; label: string }> = {};
    executions.forEach(exec => {
      const dateKey = new Date(exec.executedAt).toISOString().split('T')[0]; // "2026-02-12"
      const label = new Date(exec.executedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); // "Feb 12"
      const pnl = parseFloat(exec.pnl?.toString() || '0');
      if (!pnlByDate[dateKey]) {
        pnlByDate[dateKey] = { pnl: 0, label };
      }
      pnlByDate[dateKey].pnl += pnl;
    });

    let cumulative = 0;
    const pnlHistory = Object.entries(pnlByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { pnl, label }]) => {
        cumulative += pnl;
        return { date, label, pnl, cumulative };
      });

    // Map executions to transactions format (latest 10)
    const transactions = executions.slice(-10).reverse().map(exec => {
      const jsonParams = exec.params as Record<string, string> | null;
      return {
        id: exec.id,
        type: exec.type.toLowerCase(),
        token: jsonParams?.tokenAddress || 'MON',
        amount: jsonParams?.amount || '0',
        pnl: parseFloat(exec.pnl?.toString() || '0'),
        value: Math.abs(parseFloat(exec.pnl?.toString() || '0')) * monPrice,
        txHash: exec.txHash || '',
        timestamp: exec.executedAt.toISOString(),
        status: exec.status.toLowerCase(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        address: user.address,
        nativeBalance,
        tokenHoldings,
        agents: user.agents,
        delegations: user.delegations,
        totalValue: parseFloat(nativeBalance) * monPrice + totalDelegatedValue,
        stats: {
          totalPnl: totalAgentPnl,
          totalPnlPercent: totalDelegatedValue > 0 ? (totalAgentPnl / totalDelegatedValue) * 100 : 0,
          totalAgents: user.agents.length,
          activeDelegations: user.delegations.filter(d => d.status === 'ACTIVE').length,
        },
        pnlHistory,
        transactions,
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

// POST /api/portfolio/sync - Sync user token holdings from chain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, holdings } = body;

    if (!address || !Array.isArray(holdings)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: address, holdings' },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { address: address.toLowerCase() },
      });
    }

    // Delete existing holdings and recreate
    await prisma.tokenHolding.deleteMany({
      where: { walletAddr: address.toLowerCase() },
    });

    // Create new holdings
    const newHoldings = await prisma.tokenHolding.createMany({
      data: holdings.map((h: { tokenAddress: string; balance: string; price?: number; value?: number }) => ({
        walletAddr: address.toLowerCase(),
        tokenAddr: h.tokenAddress.toLowerCase(),
        balance: h.balance,
        avgBuyPrice: h.price || null,
        totalCost: h.value || null,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        synced: newHoldings.count,
        userId: user.id,
      },
    });
  } catch (error) {
    console.error('Error syncing portfolio:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync portfolio' },
      { status: 500 }
    );
  }
}
