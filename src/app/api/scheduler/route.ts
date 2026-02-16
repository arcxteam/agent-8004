/**
 * Agent Scheduler API — Autonomous Trading Loop
 *
 * POST /api/scheduler — Evaluate all active agents + auto-execute if enabled
 * GET  /api/scheduler — Get scheduler status and last run results
 *
 * Flow:
 * 1. Discover trending tokens from nad.fun (token discovery)
 * 2. Merge with default tokens
 * 3. For each ACTIVE agent:
 *    a. Fetch portfolio data (wallet balance + holdings)
 *    b. Evaluate strategy with market data (volume, marketcap, momentum)
 *    c. If agent.autoExecute && confidence >= threshold:
 *       → Risk guard check → Auto-execute trade
 *    d. Else: Create TradeProposal (human-in-the-loop)
 * 4. Optionally schedule next run (continuous loop)
 *
 * Rate limiting: Built-in cooldown prevents re-evaluation of agents
 * that were recently evaluated (default: 5 minutes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  evaluateStrategy,
  getDefaultEvaluationTokens,
  type AgentContext,
  type StrategyType,
  type RiskLevel,
} from '@/lib/strategy-engine';
import { discoverTradableTokens } from '@/lib/token-discovery';
import { MONAD_TOKENS, getERC20Holdings } from '@/lib/lifi-client';
import { checkRiskLimits } from '@/lib/risk-guard';
import { getHoldings } from '@/lib/nadfun-api';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig, CONTRACTS } from '@/config/chains';
import { getRpcUrl } from '@/lib/config';
import { getBaseUrl } from '@/lib/get-base-url';

// Minimum interval between evaluations for the same agent (ms)
const MIN_EVAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Track last evaluation time per agent (in-memory, resets on server restart)
const lastEvalTime = new Map<string, number>();

// Track last scheduler run result
let lastRunResult: {
  timestamp: string;
  agentsEvaluated: number;
  signalsGenerated: number;
  proposalsCreated: number;
  autoExecuted: number;
  riskBlocked: number;
  errors: number;
  discoveredTokens: number;
  results: Array<{
    agentId: string;
    agentName: string;
    strategy: string;
    signal: string | null;
    proposalId?: string;
    status?: string;
    error?: string;
  }>;
} | null = null;

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let customTokens: string[] | undefined;
    let intervalMs = MIN_EVAL_INTERVAL_MS;
    try {
      const body = await request.json();
      customTokens = body.tokens;
      if (body.intervalMs && typeof body.intervalMs === 'number') {
        intervalMs = Math.max(60000, body.intervalMs);
      }
    } catch {
      // Empty body is fine
    }

    // ── Step 1: Token Discovery ──
    // Discover actively traded tokens from nad.fun events + enrich with market data
    // Rate limit aware: only enriches top 8 tokens (2 API calls each = 16 calls max)
    let discoveredTokenCount = 0;
    let allTokenAddresses: string[] = [];
    let discoveredTokensMetadata: Array<{ address: string; createdAtBlock?: number }> = [];

    try {
      // Pass empty array — don't flood with 30+ default tokens
      // Discovery finds the most actively traded tokens from on-chain events
      const discovered = await discoverTradableTokens([]);
      allTokenAddresses = discovered.map(t => t.address);
      discoveredTokenCount = allTokenAddresses.length;
      discoveredTokensMetadata = discovered.map(t => ({
        address: t.address,
        createdAtBlock: t.createdAtBlock,
      }));

      console.log(`[Scheduler] Discovered ${discoveredTokenCount} tradable tokens from nad.fun events`);
    } catch (err) {
      console.warn('[Scheduler] Token discovery failed, using custom tokens if provided:', err);
    }

    // Fallback: use custom tokens or a small subset of defaults
    if (allTokenAddresses.length === 0) {
      const defaultTokens = customTokens && customTokens.length > 0
        ? customTokens
        : getDefaultEvaluationTokens().slice(0, 5); // Max 5 defaults as fallback
      allTokenAddresses = defaultTokens;
      console.log(`[Scheduler] Using ${allTokenAddresses.length} fallback tokens`);
    }

    // Add 2-3 random MONAD_TOKENS for LiFi/Relay diversity (MOMENTUM should work with all routers)
    // This ensures agents don't only evaluate nad.fun tokens
    const monadTokenSymbols = Object.keys(MONAD_TOKENS);
    const shuffled = monadTokenSymbols.sort(() => Math.random() - 0.5);
    const diversityTokens = shuffled.slice(0, 3).map(sym => MONAD_TOKENS[sym].address);
    const tokenSet = new Set(allTokenAddresses.map(a => a.toLowerCase()));
    for (const addr of diversityTokens) {
      if (!tokenSet.has(addr.toLowerCase())) {
        allTokenAddresses.push(addr);
        tokenSet.add(addr.toLowerCase());
      }
    }
    // Cap total at 10 tokens to respect API rate limits
    allTokenAddresses = allTokenAddresses.slice(0, 10);
    console.log(`[Scheduler] Final token pool: ${allTokenAddresses.length} tokens (nad.fun + LiFi/Relay diversity)`);

    // ── Step 2: Fetch Active Agents ──
    const agents = await prisma.agent.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        strategy: true,
        riskParams: true,
        totalCapital: true,
        totalPnl: true,
        maxDrawdown: true,
        walletAddr: true,
        autoExecute: true,
        maxDailyTrades: true,
        dailyLossLimit: true,
      },
    });

    if (agents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active agents to evaluate',
        data: { agentsEvaluated: 0, signalsGenerated: 0, proposalsCreated: 0, autoExecuted: 0 },
      });
    }

    // ── Step 3: Set up RPC client for portfolio queries ──
    const { network } = getNetworkConfig();
    const rpcUrl = getRpcUrl(network);
    const chain = network === 'mainnet'
      ? (await import('@/config/chains')).monadMainnet
      : (await import('@/config/chains')).monadTestnet;
    const publicClient = createTimeoutPublicClient(chain, rpcUrl, 8000);

    const now = Date.now();
    const results: NonNullable<typeof lastRunResult>['results'] = [];
    let signalsGenerated = 0;
    let proposalsCreated = 0;
    let autoExecuted = 0;
    let riskBlocked = 0;
    let errors = 0;
    let skipped = 0;

    // ── Step 4: Evaluate Each Agent ──
    for (const agent of agents) {
      // Check cooldown
      const lastEval = lastEvalTime.get(agent.id);
      if (lastEval && now - lastEval < intervalMs) {
        skipped++;
        continue;
      }

      try {
        const riskParams = (agent.riskParams as Record<string, unknown>) || {};
        const riskLevel = (riskParams.riskLevel as RiskLevel) || 'medium';

        // ── Portfolio-Aware: Fetch wallet balance + holdings (nad.fun + ERC-20) ──
        let walletBalance: number | undefined;
        let holdings: Array<{ token: string; symbol: string; balance: string; value: string }> | undefined;

        if (agent.walletAddr) {
          try {
            const [balance, nadfunHoldings, erc20HoldingsData] = await Promise.all([
              publicClient.getBalance({ address: agent.walletAddr as `0x${string}` }).catch(() => BigInt(0)),
              getHoldings(agent.walletAddr).catch(() => ({ holdings: [] })),
              getERC20Holdings(publicClient, agent.walletAddr).catch(() => ({ holdings: [] })),
            ]);
            walletBalance = Number(balance) / 1e18;

            // Merge nad.fun + ERC-20 holdings, deduplicate by token address
            const holdingsMap = new Map<string, typeof nadfunHoldings.holdings[0]>();
            for (const h of nadfunHoldings.holdings) {
              holdingsMap.set(h.token.toLowerCase(), h);
            }
            for (const h of erc20HoldingsData.holdings) {
              const key = h.token.toLowerCase();
              if (!holdingsMap.has(key)) {
                holdingsMap.set(key, h);
              }
            }
            holdings = Array.from(holdingsMap.values());
          } catch {
            // Non-blocking — proceed without portfolio data
          }
        }

        // ── Balance Reconciliation: Sync on-chain balance → DB totalCapital ──
        // This ensures totalCapital always reflects actual wallet state,
        // not just trade-based increments. Catches direct transfers, gas costs, etc.
        const dbCapital = Number(agent.totalCapital) || 0;
        let reconciledCapital = dbCapital;

        if (walletBalance !== undefined && walletBalance >= 0) {
          // Add token holdings value (approximate, in MON terms)
          let holdingsValueMon = 0;
          if (holdings && holdings.length > 0) {
            for (const h of holdings) {
              holdingsValueMon += parseFloat(h.value || '0');
            }
          }
          const totalOnChainValue = walletBalance + holdingsValueMon;
          const drift = Math.abs(totalOnChainValue - dbCapital);

          // Only sync if drift > 0.1 MON (avoid noise from gas fluctuations)
          if (drift > 0.1) {
            try {
              await prisma.agent.update({
                where: { id: agent.id },
                data: { totalCapital: totalOnChainValue },
              });
              reconciledCapital = totalOnChainValue;
              console.log(`[Scheduler] Balance reconciled for ${agent.name}: DB ${dbCapital.toFixed(4)} → on-chain ${totalOnChainValue.toFixed(4)} MON (drift: ${drift.toFixed(4)})`);
            } catch (syncErr) {
              console.warn(`[Scheduler] Balance reconciliation failed for ${agent.id}:`, syncErr);
            }
          }
        }

        const agentContext: AgentContext = {
          id: agent.id,
          strategy: agent.strategy as StrategyType,
          riskLevel,
          totalCapital: reconciledCapital,
          totalPnl: Number(agent.totalPnl) || 0,
          maxDrawdown: agent.maxDrawdown || 0,
          walletAddr: agent.walletAddr || undefined,
          walletBalance,
          holdings,
          dailyLossLimit: agent.dailyLossLimit,
          maxDailyTrades: agent.maxDailyTrades,
        };

        // For autoExecute agents, don't auto-propose (we handle execution here)
        // For manual agents, auto-propose to create TradeProposal
        const autoPropose = !agent.autoExecute;

        const evalResult = await evaluateStrategy(agentContext, allTokenAddresses, autoPropose, discoveredTokensMetadata);

        // Update last eval time
        lastEvalTime.set(agent.id, now);

        if (evalResult.signal) {
          signalsGenerated++;
        }

        if (evalResult.proposalId) {
          proposalsCreated++;
        }

        // ── Auto-Execute Path ──
        if (agent.autoExecute && evalResult.signal) {
          const signal = evalResult.signal;

          // Risk guard check before execution
          const riskCheck = await checkRiskLimits(
            {
              id: agent.id,
              maxDrawdown: agent.maxDrawdown,
              totalCapital: Number(agent.totalCapital) || 0,
              dailyLossLimit: agent.dailyLossLimit,
              maxDailyTrades: agent.maxDailyTrades,
              riskLevel,
            },
            {
              action: signal.action,
              amount: signal.amount,
              tokenAddress: signal.tokenAddress,
            }
          );

          if (!riskCheck.ok) {
            riskBlocked++;
            results.push({
              agentId: agent.id,
              agentName: agent.name,
              strategy: agent.strategy,
              signal: `${signal.action} ${signal.tokenSymbol} (confidence: ${signal.confidence})`,
              status: 'risk_blocked',
              error: riskCheck.reason,
            });
            continue;
          }

          // Execute trade via internal API
          try {
            const slippageBps = (riskParams.slippageBps as number) || 100;
            const baseUrl = getBaseUrl();

            const tradeResponse = await fetch(`${baseUrl}/api/trade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tokenAddress: signal.tokenAddress,
                amount: signal.amount,
                action: signal.action,
                agentId: agent.id,
                slippageBps,
              }),
              signal: AbortSignal.timeout(90_000), // 90s timeout for trade execution
            });

            const tradeResult = await tradeResponse.json();

            if (tradeResponse.ok && tradeResult.success) {
              autoExecuted++;
              results.push({
                agentId: agent.id,
                agentName: agent.name,
                strategy: agent.strategy,
                signal: `${signal.action} ${signal.tokenSymbol} (confidence: ${signal.confidence})`,
                status: 'auto_executed',
              });
            } else {
              errors++;
              results.push({
                agentId: agent.id,
                agentName: agent.name,
                strategy: agent.strategy,
                signal: `${signal.action} ${signal.tokenSymbol} (confidence: ${signal.confidence})`,
                status: 'execution_failed',
                error: tradeResult.error || 'Trade execution failed',
              });
            }
          } catch (err) {
            errors++;
            const msg = err instanceof Error ? err.message : 'Trade execution error';
            results.push({
              agentId: agent.id,
              agentName: agent.name,
              strategy: agent.strategy,
              signal: `${signal.action} ${signal.tokenSymbol} (confidence: ${signal.confidence})`,
              status: 'execution_error',
              error: msg,
            });
          }
        } else {
          // Manual path: proposal already created by evaluateStrategy (if autoPropose=true)
          results.push({
            agentId: agent.id,
            agentName: agent.name,
            strategy: agent.strategy,
            signal: evalResult.signal
              ? `${evalResult.signal.action} ${evalResult.signal.tokenSymbol} (confidence: ${evalResult.signal.confidence})`
              : null,
            proposalId: evalResult.proposalId,
            status: evalResult.proposalId ? 'proposal_created' : 'no_signal',
          });
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          strategy: agent.strategy,
          signal: null,
          status: 'error',
          error: msg,
        });
      }
    }

    // Store last run result
    lastRunResult = {
      timestamp: new Date().toISOString(),
      agentsEvaluated: results.length,
      signalsGenerated,
      proposalsCreated,
      autoExecuted,
      riskBlocked,
      errors,
      discoveredTokens: discoveredTokenCount,
      results,
    };

    // ── Step 5: Continuous Loop (self-trigger) ──
    if (process.env.SCHEDULER_AUTO_LOOP === 'true') {
      const loopIntervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS || '300000');
      const baseUrl = getBaseUrl();

      setTimeout(async () => {
        try {
          await fetch(`${baseUrl}/api/scheduler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(120_000), // 2 min timeout for scheduler run
          });
          console.log('[Scheduler] Auto-loop triggered');
        } catch (e) {
          console.error('[Scheduler] Auto-loop failed:', e);
        }
      }, loopIntervalMs);
    }

    return NextResponse.json({
      success: true,
      data: {
        agentsEvaluated: results.length,
        agentsSkipped: skipped,
        signalsGenerated,
        proposalsCreated,
        autoExecuted,
        riskBlocked,
        errors,
        discoveredTokens: discoveredTokenCount,
        totalTokensAnalyzed: allTokenAddresses.length,
        results,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Scheduler failed';
    console.error('Scheduler error:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  const activeAgentCount = await prisma.agent.count({ where: { status: 'ACTIVE' } });
  const pendingProposals = await prisma.tradeProposal.count({ where: { status: 'PENDING' } });
  const autoExecuteAgents = await prisma.agent.count({
    where: { status: 'ACTIVE', autoExecute: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      activeAgents: activeAgentCount,
      autoExecuteAgents,
      pendingProposals,
      minIntervalMs: MIN_EVAL_INTERVAL_MS,
      autoLoopEnabled: process.env.SCHEDULER_AUTO_LOOP === 'true',
      lastRun: lastRunResult,
    },
  });
}
