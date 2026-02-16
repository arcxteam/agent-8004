/**
 * Risk Guard — Pre-trade Safety Checks
 *
 * Enforces risk management rules before any trade execution:
 * - Maximum drawdown limit per risk level
 * - Daily loss limit (% of capital)
 * - Daily trade count limit
 * - Minimum trade size (avoid dust)
 *
 * Used by the scheduler for auto-execute mode and
 * can be used by trade/route.ts as an additional safety layer.
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiskCheckAgent {
  id: string;
  maxDrawdown: number;
  totalCapital: number;
  dailyLossLimit: number;
  maxDailyTrades: number;
  riskLevel?: string;
}

interface RiskCheckSignal {
  action: 'buy' | 'sell';
  amount: string;
  tokenAddress: string;
}

export interface RiskCheckResult {
  ok: boolean;
  reason?: string;
}

// ─── Risk Parameters ────────────────────────────────────────────────────────

const RISK_DRAWDOWN_LIMITS: Record<string, number> = {
  low: 0.10,     // 10% max drawdown
  medium: 0.20,  // 20% max drawdown
  high: 0.35,    // 35% max drawdown
};

const MIN_TRADE_SIZE_MON = 0.01; // Minimum 0.01 MON per trade

// ─── Main Risk Check ────────────────────────────────────────────────────────

/**
 * Check all risk limits before executing a trade.
 * Returns { ok: true } if safe, or { ok: false, reason: "..." } if blocked.
 */
export async function checkRiskLimits(
  agent: RiskCheckAgent,
  signal: RiskCheckSignal
): Promise<RiskCheckResult> {
  // 1. Drawdown limit check
  const riskLevel = (agent.riskLevel || 'medium').toLowerCase();
  const maxDrawdownLimit = RISK_DRAWDOWN_LIMITS[riskLevel] ?? 0.20;

  if (agent.maxDrawdown > maxDrawdownLimit) {
    return {
      ok: false,
      reason: `Drawdown ${(agent.maxDrawdown * 100).toFixed(1)}% exceeds ${riskLevel} limit of ${(maxDrawdownLimit * 100).toFixed(0)}%`,
    };
  }

  // 2. Daily loss limit check
  const dailyLoss = await getDailyLoss(agent.id);
  const dailyLossPercent = agent.totalCapital > 0
    ? (Math.abs(dailyLoss) / agent.totalCapital) * 100
    : 0;

  if (dailyLoss < 0 && dailyLossPercent > agent.dailyLossLimit) {
    return {
      ok: false,
      reason: `Daily loss ${dailyLossPercent.toFixed(1)}% exceeds limit of ${agent.dailyLossLimit}%`,
    };
  }

  // 3. Daily trade count check
  const dailyTradeCount = await getDailyTradeCount(agent.id);
  if (dailyTradeCount >= agent.maxDailyTrades) {
    return {
      ok: false,
      reason: `Daily trade limit reached: ${dailyTradeCount}/${agent.maxDailyTrades}`,
    };
  }

  // 4. Minimum trade size check
  const tradeAmountMON = parseFloat(signal.amount);
  if (isNaN(tradeAmountMON) || tradeAmountMON < MIN_TRADE_SIZE_MON) {
    return {
      ok: false,
      reason: `Trade amount ${signal.amount} MON below minimum ${MIN_TRADE_SIZE_MON} MON`,
    };
  }

  // 5. Buy validation: check capital available
  if (signal.action === 'buy' && agent.totalCapital > 0) {
    if (tradeAmountMON > agent.totalCapital * 0.5) {
      return {
        ok: false,
        reason: `Buy amount ${tradeAmountMON.toFixed(4)} MON exceeds 50% of capital (${agent.totalCapital.toFixed(4)} MON)`,
      };
    }
  }

  return { ok: true };
}

// ─── Helper Queries ─────────────────────────────────────────────────────────

/**
 * Get total PnL for an agent from today's executions.
 * Returns negative number if net loss today.
 */
async function getDailyLoss(agentId: string): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const result = await prisma.execution.aggregate({
      where: {
        agentId,
        status: 'SUCCESS',
        executedAt: { gte: todayStart },
      },
      _sum: { pnl: true },
    });

    return Number(result._sum.pnl || 0);
  } catch (err) {
    console.error(`[RiskGuard] getDailyLoss failed for ${agentId}:`, err);
    // FAIL-CLOSED: assume worst case loss — block trades when DB is down
    // Real money safety: better to miss a trade than lose capital without limits
    return -Infinity;
  }
}

/**
 * Get the number of trades an agent made today.
 */
async function getDailyTradeCount(agentId: string): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    return await prisma.execution.count({
      where: {
        agentId,
        executedAt: { gte: todayStart },
      },
    });
  } catch (err) {
    console.error(`[RiskGuard] getDailyTradeCount failed for ${agentId}:`, err);
    // FAIL-CLOSED: assume max trades reached — block trades when DB is down
    return Infinity;
  }
}
