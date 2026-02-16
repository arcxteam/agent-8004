/**
 * Database Seed Script
 *
 * Seeds the database with demo data for hackathon demonstration:
 * - 1 demo user
 * - 5 trading agents (MOMENTUM, YIELD, ARBITRAGE, DCA, GRID)
 * - 40 execution records with realistic PnL
 * - 15 feedback records
 * - 8 validation records
 * - Computed stats per agent (Sharpe, drawdown, win rate)
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Demo user wallet
const DEMO_USER_ADDRESS = '0xdEaD000000000000000000000000000000008004';
const DEMO_AGENT_WALLET = '0xAn0A000000000000000000000000000000000001';

// Randomization helpers
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

interface AgentSeed {
  name: string;
  description: string;
  strategy: 'MOMENTUM' | 'YIELD' | 'ARBITRAGE' | 'DCA' | 'GRID';
  handle: string;
  winBias: number; // probability of positive PnL
  avgPnl: number; // average PnL in USD
  pnlStdDev: number; // standard deviation
}

const AGENT_SEEDS: AgentSeed[] = [
  {
    name: 'ANOA Momentum Alpha',
    description: 'Trend-following agent that identifies momentum breakouts on nad.fun memecoins. Uses EMA crossover and volume surge detection.',
    strategy: 'MOMENTUM',
    handle: 'momentum-alpha',
    winBias: 0.62,
    avgPnl: 0.15,
    pnlStdDev: 0.8,
  },
  {
    name: 'ANOA Yield Optimizer',
    description: 'Optimizes yield across aprMON (aPriori) and earnAUSD (Upshift) protocols. Auto-compounds and rebalances positions.',
    strategy: 'YIELD',
    handle: 'yield-optimizer',
    winBias: 0.75,
    avgPnl: 0.05,
    pnlStdDev: 0.2,
  },
  {
    name: 'ANOA Arb Scanner',
    description: 'Cross-market arbitrage between nad.fun bonding curves and graduated DEX pools. Sub-second execution on Monad.',
    strategy: 'ARBITRAGE',
    handle: 'arb-scanner',
    winBias: 0.85,
    avgPnl: 0.02,
    pnlStdDev: 0.05,
  },
  {
    name: 'ANOA DCA Bot',
    description: 'Dollar-cost averaging into selected tokens. Low-risk steady accumulation strategy with configurable intervals.',
    strategy: 'DCA',
    handle: 'dca-bot',
    winBias: 0.55,
    avgPnl: 0.08,
    pnlStdDev: 0.4,
  },
  {
    name: 'ANOA Grid Trader',
    description: 'Range-bound grid trading strategy for volatile memecoins. Places buy/sell orders at preset intervals.',
    strategy: 'GRID',
    handle: 'grid-trader',
    winBias: 0.68,
    avgPnl: 0.10,
    pnlStdDev: 0.6,
  },
];

function generatePnl(seed: AgentSeed): number {
  const isWin = Math.random() < seed.winBias;
  const base = isWin
    ? Math.abs(seed.avgPnl + (Math.random() - 0.3) * seed.pnlStdDev)
    : -(Math.abs(seed.avgPnl * 0.5 + Math.random() * seed.pnlStdDev * 0.8));
  return Number(base.toFixed(6));
}

function calculateSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0;
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / (pnls.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return mean > 0 ? 3.0 : 0;
  const daily = mean / stdDev;
  return Math.max(-5, Math.min(5, Number((daily * Math.sqrt(250)).toFixed(4))));
}

function calculateMaxDrawdown(pnls: number[]): number {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const p of pnls) {
    cumulative += p;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;
  }
  return Number(maxDd.toFixed(6));
}

async function main() {
  console.log('Seeding database...\n');

  // Clean existing demo data
  console.log('Cleaning old demo data...');
  await prisma.tradeProposal.deleteMany({ where: { agent: { user: { address: DEMO_USER_ADDRESS } } } });
  await prisma.feedback.deleteMany({ where: { agent: { user: { address: DEMO_USER_ADDRESS } } } });
  await prisma.validation.deleteMany({ where: { agent: { user: { address: DEMO_USER_ADDRESS } } } });
  await prisma.execution.deleteMany({ where: { agent: { user: { address: DEMO_USER_ADDRESS } } } });
  await prisma.agent.deleteMany({ where: { user: { address: DEMO_USER_ADDRESS } } });
  await prisma.user.deleteMany({ where: { address: DEMO_USER_ADDRESS } });

  // 1. Create demo user
  console.log('Creating demo user...');
  const user = await prisma.user.create({
    data: {
      address: DEMO_USER_ADDRESS,
      ensName: 'anoa-demo.eth',
    },
  });

  // 2. Create agents
  console.log('Creating 5 demo agents...');
  const agents: { id: string; seed: AgentSeed }[] = [];

  for (const seed of AGENT_SEEDS) {
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: seed.name,
        description: seed.description,
        strategy: seed.strategy,
        status: 'ACTIVE',
        handle: seed.handle,
        walletAddr: DEMO_AGENT_WALLET,
        isActive: true,
        x402Enabled: true,
        trustModels: ['reputation', 'crypto-economic'],
        capabilities: 7, // trading + yield + risk
        a2aEndpoint: '/api/a2a',
        mcpEndpoint: '/api/mcp',
        trustScore: randInt(60, 95),
        totalCapital: randInt(10, 100),
        riskParams: {
          maxPositionSize: '10',
          stopLoss: '5',
          takeProfit: '15',
          maxSlippage: '100',
        },
      },
    });

    agents.push({ id: agent.id, seed });
    console.log(`  Created: ${seed.name} (${agent.id})`);
  }

  // 3. Create executions
  console.log('\nCreating execution records...');
  let totalExecs = 0;

  for (const { id: agentId, seed } of agents) {
    const numExecs = randInt(6, 12);
    const pnls: number[] = [];

    for (let i = 0; i < numExecs; i++) {
      const pnl = generatePnl(seed);
      pnls.push(pnl);
      const action = Math.random() > 0.4 ? 'BUY' : 'SELL';
      const execDate = daysAgo(randInt(1, 30));
      const amountIn = rand(0.5, 10).toFixed(4);
      const amountOut = (Number(amountIn) * (1 + pnl)).toFixed(4);
      const fakeTxHash = `0x${Buffer.from(`seed-${agentId}-${i}-${Date.now()}`).toString('hex').slice(0, 64)}`;

      await prisma.execution.create({
        data: {
          agentId,
          type: action as 'BUY' | 'SELL',
          params: {
            tokenAddress: `0x${randInt(1000, 9999).toString(16).padStart(40, '0')}`,
            amount: amountIn,
            action: action.toLowerCase(),
            slippageBps: 100,
          },
          result: {
            amountIn,
            amountOut,
            pnlUsd: pnl,
            monPrice: 0.1,
          },
          pnl,
          txHash: fakeTxHash,
          status: 'SUCCESS',
          gasUsed: BigInt(randInt(50000, 200000)),
          executedAt: execDate,
          completedAt: new Date(execDate.getTime() + randInt(400, 2000)),
        },
      });
      totalExecs++;
    }

    // Update agent metrics
    const totalPnl = pnls.reduce((s, v) => s + v, 0);
    const wins = pnls.filter((p) => p > 0).length;
    const winRate = (wins / pnls.length) * 100;

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        totalPnl: Number(totalPnl.toFixed(6)),
        totalTrades: pnls.length,
        winRate: Number(winRate.toFixed(2)),
        sharpeRatio: calculateSharpe(pnls),
        maxDrawdown: calculateMaxDrawdown(pnls),
      },
    });
  }

  console.log(`  Created ${totalExecs} executions`);

  // 4. Create feedback records
  console.log('\nCreating feedback records...');
  let totalFeedback = 0;

  for (const { id: agentId } of agents) {
    const numFeedback = randInt(2, 5);
    for (let i = 0; i < numFeedback; i++) {
      const isPositive = Math.random() > 0.3;
      const value = isPositive ? BigInt(randInt(50, 100)) : BigInt(-randInt(10, 50));

      await prisma.feedback.create({
        data: {
          agentId,
          clientAddr: `0x${randInt(1000, 9999).toString(16).padStart(40, '0')}`,
          value,
          valueDecimals: 2,
          score: isPositive ? randInt(60, 95) : randInt(20, 50),
          tag1: pick(['trade_execution', 'yield_performance', 'risk_management']),
          tag2: isPositive ? 'success' : 'failure',
          createdAt: daysAgo(randInt(1, 20)),
        },
      });
      totalFeedback++;
    }
  }

  console.log(`  Created ${totalFeedback} feedback records`);

  // 5. Create validation records
  console.log('\nCreating validation records...');
  let totalValidations = 0;

  for (const { id: agentId } of agents) {
    const numValidations = randInt(1, 3);
    for (let i = 0; i < numValidations; i++) {
      const hash = `0x${Buffer.from(`val-${agentId}-${i}-${Date.now()}`).toString('hex').slice(0, 64)}`;

      await prisma.validation.create({
        data: {
          agentId,
          requestHash: hash,
          validatorAddr: DEMO_AGENT_WALLET,
          tag: pick(['trade-intent', 'risk-check', 'strategy-checkpoint']),
          score: randInt(50, 95),
          status: 'validated',
          createdAt: daysAgo(randInt(1, 15)),
          completedAt: daysAgo(randInt(0, 14)),
        },
      });
      totalValidations++;
    }
  }

  console.log(`  Created ${totalValidations} validation records`);

  // 6. Create trade proposals (OpenClaw Judgement demo)
  console.log('\nCreating trade proposals...');

  // Pending proposal (awaiting human approval)
  await prisma.tradeProposal.create({
    data: {
      agentId: agents[0].id,
      tokenAddress: '0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd', // WMON
      amount: '5.0',
      action: 'buy',
      slippageBps: 100,
      proposedBy: 'a2a-demo-agent',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // Executed proposal
  await prisma.tradeProposal.create({
    data: {
      agentId: agents[1].id,
      tokenAddress: '0x534b2f3A21130d7a60830c2Df862319e593943A3', // USDC
      amount: '2.5',
      action: 'sell',
      slippageBps: 50,
      proposedBy: 'mcp-tool',
      status: 'EXECUTED',
      approvedBy: DEMO_USER_ADDRESS,
      expiresAt: daysAgo(0),
    },
  });

  // Rejected proposal
  await prisma.tradeProposal.create({
    data: {
      agentId: agents[2].id,
      tokenAddress: '0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd',
      amount: '50.0',
      action: 'buy',
      slippageBps: 200,
      proposedBy: 'a2a-external',
      status: 'REJECTED',
      rejectedReason: 'Amount too large for current risk parameters',
      expiresAt: daysAgo(1),
    },
  });

  console.log('  Created 3 trade proposals (pending, executed, rejected)');

  // Summary
  console.log('\n========================================');
  console.log('Seed complete!');
  console.log(`  Users:       1`);
  console.log(`  Agents:      ${agents.length}`);
  console.log(`  Executions:  ${totalExecs}`);
  console.log(`  Feedbacks:   ${totalFeedback}`);
  console.log(`  Validations: ${totalValidations}`);
  console.log(`  Proposals:   3 (OpenClaw Judgement)`);
  console.log('========================================\n');

  // Print agent summary
  console.log('Agent Summary:');
  for (const { id, seed } of agents) {
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { totalPnl: true, totalTrades: true, winRate: true, sharpeRatio: true, maxDrawdown: true },
    });
    if (agent) {
      console.log(`  ${seed.handle}: PnL=$${Number(agent.totalPnl).toFixed(4)}, Trades=${agent.totalTrades}, WinRate=${agent.winRate}%, Sharpe=${agent.sharpeRatio}, MaxDD=${Number(agent.maxDrawdown).toFixed(4)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
