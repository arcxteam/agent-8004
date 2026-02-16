/**
 * Agent Strategy Execution Engine
 *
 * Modular framework for evaluating trading strategies.
 * Each strategy analyzes market data and produces TradeSignals,
 * which are then converted to TradeProposals (human-in-the-loop via OpenClaw).
 *
 * Architecture:
 *   StrategyEngine.evaluate(agent, tokens)
 *     → resolveStrategy(agent.strategy)
 *     → strategy.evaluate(context)
 *     → TradeSignal | null
 *     → createTradeProposal() (if signal passes confidence threshold)
 *
 * Strategies:
 *   MOMENTUM  — Follow price trends using timeframe-based metrics
 *   YIELD     — Optimize yield via aprMON / earnAUSD deposits
 *   ARBITRAGE — Compare prices across nad.fun bonding curves vs LiFi
 *   DCA       — Periodic fixed-amount buys to reduce volatility
 *   GRID      — Range-bound trading between support/resistance
 *   HEDGE     — Risk mitigation via stablecoin rebalancing
 */

import { getMarketData, getTokenMetrics } from '@/lib/nadfun-api';
import { createTradeProposal, type CreateProposalParams } from '@/lib/trade-judgement';
import { analyzeSignal } from '@/lib/ai-advisor';
import { MONAD_TOKENS } from '@/lib/lifi-client';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig, CONTRACTS } from '@/config/chains';
import { lensAbi } from '@/config/contracts';
import { getRpcUrl } from '@/lib/config';
import type { Address } from 'viem';

// ─── Types ──────────────────────────────────────────────────────────────────

export type StrategyType = 'MOMENTUM' | 'YIELD' | 'ARBITRAGE' | 'DCA' | 'GRID' | 'HEDGE';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface AgentContext {
  id: string;
  strategy: StrategyType;
  riskLevel: RiskLevel;
  totalCapital: number;
  totalPnl: number;
  maxDrawdown: number;
  walletAddr?: string;
  walletBalance?: number;  // MON balance of agent wallet
  holdings?: Array<{ token: string; symbol: string; balance: string; value: string }>;
  dailyLossLimit?: number;  // % of capital (from agent config)
  maxDailyTrades?: number;  // max trades per day (from agent config)
}

export interface MarketSnapshot {
  token: string;
  symbol: string;
  price: number;
  priceUsd: number;
  volume24h: number;
  holders: number;
  marketCap: number;
  liquidity: number;
  metrics: Record<string, {
    priceChange: number;
    volumeChange: number;
    txCount: number;
  }>;
  // Bonding curve intelligence (from Lens on-chain)
  bondingCurveProgress: number;  // 0-10000 basis points
  isGraduated: boolean;
  isLocked: boolean;
  // Anti-sniping awareness
  createdAtBlock?: number;       // Block when token was created (from CurveCreate event)
  latestBlock?: number;          // Current latest block for age calculation
}

export interface TradeSignal {
  action: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  confidence: number;   // 0-100
  reason: string;
  strategy: StrategyType;
  metadata?: Record<string, unknown>;
}

export interface EvaluationResult {
  agentId: string;
  strategy: StrategyType;
  signal: TradeSignal | null;
  proposalId?: string;
  evaluatedAt: string;
  tokensAnalyzed: number;
  reasoning: string;
}

// ─── Risk Parameters by Level ───────────────────────────────────────────────

const RISK_PARAMS: Record<RiskLevel, {
  maxPositionPct: number;      // Max % of capital per trade
  minConfidence: number;       // Min confidence to propose
  maxDrawdownLimit: number;    // Stop trading if drawdown exceeds this
  slippageBps: number;         // Slippage tolerance in bps
}> = {
  low: {
    maxPositionPct: 0.05,      // 5% of capital
    minConfidence: 75,
    maxDrawdownLimit: 0.10,    // 10% max drawdown
    slippageBps: 50,           // 0.5%
  },
  medium: {
    maxPositionPct: 0.10,      // 10% of capital
    minConfidence: 60,
    maxDrawdownLimit: 0.20,    // 20% max drawdown
    slippageBps: 100,          // 1%
  },
  high: {
    maxPositionPct: 0.20,      // 20% of capital
    minConfidence: 45,
    maxDrawdownLimit: 0.35,    // 35% max drawdown
    slippageBps: 150,          // 1.5%
  },
};

// ─── Strategy Interface ─────────────────────────────────────────────────────

interface Strategy {
  readonly name: StrategyType;
  evaluate(agent: AgentContext, markets: MarketSnapshot[]): TradeSignal | null;
}

// ─── Gas Reserve & Position Sizing ─────────────────────────────────────────

/**
 * Minimum MON to keep in wallet for gas fees.
 * Production safety margin: 1 MON covers ~2500 txs at ~400 gwei.
 * Agent should NEVER spend below this threshold.
 * This prevents agent from getting stuck without gas for sell/exit transactions.
 */
const GAS_RESERVE_MON = 5.0;

/**
 * Anti-sniping protection: minimum blocks since token creation before buying.
 * nad.fun BondingCurve has AntiSnipingConfig with penaltyBlocks[] and penaltyRates[].
 * Buying within penalty blocks incurs extra fees (up to 99%).
 * Default safe threshold: 20 blocks (~10 seconds on Monad at ~0.5s/block).
 */
const ANTI_SNIPE_MIN_BLOCKS = 20;

/**
 * Check if a token is too new to buy safely (anti-sniping protection).
 * Returns true if the token should be skipped (too new).
 */
function isTokenTooNew(market: MarketSnapshot): boolean {
  // No createdAtBlock = not from CurveCreate discovery = not a new nad.fun token = safe
  if (!market.createdAtBlock) return false;
  // SAFETY: has createdAtBlock but no latestBlock = can't calculate age = block trade
  if (!market.latestBlock) return true;
  const tokenAge = market.latestBlock - market.createdAtBlock;
  return tokenAge < ANTI_SNIPE_MIN_BLOCKS;
}

/**
 * Calculate safe position size for a BUY trade.
 * Ensures the agent always keeps GAS_RESERVE_MON in wallet.
 * Returns 0 if insufficient balance for any trade.
 */
function getSafePositionSize(agent: AgentContext, desiredSize: number): number {
  // SAFETY: if walletBalance unknown, block trade — do NOT trade blind with real money
  if (agent.walletBalance === undefined) return 0;
  const availableForTrading = Math.max(0, agent.walletBalance - GAS_RESERVE_MON);
  if (availableForTrading <= 0) return 0;
  return Math.min(desiredSize, availableForTrading);
}

// ─── Helper: Get Holding Balance ────────────────────────────────────────────

/**
 * Get the token holding balance from agent's portfolio.
 * Returns the actual number of tokens held (NOT MON value).
 * Used for SELL signals to ensure we sell the correct token amount.
 */
function getHoldingBalance(agent: AgentContext, tokenAddress: string): number {
  if (!agent.holdings) return 0;
  const holding = agent.holdings.find(
    h => h.token.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!holding) return 0;
  return parseFloat(holding.balance) || 0;
}

// ─── Momentum Strategy ──────────────────────────────────────────────────────
// Buy tokens with strong upward price momentum across multiple timeframes.
// Sell tokens showing momentum reversal (declining across timeframes).
// Timeframe: 5m (noise filter) + 1h (direction) + 4h (trend context)
// Supports all routers: nad.fun + LiFi + Relay.

const momentumStrategy: Strategy = {
  name: 'MOMENTUM',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];
    let bestSignal: TradeSignal | null = null;
    let bestScore = 0;

    for (const market of markets) {
      // Skip locked tokens — cannot trade during graduation transition
      if (market.isLocked) continue;

      // Anti-sniping: skip tokens created too recently (penalty fee protection)
      if (isTokenTooNew(market)) continue;

      const m5m = market.metrics['5m'];
      const m1h = market.metrics['1h'];
      const m4h = market.metrics['4h']; // Optional — may not be available from API
      if (!m5m || !m1h) continue;

      // Multi-timeframe momentum score
      // 4h available: 5m×0.30 + 1h×0.40 + 4h×0.30 (balanced short + medium term)
      // 4h unavailable: 5m×0.45 + 1h×0.55 (fallback)
      let momentumScore: number;
      if (m4h) {
        momentumScore =
          m5m.priceChange * 0.30 +
          m1h.priceChange * 0.40 +
          m4h.priceChange * 0.30;
      } else {
        momentumScore =
          m5m.priceChange * 0.45 +
          m1h.priceChange * 0.55;
      }

      // Volume confirmation (5m volume is most relevant for momentum)
      const volumeMultiplier = m5m.volumeChange > 0 ? 1.2 : 0.8;
      let adjustedScore = momentumScore * volumeMultiplier;

      // ── Bonding Curve Intelligence (supplementary) ──
      // Tetap ada untuk nad.fun tokens, tapi bobot kecil
      if (!market.isGraduated && market.bondingCurveProgress > 0) {
        const progress = market.bondingCurveProgress / 100; // 0-100%

        // Sweet spot: 50-70% progress → small boost (+10%)
        if (progress >= 50 && progress <= 70 && adjustedScore > 0) {
          adjustedScore *= 1.10;
        }

        // Pre-graduation zone: >85% → force SELL signal (take profit before lock)
        if (progress > 85 && agent.holdings) {
          const holdingBalance = getHoldingBalance(agent, market.token);
          if (holdingBalance > 0) {
            const confidence = Math.min(90, Math.round(60 + progress * 0.3));
            if (confidence > bestScore && confidence >= riskParams.minConfidence) {
              bestScore = confidence;
              bestSignal = {
                action: 'sell',
                tokenAddress: market.token,
                tokenSymbol: market.symbol,
                amount: holdingBalance.toFixed(4),
                confidence,
                reason: `Pre-graduation sell: progress ${progress.toFixed(0)}%, take profit before graduation lock`,
                strategy: 'MOMENTUM',
                metadata: { bondingCurveProgress: progress, preGraduation: true },
              };
            }
            continue;
          }
        }
      }

      // ── Market Quality Boosts ──
      if (market.volume24h > 1000 && adjustedScore > 0) {
        adjustedScore *= 1.15;
      }
      if (market.holders > 50 && adjustedScore > 0) {
        adjustedScore *= 1.1;
      }
      if (market.marketCap > 0 && market.marketCap < 100) continue;
      if (market.liquidity > 0 && market.liquidity < 50) continue;

      // ── 4h Trend Alignment Boost ──
      // Jika 4h trend searah dengan 5m+1h → confidence boost
      if (m4h && adjustedScore > 0 && m4h.priceChange > 0) {
        adjustedScore *= 1.08; // +8% aligned trend boost
      }

      // ── Portfolio-Aware Guard ──
      if (agent.walletBalance !== undefined) {
        if (adjustedScore > 0 && agent.walletBalance <= GAS_RESERVE_MON) continue;
        if (adjustedScore < 0 && agent.holdings) {
          const holding = agent.holdings.find(
            h => h.token.toLowerCase() === market.token.toLowerCase()
          );
          if (!holding || parseFloat(holding.balance) <= 0) continue;
        }
      }

      // BUY signal: strong upward momentum with volume
      if (adjustedScore > 3 && m5m.txCount >= 5) {
        const confidence = Math.min(95, Math.round(50 + adjustedScore * 5));
        if (confidence > bestScore && confidence >= riskParams.minConfidence) {
          const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct;
          const positionSize = getSafePositionSize(agent, rawPositionSize);
          if (positionSize <= 0) continue;
          bestScore = confidence;
          const tf4hStr = m4h ? `, 4h ${m4h.priceChange > 0 ? '+' : ''}${m4h.priceChange.toFixed(1)}%` : '';
          bestSignal = {
            action: 'buy',
            tokenAddress: market.token,
            tokenSymbol: market.symbol,
            amount: positionSize.toFixed(4),
            confidence,
            reason: `Strong momentum: 5m ${m5m.priceChange > 0 ? '+' : ''}${m5m.priceChange.toFixed(1)}%, 1h ${m1h.priceChange > 0 ? '+' : ''}${m1h.priceChange.toFixed(1)}%${tf4hStr}, vol ${m5m.volumeChange > 0 ? 'rising' : 'falling'}`,
            strategy: 'MOMENTUM',
            metadata: { momentumScore: adjustedScore, timeframes: { m5m, m1h, m4h }, marketCap: market.marketCap, volume24h: market.volume24h, holders: market.holders, bondingCurveProgress: market.bondingCurveProgress },
          };
        }
      }

      // SELL signal: strong downward momentum reversal
      if (adjustedScore < -3 && m5m.txCount >= 3) {
        const confidence = Math.min(95, Math.round(50 + Math.abs(adjustedScore) * 5));
        if (confidence > bestScore && confidence >= riskParams.minConfidence) {
          const holdingBalance = getHoldingBalance(agent, market.token);
          if (holdingBalance <= 0) continue;
          bestScore = confidence;
          const tf4hStr = m4h ? `, 4h ${m4h.priceChange.toFixed(1)}%` : '';
          bestSignal = {
            action: 'sell',
            tokenAddress: market.token,
            tokenSymbol: market.symbol,
            amount: holdingBalance.toFixed(4),
            confidence,
            reason: `Momentum reversal: 5m ${m5m.priceChange.toFixed(1)}%, 1h ${m1h.priceChange.toFixed(1)}%${tf4hStr}, selling to protect capital`,
            strategy: 'MOMENTUM',
            metadata: { momentumScore: adjustedScore, timeframes: { m5m, m1h, m4h } },
          };
        }
      }
    }

    return bestSignal;
  },
};

// ─── Yield Strategy ─────────────────────────────────────────────────────────
// Focus on yield-bearing tokens: MON liquid staking derivatives (LSTs) and
// yield-bearing stablecoins. Buy on dips for yield accumulation, sell on spikes.
// Timeframe: 4h (dip/level detection) + 1h (confirmation)
// Yield investing = patient — 5m noise is irrelevant here.
// Note: APR (aPriori governance token) is a trading token, NOT yield — handled by MOMENTUM/GRID/etc.

// Yield-bearing tokens: LSTs (earn staking yield) + yield stablecoins (earn lending/vault yield)
const YIELD_TOKENS = [
  // MON Liquid Staking Tokens — earn MON staking rewards
  'APRMON', 'GMON', 'SMON', 'SHMON', 'EARNMON', 'LVMON', 'MCMON',
  // ETH LSTs on Monad — earn ETH staking rewards
  'WSTETH', 'WEETH', 'EZETH', 'PUFETH',
  // Yield-bearing stablecoins — earn lending/vault yield
  'EARNAUSD', 'SAUSD', 'SUUSD', 'SYZUSD', 'WSRUSD', 'LVUSD', 'YZUSD',
];
// Addresses resolved from MONAD_TOKENS at runtime — no separate map needed

const yieldStrategy: Strategy = {
  name: 'YIELD',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];
    let bestSignal: TradeSignal | null = null;
    let bestScore = 0;

    for (const symbol of YIELD_TOKENS) {
      // Resolve address from MONAD_TOKENS
      const tokenInfo = MONAD_TOKENS[symbol];
      if (!tokenInfo) continue;

      const market = markets.find(
        m => m.token.toLowerCase() === tokenInfo.address.toLowerCase() || m.symbol.toUpperCase() === symbol
      );
      if (!market) continue;

      const m4h = market.metrics['4h'];
      const m1h = market.metrics['1h'];
      // Yield needs at least 1h data; 4h is preferred for broader view
      if (!m1h) continue;

      // Use 4h for primary dip/spike detection if available, fallback to 1h
      const primaryTf = m4h || m1h;
      const primaryLabel = m4h ? '4h' : '1h';

      // BUY on dip: yield token dropped but fundamentals strong (liquidity exists)
      // Yield investors buy dips for accumulation — 4h view avoids false signals
      if (primaryTf.priceChange < -3 && market.liquidity > 0) {
        const confidence = Math.min(85, Math.round(60 + Math.abs(primaryTf.priceChange) * 2.5));
        if (confidence > bestScore && confidence >= riskParams.minConfidence) {
          const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct;
          const positionSize = getSafePositionSize(agent, rawPositionSize);
          if (positionSize <= 0) continue;
          bestScore = confidence;
          bestSignal = {
            action: 'buy',
            tokenAddress: tokenInfo.address,
            tokenSymbol: symbol,
            amount: positionSize.toFixed(4),
            confidence,
            reason: `${symbol} dipped ${primaryTf.priceChange.toFixed(1)}% in ${primaryLabel} — buying for yield accumulation`,
            strategy: 'YIELD',
            metadata: { yieldToken: symbol, dip: primaryTf.priceChange, timeframe: primaryLabel },
          };
        }
      }

      // SELL on spike: yield token pumped unusually — take profit, re-enter later
      // Spike detection: 4h/1h up >5%, with 1h momentum slowing
      if (primaryTf.priceChange > 5 && m1h.priceChange < 2) {
        const confidence = Math.min(80, Math.round(55 + primaryTf.priceChange * 2));
        if (confidence > bestScore && confidence >= riskParams.minConfidence) {
          const holdingBalance = getHoldingBalance(agent, tokenInfo.address);
          if (holdingBalance <= 0) continue;
          bestScore = confidence;
          bestSignal = {
            action: 'sell',
            tokenAddress: tokenInfo.address,
            tokenSymbol: symbol,
            amount: holdingBalance.toFixed(4),
            confidence,
            reason: `${symbol} spiked +${primaryTf.priceChange.toFixed(1)}% in ${primaryLabel} — taking profit on yield token`,
            strategy: 'YIELD',
            metadata: { yieldToken: symbol, spike: primaryTf.priceChange, timeframe: primaryLabel },
          };
        }
      }
    }

    return bestSignal;
  },
};

// ─── Arbitrage Strategy ─────────────────────────────────────────────────────
// Compare token prices between nad.fun bonding curves and LiFi aggregator.
// Signal when price spread exceeds threshold (after slippage + gas).

const arbitrageStrategy: Strategy = {
  name: 'ARBITRAGE',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];

    // All 52 MONAD_TOKENS are potential arbitrage candidates across 3 venues:
    // nad.fun, LiFi, and Relay Protocol
    const knownTokenAddresses = new Set(
      Object.values(MONAD_TOKENS).map(t => t.address.toLowerCase())
    );

    for (const market of markets) {
      // Any token with market data is a candidate (nad.fun tokens from discovery + known ERC20s)
      const isKnownToken = knownTokenAddresses.has(market.token.toLowerCase());

      const m5m = market.metrics['5m'];
      const m1h = market.metrics['1h'];
      if (!m5m || !m1h) continue;

      // Detect rapid price movement (potential arb opportunity)
      // If 5m change is significantly different from 1h trend, there may be
      // a temporary mispricing between venues
      const spreadIndicator = Math.abs(m5m.priceChange - (m1h.priceChange / 12));
      const minSpread = agent.riskLevel === 'high' ? 1.5 : agent.riskLevel === 'medium' ? 2.0 : 3.0;

      if (spreadIndicator > minSpread && m5m.txCount >= 3) {
        const action = m5m.priceChange > 0 ? 'sell' : 'buy';
        const confidence = Math.min(90, Math.round(55 + spreadIndicator * 8));
        if (confidence >= riskParams.minConfidence) {
          let amount: string;
          if (action === 'sell') {
            // SELL uses actual token holding balance
            const holdingBalance = getHoldingBalance(agent, market.token);
            if (holdingBalance <= 0) continue; // No position to sell
            amount = holdingBalance.toFixed(4);
          } else {
            const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct;
            const positionSize = getSafePositionSize(agent, rawPositionSize);
            if (positionSize <= 0) continue; // Cannot trade — insufficient balance
            amount = positionSize.toFixed(4);
          }

          // Determine available venues for this token
          const venues: string[] = ['nadfun']; // All tokens can be on nad.fun
          if (isKnownToken) {
            venues.push('lifi', 'relay');
          }

          return {
            action,
            tokenAddress: market.token,
            tokenSymbol: market.symbol,
            amount,
            confidence,
            reason: `Price spread detected: 5m ${m5m.priceChange > 0 ? '+' : ''}${m5m.priceChange.toFixed(2)}% vs 1h trend, potential cross-venue arbitrage (${venues.join('/')})`,
            strategy: 'ARBITRAGE',
            metadata: { spreadIndicator, venues },
          };
        }
      }
    }

    return null;
  },
};

// ─── DCA Strategy ───────────────────────────────────────────────────────────
// Dollar-cost averaging: always buy a fixed amount at regular intervals.
// Modulates amount based on current price relative to moving average.
// Timeframe: 4h (discount detection) + 1h (fallback). DCA is long-term — 5m noise irrelevant.

// Blue-chip / high-liquidity tokens suitable for DCA (dollar-cost averaging)
const DCA_DEFAULT_TOKENS = [
  'WMON', 'WBTC', 'WETH', 'WSTETH', 'WEETH', 'EZETH',
  'SOL', 'LBTC', 'APRMON', 'GMON', 'SMON',
];
// Addresses resolved from MONAD_TOKENS at runtime — no need for separate map

const dcaStrategy: Strategy = {
  name: 'DCA',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];

    // DCA always buys — the question is which token and how much
    // Prefer tokens that are below their recent average (buy the dip)
    let bestTarget: { symbol: string; address: string; discount: number; tfLabel: string } | null = null;

    for (const symbol of DCA_DEFAULT_TOKENS) {
      // Look up address from MONAD_TOKENS
      const tokenInfo = MONAD_TOKENS[symbol];
      if (!tokenInfo) continue;

      const market = markets.find(
        m => m.token.toLowerCase() === tokenInfo.address.toLowerCase() || m.symbol.toUpperCase() === symbol
      );
      if (!market) continue;

      // Prefer 4h for broader discount view, fallback to 1h
      const m4h = market.metrics['4h'];
      const m1h = market.metrics['1h'];
      const primaryTf = m4h || m1h;
      const tfLabel = m4h ? '4h' : '1h';
      if (!primaryTf) continue;

      // If price is below average, it's a better DCA entry
      const discount = -primaryTf.priceChange; // Positive = below average
      if (!bestTarget || discount > bestTarget.discount) {
        bestTarget = {
          symbol: market.symbol || symbol,
          address: tokenInfo.address,
          discount,
          tfLabel,
        };
      }
    }

    if (bestTarget) {
      // DCA always has moderate confidence — it's a long-term strategy
      const baseConfidence = 65;
      const dipBonus = Math.min(20, Math.max(0, bestTarget.discount * 3));
      const confidence = Math.round(baseConfidence + dipBonus);

      if (confidence >= riskParams.minConfidence) {
        // DCA uses smaller position sizes
        const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct * 0.5;
        const positionSize = getSafePositionSize(agent, rawPositionSize);
        if (positionSize <= 0) return null;
        return {
          action: 'buy' as const,
          tokenAddress: bestTarget.address,
          tokenSymbol: bestTarget.symbol,
          amount: positionSize.toFixed(4),
          confidence,
          reason: `DCA buy: ${bestTarget.symbol} ${bestTarget.discount > 0 ? `${bestTarget.discount.toFixed(1)}% below ${bestTarget.tfLabel} avg` : 'at current price'}`,
          strategy: 'DCA' as const,
          metadata: { dcaTarget: bestTarget.symbol, discount: bestTarget.discount, timeframe: bestTarget.tfLabel },
        };
      }
    }

    return null;
  },
};

// ─── Grid Strategy ──────────────────────────────────────────────────────────
// Range-bound trading: buy at support levels, sell at resistance levels.
// Timeframe: 4h (range definition) + 1h (current position) + 5m (entry stabilization)

const gridStrategy: Strategy = {
  name: 'GRID',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];

    for (const market of markets) {
      if (isTokenTooNew(market)) continue;

      const m4h = market.metrics['4h'];
      const m1h = market.metrics['1h'];
      const m5m = market.metrics['5m'];
      if (!m1h || !m5m) continue;
      if (market.volume24h < 1000) continue;

      // Use 4h for range definition if available, fallback to 1h
      const rangeTf = m4h || m1h;
      const rangeLabel = m4h ? '4h' : '1h';
      const pricePosition = rangeTf.priceChange;

      // Buy near bottom of range (support zone)
      if (pricePosition < -4 && m5m.priceChange > -1) {
        const confidence = Math.min(85, Math.round(55 + Math.abs(pricePosition) * 3));
        if (confidence >= riskParams.minConfidence) {
          const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct;
          const positionSize = getSafePositionSize(agent, rawPositionSize);
          if (positionSize <= 0) continue;
          return {
            action: 'buy' as const,
            tokenAddress: market.token,
            tokenSymbol: market.symbol,
            amount: positionSize.toFixed(4),
            confidence,
            reason: `Grid buy zone: ${market.symbol} near ${rangeLabel} low (${pricePosition.toFixed(1)}%), 5m stabilizing at ${m5m.priceChange > 0 ? '+' : ''}${m5m.priceChange.toFixed(1)}%`,
            strategy: 'GRID' as const,
            metadata: { gridPosition: 'support', priceChange: pricePosition, rangeTimeframe: rangeLabel },
          };
        }
      }

      // Sell near top of range (resistance zone)
      if (pricePosition > 6 && m5m.priceChange < 1) {
        const confidence = Math.min(85, Math.round(55 + pricePosition * 2.5));
        if (confidence >= riskParams.minConfidence) {
          const holdingBalance = getHoldingBalance(agent, market.token);
          if (holdingBalance <= 0) continue;
          return {
            action: 'sell' as const,
            tokenAddress: market.token,
            tokenSymbol: market.symbol,
            amount: holdingBalance.toFixed(4),
            confidence,
            reason: `Grid sell zone: ${market.symbol} near ${rangeLabel} high (+${pricePosition.toFixed(1)}%), momentum fading`,
            strategy: 'GRID' as const,
            metadata: { gridPosition: 'resistance', priceChange: pricePosition, rangeTimeframe: rangeLabel },
          };
        }
      }
    }

    return null;
  },
};

// ─── Hedge Strategy ─────────────────────────────────────────────────────────
// Risk mitigation: move capital to stablecoins when market conditions
// are unfavorable. Buy back when conditions improve.
// Timeframe: 4h (trend direction) + 1h (confirmation). Hedge = macro view.

const STABLECOIN_ADDRESSES: Record<string, string> = {
  USDC: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
  USDT0: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
  aUSD: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
};

const hedgeStrategy: Strategy = {
  name: 'HEDGE',
  evaluate(agent, markets) {
    const riskParams = RISK_PARAMS[agent.riskLevel];

    // Assess overall market sentiment from non-stablecoin tokens
    const tradableMarkets = markets.filter(
      m => !['USDC', 'USDT', 'USDT0', 'aUSD', 'AUSD', 'earnAUSD'].includes(m.symbol)
    );
    if (tradableMarkets.length === 0) return null;

    // Use 4h for broad trend assessment, 1h for confirmation
    const avgChange4h = tradableMarkets.reduce((sum, m) => {
      return sum + (m.metrics['4h']?.priceChange || 0);
    }, 0) / tradableMarkets.length;

    const avgChange1h = tradableMarkets.reduce((sum, m) => {
      return sum + (m.metrics['1h']?.priceChange || 0);
    }, 0) / tradableMarkets.length;

    // Use 4h as primary if available, fallback to 1h
    const has4h = tradableMarkets.some(m => m.metrics['4h']);
    const primaryAvg = has4h ? avgChange4h : avgChange1h;
    const confirmAvg = avgChange1h;
    const primaryLabel = has4h ? '4h' : '1h';

    // HEDGE to stablecoins: market broadly declining
    // 4h down >5% AND 1h confirming downtrend (< -1%)
    if (primaryAvg < -5 && confirmAvg < -1) {
      const severity = Math.abs(primaryAvg);
      const confidence = Math.min(90, Math.round(55 + severity * 3));
      if (confidence >= riskParams.minConfidence) {
        const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct * 1.5;
        const positionSize = getSafePositionSize(agent, rawPositionSize);
        if (positionSize <= 0) return null;
        return {
          action: 'buy' as const,
          tokenAddress: STABLECOIN_ADDRESSES.USDC,
          tokenSymbol: 'USDC',
          amount: positionSize.toFixed(4),
          confidence,
          reason: `Market hedge: avg ${primaryLabel} change ${primaryAvg.toFixed(1)}%, 1h ${avgChange1h.toFixed(1)}% — moving to USDC`,
          strategy: 'HEDGE' as const,
          metadata: { avgChange4h, avgChange1h, marketSentiment: 'bearish' },
        };
      }
    }

    // EXIT hedge: market recovering
    // 4h turning positive AND 1h confirming recovery
    if (primaryAvg > 3 && confirmAvg > 0.5) {
      const strength = primaryAvg;
      const confidence = Math.min(85, Math.round(50 + strength * 4));
      if (confidence >= riskParams.minConfidence) {
        const rawPositionSize = agent.totalCapital * riskParams.maxPositionPct;
        const positionSize = getSafePositionSize(agent, rawPositionSize);
        if (positionSize <= 0) return null;
        // Buy the strongest recovering token (use 4h recovery for broader view)
        const recoveryKey = has4h ? '4h' : '1h';
        const bestRecovery = tradableMarkets.reduce((best, m) =>
          (m.metrics[recoveryKey]?.priceChange || 0) > (best.metrics[recoveryKey]?.priceChange || 0) ? m : best
        );
        return {
          action: 'buy' as const,
          tokenAddress: bestRecovery.token,
          tokenSymbol: bestRecovery.symbol,
          amount: positionSize.toFixed(4),
          confidence,
          reason: `Hedge exit: market recovering (avg ${primaryLabel} +${primaryAvg.toFixed(1)}%), re-entering ${bestRecovery.symbol}`,
          strategy: 'HEDGE' as const,
          metadata: { avgChange4h, avgChange1h, marketSentiment: 'recovering' },
        };
      }
    }

    return null;
  },
};

// ─── Strategy Registry ──────────────────────────────────────────────────────

const STRATEGY_REGISTRY: Record<StrategyType, Strategy> = {
  MOMENTUM: momentumStrategy,
  YIELD: yieldStrategy,
  ARBITRAGE: arbitrageStrategy,
  DCA: dcaStrategy,
  GRID: gridStrategy,
  HEDGE: hedgeStrategy,
};

export function getStrategy(type: StrategyType): Strategy {
  const strategy = STRATEGY_REGISTRY[type];
  if (!strategy) {
    throw new Error(`Unknown strategy: ${type}`);
  }
  return strategy;
}

export function getAvailableStrategies(): StrategyType[] {
  return Object.keys(STRATEGY_REGISTRY) as StrategyType[];
}

// ─── Market Data Fetcher ────────────────────────────────────────────────────

/**
 * Fetch market snapshots for a list of token addresses.
 * Combines getMarketData + getTokenMetrics + Lens on-chain data into a unified snapshot.
 * Accepts optional discoveredTokens for anti-sniping metadata (createdAtBlock).
 */
export async function fetchMarketSnapshots(
  tokenAddresses: string[],
  discoveredTokens?: Array<{ address: string; createdAtBlock?: number }>,
): Promise<MarketSnapshot[]> {
  const snapshots: MarketSnapshot[] = [];

  // Set up Lens client for on-chain bonding curve queries
  const { network } = getNetworkConfig();
  const contracts = CONTRACTS[network];
  const rpcUrl = getRpcUrl(network);
  const chain = network === 'mainnet'
    ? (await import('@/config/chains')).monadMainnet
    : (await import('@/config/chains')).monadTestnet;
  const publicClient = createTimeoutPublicClient(chain, rpcUrl, 8000);

  // Build creation block lookup and get latest block for anti-sniping
  const creationBlockMap = new Map<string, number>();
  if (discoveredTokens) {
    for (const dt of discoveredTokens) {
      if (dt.createdAtBlock) {
        creationBlockMap.set(dt.address.toLowerCase(), dt.createdAtBlock);
      }
    }
  }
  const currentBlock = creationBlockMap.size > 0
    ? Number(await publicClient.getBlockNumber().catch(() => 0n))
    : 0;

  const results = await Promise.allSettled(
    tokenAddresses.map(async (addr) => {
      const [marketData, metricsData, onChainData] = await Promise.all([
        getMarketData(addr),
        getTokenMetrics(addr, ['5m', '1h', '4h']),
        // Fetch bonding curve data from Lens
        fetchLensData(addr as Address, contracts.LENS, publicClient),
      ]);

      const metrics: MarketSnapshot['metrics'] = {};
      for (const [tf, data] of Object.entries(metricsData.metrics)) {
        metrics[tf] = {
          priceChange: parseFloat(data.priceChange) || 0,
          volumeChange: parseFloat(data.volumeChange) || 0,
          txCount: data.txCount || 0,
        };
      }

      return {
        token: addr,
        symbol: '',
        price: parseFloat(marketData.price) || 0,
        priceUsd: parseFloat(marketData.priceUsd) || 0,
        volume24h: parseFloat(marketData.volume24h) || 0,
        holders: marketData.holders || 0,
        marketCap: parseFloat(marketData.marketCap) || 0,
        liquidity: parseFloat(marketData.liquidity) || 0,
        metrics,
        bondingCurveProgress: onChainData.progress,
        isGraduated: onChainData.isGraduated,
        isLocked: onChainData.isLocked,
        createdAtBlock: creationBlockMap.get(addr.toLowerCase()),
        latestBlock: currentBlock || undefined,
      };
    })
  );

  // Resolve symbol names from known tokens
  const knownTokensByAddr = new Map<string, string>();
  for (const [symbol, info] of Object.entries(MONAD_TOKENS)) {
    knownTokensByAddr.set(info.address.toLowerCase(), symbol);
  }

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const snapshot = result.value;
      snapshot.symbol = knownTokensByAddr.get(snapshot.token.toLowerCase()) || 'UNKNOWN';
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

// ─── Lens On-Chain Data Fetcher ─────────────────────────────────────────────

/**
 * Fetch bonding curve data from Lens contract for a single token.
 */
async function fetchLensData(
  tokenAddress: Address,
  lensAddress: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any
): Promise<{ progress: number; isGraduated: boolean; isLocked: boolean }> {
  const [progress, isGraduated, isLocked] = await Promise.all([
    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'getProgress',
      args: [tokenAddress],
    }).catch(() => BigInt(0)),
    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'isGraduated',
      args: [tokenAddress],
    }).catch(() => false),
    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'isLocked',
      args: [tokenAddress],
    }).catch(() => false),
  ]);

  return {
    progress: Number(progress),
    isGraduated: Boolean(isGraduated),
    isLocked: Boolean(isLocked),
  };
}

// ─── Main Engine ────────────────────────────────────────────────────────────

/**
 * Evaluate a strategy for an agent and optionally create a trade proposal.
 *
 * @param agent - Agent context (from Prisma)
 * @param tokenAddresses - Token addresses to analyze
 * @param autoPropose - If true, automatically creates a TradeProposal via OpenClaw
 * @returns Evaluation result with signal and optional proposal ID
 */
export async function evaluateStrategy(
  agent: AgentContext,
  tokenAddresses: string[],
  autoPropose = true,
  discoveredTokens?: Array<{ address: string; createdAtBlock?: number }>,
): Promise<EvaluationResult> {
  const strategy = getStrategy(agent.strategy);
  const riskParams = RISK_PARAMS[agent.riskLevel];

  // Check drawdown safety stop
  if (agent.maxDrawdown > riskParams.maxDrawdownLimit) {
    return {
      agentId: agent.id,
      strategy: agent.strategy,
      signal: null,
      evaluatedAt: new Date().toISOString(),
      tokensAnalyzed: 0,
      reasoning: `Trading halted: max drawdown ${(agent.maxDrawdown * 100).toFixed(1)}% exceeds ${agent.riskLevel} limit of ${(riskParams.maxDrawdownLimit * 100).toFixed(0)}%`,
    };
  }

  // Fetch market data (with anti-sniping metadata if available)
  const markets = await fetchMarketSnapshots(tokenAddresses, discoveredTokens);

  if (markets.length === 0) {
    return {
      agentId: agent.id,
      strategy: agent.strategy,
      signal: null,
      evaluatedAt: new Date().toISOString(),
      tokensAnalyzed: 0,
      reasoning: 'No market data available for analyzed tokens',
    };
  }

  // Evaluate strategy
  const signal = strategy.evaluate(agent, markets);

  // AI-enhance the signal if one was generated
  let aiReasoning = '';
  if (signal) {
    try {
      const aiResult = await analyzeSignal(signal, markets, agent);
      signal.confidence = aiResult.adjustedConfidence;
      aiReasoning = aiResult.aiUsed
        ? ` [AI ${aiResult.provider}: ${aiResult.aiReasoning}]`
        : '';
    } catch {
      // AI advisor failure is non-blocking
    }
  }

  const result: EvaluationResult = {
    agentId: agent.id,
    strategy: agent.strategy,
    signal,
    evaluatedAt: new Date().toISOString(),
    tokensAnalyzed: markets.length,
    reasoning: signal
      ? `Signal generated: ${signal.action} ${signal.tokenSymbol} — ${signal.reason}${aiReasoning}`
      : `No actionable signal found across ${markets.length} tokens for ${agent.strategy} strategy`,
  };

  // Auto-propose via OpenClaw if signal is strong enough
  if (signal && autoPropose && signal.confidence >= riskParams.minConfidence) {
    try {
      const proposalParams: CreateProposalParams = {
        agentId: agent.id,
        tokenAddress: signal.tokenAddress,
        amount: signal.amount,
        action: signal.action,
        slippageBps: riskParams.slippageBps,
        proposedBy: `strategy-engine:${agent.strategy}`,
        quoteData: {
          confidence: signal.confidence,
          reason: signal.reason,
          strategy: signal.strategy,
          ...(signal.metadata || {}),
        },
      };

      const proposal = await createTradeProposal(proposalParams);
      result.proposalId = proposal.id;
      result.reasoning += ` → Proposal created (${proposal.id}), awaiting human approval`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.reasoning += ` → Failed to create proposal: ${msg}`;
    }
  }

  return result;
}

// ─── Default Token List for Evaluation ──────────────────────────────────────

// ─── Stablecoin symbols to exclude from default evaluation ────────────────
const STABLECOIN_SYMBOLS = new Set([
  'MON', 'USDC', 'USDT', 'USDT0', 'AUSD', 'IDRX', 'USD*', 'USD1',
  'EARNAUSD', 'SAUSD', 'SUUSD', 'SYZUSD', 'WSRUSD', 'LVUSD', 'YZUSD', 'THBILL',
]);

/**
 * Get the default list of token addresses to evaluate.
 * Excludes stablecoins, yield stablecoins, and native MON (zero address).
 */
export function getDefaultEvaluationTokens(): string[] {
  return Object.entries(MONAD_TOKENS)
    .filter(([symbol]) => !STABLECOIN_SYMBOLS.has(symbol))
    .map(([, info]) => info.address);
}
