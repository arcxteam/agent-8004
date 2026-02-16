import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Strategy } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getMonUsdPrice } from '@/lib/pnl-tracker';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig } from '@/config/chains';
import { getRpcUrl } from '@/lib/config';

// GET /api/leaderboard - Get agent leaderboard
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'trustScore';
    const strategy = searchParams.get('strategy');
    const search = searchParams.get('search');
    const period = searchParams.get('period') || 'all'; // all, 30d, 7d, 24h
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause
    const where: Prisma.AgentWhereInput = {
      status: 'ACTIVE',
    };

    if (strategy && strategy !== 'all') {
      where.strategy = strategy.toUpperCase() as Strategy;
    }

    // Search filter — name, wallet address, or owner address
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { walletAddr: { contains: search.trim(), mode: 'insensitive' } },
        { user: { address: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    // Apply period-based filter on agent creation or last trade time
    if (period !== 'all') {
      const now = new Date();
      let since: Date;
      switch (period) {
        case '24h':
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          since = new Date(0);
      }
      // Filter agents that have executions within the period
      where.executions = {
        some: {
          executedAt: { gte: since },
        },
      };
    }

    // Build orderBy based on sortBy param
    let orderBy: Prisma.AgentOrderByWithRelationInput;
    switch (sortBy) {
      case 'pnl':
        orderBy = { totalPnl: 'desc' };
        break;
      case 'tvl':
        orderBy = { totalCapital: 'desc' };
        break;
      case 'winrate':
        orderBy = { winRate: 'desc' };
        break;
      case 'sharpe':
        orderBy = { sharpeRatio: 'desc' };
        break;
      case 'drawdown':
        orderBy = { maxDrawdown: 'asc' };
        break;
      case 'trustScore':
      default:
        orderBy = { trustScore: 'desc' };
    }

    // Fetch agents with aggregated stats
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          user: {
            select: { address: true },
          },
          _count: {
            select: {
              executions: true,
              delegations: true,
              validations: true,
              feedbacks: true,
            },
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    // ── Real-time Balance Reconciliation ──
    // Query on-chain balance for all active agents with wallets and sync DB
    // This ensures TVL is always accurate, even after direct transfers
    try {
      const { network } = getNetworkConfig();
      const rpcUrl = getRpcUrl(network);
      const chain = network === 'mainnet'
        ? (await import('@/config/chains')).monadMainnet
        : (await import('@/config/chains')).monadTestnet;
      const publicClient = createTimeoutPublicClient(chain, rpcUrl, 8000);

      // Get all active agents with wallets for balance reconciliation
      const allActiveAgents = await prisma.agent.findMany({
        where: { status: 'ACTIVE', walletAddr: { not: null } },
        select: { id: true, walletAddr: true, totalCapital: true },
      });

      // Batch query on-chain balances (parallel, with timeout)
      const balancePromises = allActiveAgents.map(async (a) => {
        try {
          const bal = await publicClient.getBalance({ address: a.walletAddr as `0x${string}` });
          return { id: a.id, balance: Number(bal) / 1e18, dbCapital: parseFloat(a.totalCapital?.toString() || '0') };
        } catch {
          return null;
        }
      });

      const balances = await Promise.all(balancePromises);

      // Update agents where drift > 0.1 MON
      for (const b of balances) {
        if (b && Math.abs(b.balance - b.dbCapital) > 0.1) {
          await prisma.agent.update({
            where: { id: b.id },
            data: { totalCapital: b.balance },
          }).catch(() => { /* non-blocking */ });
        }
      }
    } catch {
      // Non-blocking: if RPC fails, use existing DB values
    }

    const globalStats = await prisma.agent.aggregate({
      where: { status: 'ACTIVE' },
      _count: true,
      _sum: {
        totalPnl: true,
        totalCapital: true,
        totalTrades: true,
      },
      _avg: {
        trustScore: true,
        winRate: true,
      },
    });

    // Convert MON-denominated values to USD using live CoinGecko price
    let monPrice = 0;
    try {
      monPrice = await getMonUsdPrice();
    } catch {
      // Non-blocking: if price fetch fails, show 0 rather than raw MON
    }

    const totalCapitalMon = parseFloat(globalStats._sum.totalCapital?.toString() || '0');
    const totalPnlMon = parseFloat(globalStats._sum.totalPnl?.toString() || '0');

    // Calculate rankings
    const rankedAgents = agents.map((agent, index) => ({
      rank: (page - 1) * limit + index + 1,
      ...agent,
      // BigInt fields must be serialized to string/number for JSON
      erc8004AgentId: agent.erc8004AgentId ? Number(agent.erc8004AgentId) : null,
      // Convert agent capital/PnL to USD
      totalCapitalUsd: parseFloat(agent.totalCapital?.toString() || '0') * monPrice,
      totalPnlUsd: parseFloat(agent.totalPnl?.toString() || '0') * monPrice,
      // Add computed fields for display
      pnlPercent: parseFloat(agent.totalCapital?.toString() || '0') > 0
        ? (parseFloat(agent.totalPnl?.toString() || '0') / parseFloat(agent.totalCapital?.toString() || '1')) * 100
        : 0,
      verified: agent.trustScore >= 90,
      trending: parseFloat(agent.totalPnl?.toString() || '0') > 0
        ? 'up'
        : parseFloat(agent.totalPnl?.toString() || '0') < 0
          ? 'down'
          : 'stable',
      // Delegation slots (max 5 per agent) — use total count as approximation
      activeDelegations: agent._count?.delegations ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        agents: rankedAgents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        globalStats: {
          totalAgents: globalStats._count,
          totalTvl: totalCapitalMon * monPrice,
          totalTvlMon: totalCapitalMon,
          totalPnl: totalPnlMon * monPrice,
          totalPnlMon: totalPnlMon,
          totalTrades: globalStats._sum.totalTrades || 0,
          avgTrustScore: globalStats._avg.trustScore || 0,
          avgWinRate: globalStats._avg.winRate || 0,
          monPrice,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

// GET /api/leaderboard/top - Get top 3 agents for podium display
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sortBy = 'trustScore', strategy } = body;

    const where: Prisma.AgentWhereInput = {
      status: 'ACTIVE',
    };

    if (strategy && strategy !== 'all') {
      where.strategy = strategy.toUpperCase() as Strategy;
    }

    let orderBy: Prisma.AgentOrderByWithRelationInput;
    switch (sortBy) {
      case 'pnl':
        orderBy = { totalPnl: 'desc' };
        break;
      case 'tvl':
        orderBy = { totalCapital: 'desc' };
        break;
      case 'trustScore':
      default:
        orderBy = { trustScore: 'desc' };
    }

    const topAgents = await prisma.agent.findMany({
      where,
      take: 3,
      orderBy,
      include: {
        user: {
          select: { address: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: topAgents.map((agent, index) => ({
        rank: index + 1,
        ...agent,
      })),
    });
  } catch (error) {
    console.error('Error fetching top agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch top agents' },
      { status: 500 }
    );
  }
}
