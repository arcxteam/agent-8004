/**
 * Risk Metrics Calculator
 *
 * Calculates Sharpe ratio, max drawdown, and win rate from execution history.
 * Used to update agent leaderboard stats after each trade.
 */

interface ExecutionForMetrics {
  pnl: number | null;
  status: string;
  executedAt: Date;
}

/**
 * Calculate Sharpe ratio from a series of PnL values
 * Sharpe = mean(returns) / stdDev(returns)
 * Uses 0 as risk-free rate (crypto convention)
 */
export function calculateSharpeRatio(executions: ExecutionForMetrics[]): number {
  const pnls = executions
    .filter((e) => e.status === 'SUCCESS' && e.pnl !== null)
    .map((e) => Number(e.pnl));

  if (pnls.length < 2) return 0;

  const mean = pnls.reduce((sum, v) => sum + v, 0) / pnls.length;
  const variance = pnls.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (pnls.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return mean > 0 ? 3.0 : 0; // Perfect consistency

  // Annualize: assume ~250 trading days
  const dailySharpe = mean / stdDev;
  const annualizedSharpe = dailySharpe * Math.sqrt(250);

  // Cap at reasonable bounds
  return Math.max(-5, Math.min(5, Number(annualizedSharpe.toFixed(4))));
}

/**
 * Calculate maximum drawdown from cumulative PnL series
 * Max drawdown = largest peak-to-trough decline
 */
export function calculateMaxDrawdown(executions: ExecutionForMetrics[]): number {
  const pnls = executions
    .filter((e) => e.status === 'SUCCESS' && e.pnl !== null)
    .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())
    .map((e) => Number(e.pnl));

  if (pnls.length === 0) return 0;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return Number(maxDrawdown.toFixed(6));
}

/**
 * Calculate win rate (percentage of profitable trades)
 */
export function calculateWinRate(executions: ExecutionForMetrics[]): number {
  const completed = executions.filter((e) => e.status === 'SUCCESS' && e.pnl !== null);
  if (completed.length === 0) return 0;

  const wins = completed.filter((e) => Number(e.pnl) > 0).length;
  return Number(((wins / completed.length) * 100).toFixed(2));
}

/**
 * Calculate all metrics at once and return update payload for Prisma
 */
export function calculateAllMetrics(executions: ExecutionForMetrics[]) {
  return {
    sharpeRatio: calculateSharpeRatio(executions),
    maxDrawdown: calculateMaxDrawdown(executions),
    winRate: calculateWinRate(executions),
    totalTrades: executions.filter((e) => e.status === 'SUCCESS').length,
  };
}
