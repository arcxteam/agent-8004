/**
 * AI Advisor — AI-Enhanced Trading Signal Analysis (Orchestrated Multi-Model)
 *
 * Inspired by TradingAgents framework (multi-analyst, bull/bear debate).
 * Enriches rule-based strategy signals with deep AI analysis.
 * 3-tier orchestrated fallback: Cloudflare → GLM-4.7 (z.ai) → Vikey.
 * ALL 3 providers support function calling (tools) for full orchestration.
 *
 * Enhanced Flow (TradingAgents-inspired):
 *   1. Strategy engine produces a math-based TradeSignal
 *   2. AI advisor receives signal + market context + portfolio state
 *   3. AI can call tools (function calling):
 *      - get_bonding_curve_status: Bonding curve intelligence
 *      - get_token_market_data: Price/volume/holders
 *      - check_risk_assessment: Risk limit validation
 *      - get_price_quote: Trade execution quote
 *      - get_technical_analysis: FULL technical indicators (SMA, EMA, RSI, MACD, Bollinger, ATR)
 *   4. AI performs bull/bear debate analysis:
 *      - BULLISH case: Why this trade could succeed
 *      - BEARISH case: What risks/red flags exist
 *      - VERDICT: Synthesized decision with adjusted confidence
 *   5. Enhanced signal used for proposal creation
 *
 * Function Calling: Supported on ALL 3 providers via OpenAI-compatible tools parameter.
 *   - Provider #1: Cloudflare (@cf/meta/llama-3.3-70b-instruct-fp8-fast) — free 10k neurons/day
 *   - Provider #2: GLM-4.7 (z.ai) — advanced reasoning model
 *   - Provider #3: Vikey (gemma-3-27b-instruct) — backup with tools
 *
 * If all AI providers fail, the original signal passes through unchanged.
 */

import type { TradeSignal, MarketSnapshot, AgentContext } from './strategy-engine';
import { analyzeTechnical, formatTechnicalReport, type Candle } from './technical-indicators';
import {
  getRelevantMemories,
  formatMemoriesForPrompt,
  buildCurrentSituation,
  getTradeStats,
} from './trade-memory';

interface AIAdvisorResult {
  adjustedConfidence: number;
  aiReasoning: string;
  aiUsed: boolean;
  provider?: string;
  toolsUsed?: string[];
  riskManagerUsed?: boolean;
  riskManagerVerdict?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[];
}

export interface CallAIOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  tools?: ToolDefinition[];
}

// ─── Function Calling Types ──────────────────────────────────────────────────

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Trading Tools for Function Calling ──────────────────────────────────────

const TRADING_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_bonding_curve_status',
      description: 'Get bonding curve progress, graduation status, and lock status for a nad.fun token. Progress is 0-10000 basis points (100 = 1%). Graduation happens around 400K MON raised.',
      parameters: {
        type: 'object',
        properties: {
          token_address: {
            type: 'string',
            description: 'The token contract address (0x...)',
          },
        },
        required: ['token_address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_token_market_data',
      description: 'Get current market data for a token: price in USD, 24h volume, holder count, market cap, and liquidity.',
      parameters: {
        type: 'object',
        properties: {
          token_address: {
            type: 'string',
            description: 'The token contract address (0x...)',
          },
        },
        required: ['token_address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_risk_assessment',
      description: 'Check if a proposed trade passes risk limits for the agent. Returns ok/blocked with reason.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Trade action',
            enum: ['buy', 'sell'],
          },
          amount_mon: {
            type: 'string',
            description: 'Trade amount in MON',
          },
        },
        required: ['action', 'amount_mon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_price_quote',
      description: 'Get a price quote from nad.fun. Returns expected output amount and which router (BondingCurve vs Dex) would be used.',
      parameters: {
        type: 'object',
        properties: {
          token_address: {
            type: 'string',
            description: 'The token contract address (0x...)',
          },
          amount_mon: {
            type: 'string',
            description: 'Amount in MON to buy or amount of tokens to sell',
          },
          is_buy: {
            type: 'string',
            description: 'true for buy quote, false for sell quote',
            enum: ['true', 'false'],
          },
        },
        required: ['token_address', 'amount_mon', 'is_buy'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_technical_analysis',
      description: 'Run full technical analysis on a token using OHLCV chart data. Returns comprehensive indicators: SMA(10/50), EMA(10), RSI(14), MACD with signal line & histogram, Bollinger Bands (20,2), ATR(14), VWMA(20), volume trend, plus bullish/bearish signal summary. Uses 5-minute candles. IMPORTANT: Call this tool to get deeper market insights before making your final assessment.',
      parameters: {
        type: 'object',
        properties: {
          token_address: {
            type: 'string',
            description: 'The token contract address (0x...)',
          },
        },
        required: ['token_address'],
      },
    },
  },
];

/**
 * Execute a tool call and return the result string.
 * Uses cached market data from the evaluation context when available.
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, string>,
  context: { markets: MarketSnapshot[]; agent: AgentContext }
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_bonding_curve_status': {
        const addr = args.token_address?.toLowerCase();
        const market = context.markets.find(m => m.token.toLowerCase() === addr);
        if (market) {
          return JSON.stringify({
            progress: market.bondingCurveProgress,
            progressPercent: (market.bondingCurveProgress / 100).toFixed(1) + '%',
            isGraduated: market.isGraduated,
            isLocked: market.isLocked,
          });
        }
        return JSON.stringify({ error: 'Token not found in current market data' });
      }

      case 'get_token_market_data': {
        const addr = args.token_address?.toLowerCase();
        const market = context.markets.find(m => m.token.toLowerCase() === addr);
        if (market) {
          return JSON.stringify({
            symbol: market.symbol,
            priceUsd: market.priceUsd,
            volume24h: market.volume24h,
            holders: market.holders,
            marketCap: market.marketCap,
            liquidity: market.liquidity,
            metrics: market.metrics,
          });
        }
        // Fallback: query API
        const { getMarketData } = await import('./nadfun-api');
        const data = await getMarketData(args.token_address);
        return JSON.stringify(data);
      }

      case 'check_risk_assessment': {
        const { checkRiskLimits } = await import('./risk-guard');
        const result = await checkRiskLimits(
          {
            id: context.agent.id,
            maxDrawdown: context.agent.maxDrawdown,
            totalCapital: context.agent.totalCapital,
            dailyLossLimit: context.agent.dailyLossLimit ?? 10,
            maxDailyTrades: context.agent.maxDailyTrades ?? 50,
            riskLevel: context.agent.riskLevel,
          },
          {
            action: args.action as 'buy' | 'sell',
            amount: args.amount_mon,
            tokenAddress: '0x0',
          }
        );
        return JSON.stringify(result);
      }

      case 'get_price_quote': {
        const addr = args.token_address?.toLowerCase();
        const market = context.markets.find(m => m.token.toLowerCase() === addr);
        if (market) {
          return JSON.stringify({
            token: args.token_address,
            priceUsd: market.priceUsd,
            isBuy: args.is_buy === 'true',
            liquidity: market.liquidity,
            bondingCurveProgress: market.bondingCurveProgress,
          });
        }
        return JSON.stringify({ error: 'Token not found in current market data' });
      }

      case 'get_technical_analysis': {
        // Fetch OHLCV chart data from multi-source aggregator and compute full technical indicators
        // Sources: nad.fun → GeckoTerminal → DexScreener (automatic fallback)
        const tokenAddr = args.token_address;
        try {
          const { getChartDataMultiSource } = await import('./chart-aggregator');
          // Fetch 60 candles of 5m resolution (5 hours of data)
          const chartResult = await getChartDataMultiSource(tokenAddr, '5m', 60);

          if (!chartResult.candles || chartResult.candles.length < 15) {
            return JSON.stringify({
              error: 'Insufficient chart data for technical analysis',
              candlesAvailable: chartResult.candles?.length || 0,
            });
          }

          // Candles already typed from chart-aggregator
          const candles = chartResult.candles;

          const market = context.markets.find(m => m.token.toLowerCase() === tokenAddr.toLowerCase());
          const symbol = chartResult.tokenSymbol || market?.symbol || 'TOKEN';

          const report = analyzeTechnical(candles);
          const reportStr = formatTechnicalReport(report, symbol);
          // Append data source info
          return reportStr + `\n\nData Source: ${chartResult.source}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Chart data fetch failed';
          return JSON.stringify({ error: `Technical analysis failed: ${msg}` });
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tool execution failed';
    return JSON.stringify({ error: msg });
  }
}

/**
 * Call AI model with 3-tier orchestrated fallback (Cloudflare → GLM-4.7 → Vikey).
 * ALL providers support function calling (tools) for full AI orchestration.
 * Each provider receives the same tools parameter and can invoke tool_calls.
 * Shared across A2A chat, AI advisor, and any future AI consumers.
 */
export async function callAI(
  messages: ChatMessage[],
  options?: CallAIOptions,
): Promise<{ content: string; provider: string; toolCalls?: ToolCall[] } | null> {
  const maxTokens = options?.maxTokens ?? 200;
  const temperature = options?.temperature ?? 0.3;
  const timeoutMs = options?.timeoutMs ?? 10000;
  const tools = options?.tools;

  // ─── Provider #1: Cloudflare AI (function calling supported) ──────────────
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfApiToken = process.env.CF_API_TOKEN;
  const cfModel = process.env.CF_AI_MODEL;

  if (cfAccountId && cfApiToken && cfModel) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: cfModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfApiToken}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const choice = data.choices?.[0]?.message;
        const content = (choice?.content || '').trim();
        const toolCalls = choice?.tool_calls as ToolCall[] | undefined;

        if (toolCalls && toolCalls.length > 0) {
          return { content, provider: 'cloudflare', toolCalls };
        }
        if (content) {
          return { content, provider: 'cloudflare' };
        }
      }
    } catch {
      // Fall through to GLM-4.7
    }
  }

  // ─── Provider #2: GLM-4.7 / z.ai (function calling supported) ──────────────
  const zaiUrl = process.env.ZAI_API_URL;
  const zaiKey = process.env.ZAI_API_KEY;
  const zaiModel = process.env.ZAI_MODEL;

  if (zaiUrl && zaiKey && zaiModel) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: zaiModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const res = await fetch(zaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${zaiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = await res.json();
        const choice = data.choices?.[0]?.message;
        const content = (choice?.content || '').trim();
        const toolCalls = choice?.tool_calls as ToolCall[] | undefined;

        if (toolCalls && toolCalls.length > 0) {
          return { content, provider: 'glm-4.7', toolCalls };
        }
        if (content) {
          return { content, provider: 'glm-4.7' };
        }
      }
    } catch {
      // Fall through to Vikey
    }
  }

  // ─── Provider #3: Vikey API (function calling supported) ──────────────────
  const vikeyUrl = process.env.VIKEY_API_URL;
  const vikeyKey = process.env.VIKEY_API_KEY;
  const vikeyModel = process.env.VIKEY_MODEL;

  if (vikeyUrl && vikeyKey && vikeyModel) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: vikeyModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const res = await fetch(vikeyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vikeyKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = await res.json();
        const choice = data.choices?.[0]?.message;
        const content = (choice?.content || '').trim();
        const toolCalls = choice?.tool_calls as ToolCall[] | undefined;

        if (toolCalls && toolCalls.length > 0) {
          return { content, provider: 'vikey', toolCalls };
        }
        if (content) {
          return { content, provider: 'vikey' };
        }
      }
    } catch {
      // All providers failed
    }
  }

  return null;
}

/**
 * Build a comprehensive market context summary for the AI.
 * Includes portfolio state, holdings, and all available market data.
 */
function buildMarketContext(signal: TradeSignal, markets: MarketSnapshot[], agent: AgentContext): string {
  const market = markets.find(m => m.token.toLowerCase() === signal.tokenAddress.toLowerCase());

  const lines: string[] = [];

  lines.push('═══ TRADE SIGNAL UNDER REVIEW ═══');
  lines.push(`Action: ${signal.action.toUpperCase()} ${signal.tokenSymbol}`);
  lines.push(`Token: ${signal.tokenAddress}`);
  lines.push(`Amount: ${signal.amount} MON`);
  lines.push(`Strategy: ${signal.strategy}`);
  lines.push(`Rule-based Confidence: ${signal.confidence}/100`);
  lines.push(`Reason: ${signal.reason}`);

  lines.push('');
  lines.push('═══ AGENT PORTFOLIO STATE ═══');
  lines.push(`Risk Level: ${agent.riskLevel.toUpperCase()}`);
  lines.push(`Total Capital: ${agent.totalCapital.toFixed(2)} MON`);
  lines.push(`Current PnL: ${agent.totalPnl >= 0 ? '+' : ''}${agent.totalPnl.toFixed(4)} MON (${agent.totalCapital > 0 ? ((agent.totalPnl / agent.totalCapital) * 100).toFixed(2) : '0'}%)`);
  lines.push(`Max Drawdown: ${(agent.maxDrawdown * 100).toFixed(1)}%`);
  if (agent.walletBalance !== undefined) {
    lines.push(`Wallet Balance: ${agent.walletBalance.toFixed(4)} MON`);
  }
  if (agent.holdings && agent.holdings.length > 0) {
    lines.push(`Active Positions: ${agent.holdings.length}`);
    for (const h of agent.holdings.slice(0, 5)) {
      lines.push(`  - ${h.symbol}: ${h.balance} tokens ($${h.value})`);
    }
  }

  if (market) {
    lines.push('');
    lines.push(`═══ MARKET DATA: ${signal.tokenSymbol} ═══`);
    lines.push(`Price: $${market.priceUsd.toFixed(6)}`);
    lines.push(`24h Volume: $${market.volume24h.toFixed(2)}`);
    lines.push(`Holders: ${market.holders}`);
    lines.push(`Market Cap: $${market.marketCap.toFixed(2)}`);
    lines.push(`Liquidity: $${market.liquidity.toFixed(2)}`);

    if (!market.isGraduated && market.bondingCurveProgress > 0) {
      lines.push('');
      lines.push('── Bonding Curve ──');
      lines.push(`Progress: ${(market.bondingCurveProgress / 100).toFixed(1)}%`);
      lines.push(`Graduated: ${market.isGraduated}`);
      lines.push(`Locked: ${market.isLocked}`);
    }

    lines.push('');
    lines.push('── Price Metrics by Timeframe ──');
    for (const [tf, data] of Object.entries(market.metrics)) {
      lines.push(`${tf}: price ${data.priceChange > 0 ? '+' : ''}${data.priceChange.toFixed(2)}%, vol ${data.volumeChange > 0 ? '+' : ''}${data.volumeChange.toFixed(2)}%, ${data.txCount} txs`);
    }
  }

  // Broader market context (other tokens performance)
  const otherMarkets = markets.filter(m => m.token.toLowerCase() !== signal.tokenAddress.toLowerCase());
  if (otherMarkets.length > 0) {
    const avgChange1h = otherMarkets.reduce((s, m) => s + (m.metrics['1h']?.priceChange || 0), 0) / otherMarkets.length;
    lines.push('');
    lines.push('── Broader Market Context ──');
    lines.push(`Other tokens avg 1h change: ${avgChange1h > 0 ? '+' : ''}${avgChange1h.toFixed(2)}%`);
    lines.push(`Tokens analyzed: ${markets.length}`);
  }

  lines.push('');
  lines.push('IMPORTANT: Call get_technical_analysis with the token address to get SMA, EMA, RSI, MACD, Bollinger Bands, and ATR indicators before making your assessment.');

  return lines.join('\n');
}

/**
 * Build past memory context for AI prompt injection.
 * Retrieves similar past trade situations and formats them as lessons.
 */
async function buildMemoryContext(
  agentId: string,
  signal: TradeSignal,
  market: MarketSnapshot | undefined,
): Promise<string> {
  try {
    // Build current situation descriptor for memory retrieval
    const currentSituation = buildCurrentSituation(
      signal.action,
      signal.tokenSymbol,
      signal.strategy,
      signal.confidence,
      'medium', // will be overridden by actual risk level in context
      market?.metrics,
    );

    // Retrieve similar past trade memories (max 3)
    const memories = await getRelevantMemories(agentId, currentSituation, 3);
    if (memories.length === 0) return '';

    return '\n\n' + formatMemoriesForPrompt(memories);
  } catch {
    return '';
  }
}

/**
 * Build trade statistics summary for AI context.
 */
async function buildStatsContext(agentId: string): Promise<string> {
  try {
    const stats = await getTradeStats(agentId);
    if (stats.totalTrades === 0) return '';

    const lines: string[] = [];
    lines.push('');
    lines.push('═══ AGENT TRADE HISTORY ═══');
    lines.push(`Total Trades: ${stats.totalTrades} (${stats.wins}W / ${stats.losses}L)`);
    lines.push(`Win Rate: ${stats.winRate.toFixed(0)}%`);
    lines.push(`Avg PnL per Trade: $${stats.avgPnl.toFixed(4)}`);
    lines.push(`Recent Streak: ${stats.recentStreak}`);

    if (stats.recentStreak === 'losing') {
      lines.push('WARNING: Agent is on a losing streak. Be more conservative with confidence scores.');
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}

// ─── Investment Plan Context ────────────────────────────────────────────────

/**
 * Investment plan categories for portfolio allocation.
 * Groups tokens by sector for rebalancing awareness.
 */
const TOKEN_SECTORS: Record<string, string> = {
  MON: 'native', WMON: 'native',
  USDC: 'stablecoin', USDT0: 'stablecoin', AUSD: 'stablecoin', IDRX: 'stablecoin',
  EARNAUSD: 'yield-stable', SAUSD: 'yield-stable', SUUSD: 'yield-stable',
  WETH: 'eth', WSTETH: 'eth-yield', WEETH: 'eth-yield', EZETH: 'eth-yield', PUFETH: 'eth-yield',
  WBTC: 'btc', LBTC: 'btc', SOLVBTC: 'btc',
  APRMON: 'mon-lst', GMON: 'mon-lst', SMON: 'mon-lst', SHMON: 'mon-lst', EARNMON: 'mon-lst',
  CHOG: 'memecoin', APR: 'defi', CAKE: 'defi', DUST: 'defi',
  SOL: 'cross-chain',
};

/**
 * Target allocation ranges per strategy.
 * Format: { sector: [minPercent, maxPercent] }
 */
const STRATEGY_ALLOCATION: Record<string, Record<string, [number, number]>> = {
  MOMENTUM: {
    'native': [20, 40], 'mon-lst': [10, 25], 'eth': [5, 15], 'btc': [5, 15],
    'stablecoin': [10, 30], 'defi': [5, 15], 'memecoin': [0, 10],
  },
  YIELD: {
    'native': [5, 15], 'mon-lst': [25, 45], 'yield-stable': [20, 35], 'eth-yield': [10, 25],
    'stablecoin': [10, 20], 'eth': [0, 10], 'btc': [0, 10],
  },
  ARBITRAGE: {
    'native': [30, 50], 'stablecoin': [20, 40], 'mon-lst': [5, 15],
    'eth': [5, 15], 'btc': [5, 10],
  },
  DCA: {
    'native': [20, 35], 'mon-lst': [15, 25], 'eth': [10, 20], 'btc': [10, 20],
    'stablecoin': [15, 25], 'eth-yield': [5, 10],
  },
  GRID: {
    'native': [25, 45], 'stablecoin': [25, 45], 'mon-lst': [5, 15],
    'eth': [5, 10], 'btc': [5, 10],
  },
  HEDGE: {
    'stablecoin': [40, 70], 'yield-stable': [15, 30], 'native': [5, 15],
    'mon-lst': [5, 15], 'eth-yield': [0, 10],
  },
};

/**
 * Build investment plan context showing current vs target allocation.
 * Helps AI decide whether a trade aligns with portfolio goals.
 */
function buildInvestmentPlanContext(
  agent: AgentContext,
  signal: TradeSignal,
): string {
  if (!agent.holdings || agent.holdings.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('═══ INVESTMENT PLAN ═══');

  // Calculate current allocation by sector
  const sectorValues: Record<string, number> = {};
  let totalValue = 0;

  for (const h of agent.holdings) {
    const val = parseFloat(h.value) || 0;
    if (val <= 0) continue;
    const sector = TOKEN_SECTORS[h.symbol.toUpperCase()] || 'other';
    sectorValues[sector] = (sectorValues[sector] || 0) + val;
    totalValue += val;
  }

  // Add MON wallet balance to native
  if (agent.walletBalance && agent.walletBalance > 0) {
    sectorValues['native'] = (sectorValues['native'] || 0) + agent.walletBalance;
    totalValue += agent.walletBalance;
  }

  if (totalValue <= 0) return '';

  // Show current allocation
  lines.push('Current Portfolio Allocation:');
  const sortedSectors = Object.entries(sectorValues).sort((a, b) => b[1] - a[1]);
  for (const [sector, val] of sortedSectors) {
    const pct = (val / totalValue * 100).toFixed(1);
    lines.push(`  ${sector}: ${pct}% ($${val.toFixed(2)})`);
  }

  // Show target ranges for this strategy
  const targets = STRATEGY_ALLOCATION[agent.strategy] || STRATEGY_ALLOCATION['MOMENTUM'];
  lines.push('');
  lines.push(`Target Ranges (${agent.strategy} strategy):`);
  for (const [sector, [min, max]] of Object.entries(targets)) {
    const current = (sectorValues[sector] || 0) / totalValue * 100;
    const status = current < min ? 'UNDER' : current > max ? 'OVER' : 'OK';
    lines.push(`  ${sector}: ${min}-${max}% (current: ${current.toFixed(1)}% → ${status})`);
  }

  // Add signal alignment note
  const targetSymbol = signal.tokenSymbol.toUpperCase();
  const targetSector = TOKEN_SECTORS[targetSymbol] || 'other';
  const targetRange = targets[targetSector];
  const currentPct = (sectorValues[targetSector] || 0) / totalValue * 100;

  lines.push('');
  if (signal.action === 'buy' && targetRange && currentPct > targetRange[1]) {
    lines.push(`WARNING: Buying ${signal.tokenSymbol} would INCREASE ${targetSector} allocation above target range (${targetRange[1]}%).`);
  } else if (signal.action === 'sell' && targetRange && currentPct < targetRange[0]) {
    lines.push(`WARNING: Selling ${signal.tokenSymbol} would DECREASE ${targetSector} allocation below target range (${targetRange[0]}%).`);
  } else {
    lines.push(`This ${signal.action.toUpperCase()} aligns with ${targetSector} allocation targets.`);
  }

  return lines.join('\n');
}

// ─── Risk Manager Agent ─────────────────────────────────────────────────────

const RISK_MANAGER_PROMPT = `You are ANOA Risk Manager — a dedicated risk assessment agent.
Your ONLY job is to evaluate whether a proposed trade should proceed from a RISK perspective.
You are NOT a market analyst. You do NOT consider upside potential. You focus purely on RISK.

Evaluate these risk factors:
1. POSITION CONCENTRATION — Is this trade making the portfolio too concentrated in one token/sector?
2. DRAWDOWN PROXIMITY — How close is the agent to its max drawdown limit? Should it reduce risk?
3. LOSING STREAK — Is the agent on a losing streak? Should it sit out?
4. VOLATILITY EXPOSURE — Is ATR/price volatility too high for this risk level?
5. PORTFOLIO ALIGNMENT — Does this trade fit the investment plan allocation targets?
6. CAPITAL ADEQUACY — Does the agent have enough capital buffer after this trade?

Respond with EXACTLY this format:
RISK_VERDICT: APPROVE | REDUCE | BLOCK
RISK_CONFIDENCE_ADJUSTMENT: <number from -30 to 0> (0 = no change, negative = reduce confidence)
RISK_REASON: <one sentence explaining your risk assessment>`;

/**
 * Run the Risk Manager AI agent in parallel with the Market Analyst.
 * Returns risk adjustment that can LOWER confidence (never increase).
 * Non-blocking — if fails, returns neutral (no adjustment).
 */
async function runRiskManagerReview(
  signal: TradeSignal,
  agent: AgentContext,
  market: MarketSnapshot | undefined,
  statsContext: string,
  investmentPlanContext: string,
): Promise<{ verdict: string; confidenceAdjustment: number; reason: string } | null> {
  try {
    const lines: string[] = [];
    lines.push(`Proposed Trade: ${signal.action.toUpperCase()} ${signal.tokenSymbol}`);
    lines.push(`Amount: ${signal.amount} MON`);
    lines.push(`Strategy Confidence: ${signal.confidence}/100`);
    lines.push(`Agent Risk Level: ${agent.riskLevel.toUpperCase()}`);
    lines.push(`Current Drawdown: ${(agent.maxDrawdown * 100).toFixed(1)}%`);
    lines.push(`Total Capital: ${agent.totalCapital.toFixed(2)} MON`);
    lines.push(`Wallet Balance: ${agent.walletBalance?.toFixed(4) || 'unknown'} MON`);

    if (market) {
      lines.push(`Token Price: $${market.priceUsd.toFixed(6)}`);
      lines.push(`24h Volume: $${market.volume24h.toFixed(2)}`);
      lines.push(`Liquidity: $${market.liquidity.toFixed(2)}`);
      const m1h = market.metrics['1h'];
      if (m1h) lines.push(`1h Price Change: ${m1h.priceChange.toFixed(2)}%`);
    }

    if (agent.holdings && agent.holdings.length > 0) {
      lines.push(`Active Positions: ${agent.holdings.length}`);
    }

    if (statsContext) lines.push(statsContext);
    if (investmentPlanContext) lines.push(investmentPlanContext);

    const result = await callAI(
      [
        { role: 'system', content: RISK_MANAGER_PROMPT },
        { role: 'user', content: lines.join('\n') },
      ],
      { maxTokens: 150, temperature: 0.2, timeoutMs: 10000 },
    );

    if (!result?.content) return null;

    const response = result.content;

    // Parse risk verdict
    const verdictMatch = response.match(/RISK_VERDICT:\s*(APPROVE|REDUCE|BLOCK)/i);
    const adjustMatch = response.match(/RISK_CONFIDENCE_ADJUSTMENT:\s*(-?\d+)/i);
    const reasonMatch = response.match(/RISK_REASON:\s*(.+)/i);

    const verdict = verdictMatch?.[1]?.toUpperCase() || 'APPROVE';
    let adjustment = parseInt(adjustMatch?.[1] || '0');
    const reason = reasonMatch?.[1]?.trim() || 'Risk assessment completed';

    // Clamp adjustment: can only reduce confidence, never increase
    adjustment = Math.max(-30, Math.min(0, adjustment));

    // BLOCK verdict forces -30 minimum adjustment
    if (verdict === 'BLOCK') adjustment = Math.min(adjustment, -25);

    return { verdict, confidenceAdjustment: adjustment, reason };
  } catch {
    return null;
  }
}

/**
 * Parse AI response to extract confidence adjustment
 */
function parseAIResponse(response: string, originalConfidence: number): { adjustedConfidence: number; reasoning: string } {
  const confidenceMatch = response.match(/confidence[:\s]*(\d+)/i);
  let adjustedConfidence = originalConfidence;

  if (confidenceMatch) {
    const aiConfidence = parseInt(confidenceMatch[1]);
    if (aiConfidence >= 0 && aiConfidence <= 100) {
      // Blend: 60% rule-based + 40% AI confidence
      adjustedConfidence = Math.round(originalConfidence * 0.6 + aiConfidence * 0.4);
    }
  } else {
    const lower = response.toLowerCase();
    if (lower.includes('strong buy') || lower.includes('high confidence') || lower.includes('bullish')) {
      adjustedConfidence = Math.min(95, originalConfidence + 10);
    } else if (lower.includes('caution') || lower.includes('risk') || lower.includes('bearish') || lower.includes('avoid')) {
      adjustedConfidence = Math.max(20, originalConfidence - 15);
    } else if (lower.includes('hold') || lower.includes('neutral') || lower.includes('wait')) {
      adjustedConfidence = Math.max(20, originalConfidence - 10);
    }
  }

  adjustedConfidence = Math.max(0, Math.min(100, adjustedConfidence));
  return { adjustedConfidence, reasoning: response };
}

/**
 * Analyze a trade signal using collaborative AI agents.
 *
 * Multi-Agent Architecture (TradingAgents-inspired):
 *   Agent 1: Market Analyst — bull/bear debate with tool calling (technical analysis)
 *   Agent 2: Risk Manager — dedicated risk assessment, can override/reduce confidence
 *   Both agents run IN PARALLEL for speed, results are combined.
 *
 * Flow:
 *   1. Gather context: market data, memory, stats, investment plan
 *   2. Run Market Analyst + Risk Manager in parallel
 *   3. Market Analyst verdict → base confidence adjustment
 *   4. Risk Manager verdict → can LOWER confidence (never increase)
 *   5. Combined final confidence = analyst confidence + risk adjustment
 *
 * Non-blocking: if AI fails, returns original signal unchanged.
 */
export async function analyzeSignal(
  signal: TradeSignal,
  markets: MarketSnapshot[],
  agent: AgentContext
): Promise<AIAdvisorResult> {
  const marketContext = buildMarketContext(signal, markets, agent);
  const toolsUsed: string[] = [];

  // Build all context in parallel
  const market = markets.find(m => m.token.toLowerCase() === signal.tokenAddress.toLowerCase());
  const [memoryContext, statsContext] = await Promise.all([
    buildMemoryContext(agent.id, signal, market),
    buildStatsContext(agent.id),
  ]);
  const investmentPlanContext = buildInvestmentPlanContext(agent, signal);

  // ─── Agent 1: Market Analyst (bull/bear debate + tool calling) ──────────
  const analystPromise = (async (): Promise<{ content: string; provider: string; tools: string[] } | null> => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are ANOA Market Analyst — an AI trading analyst on Monad blockchain.
You operate as one of multiple analytical agents (inspired by TradingAgents framework).
Your role is MARKET ANALYSIS — bull/bear debate and technical assessment.

═══ YOUR ROLE ═══
You review trade signals and provide deep market analysis.
A separate Risk Manager agent handles risk assessment independently.
Focus on MARKET SIGNALS, TECHNICALS, and TRADE QUALITY.
Do not forget to utilize lessons from past decisions.

═══ AVAILABLE TOOLS ═══
1. get_technical_analysis — ALWAYS call this first! Returns SMA, EMA, RSI, MACD, Bollinger Bands, ATR from OHLCV data.
2. get_bonding_curve_status — Check bonding curve progress for nad.fun tokens
3. get_token_market_data — Get price, volume, holders, liquidity
4. check_risk_assessment — Verify if trade passes risk limits
5. get_price_quote — Get estimated trade output

═══ ANALYSIS FRAMEWORK (REQUIRED) ═══
After gathering data from tools, structure your response as:

**TECHNICAL ANALYSIS:**
[Key indicators: trend from SMA/EMA, momentum from RSI/MACD, volatility from Bollinger/ATR]

**BULLISH CASE:**
[Supporting signals, favorable conditions]

**BEARISH CASE:**
[Risks, counter-signals, potential downsides]

**PAST LESSONS:**
[Reference relevant past trade memories if available]

**VERDICT:**
[Your market assessment. Is this a good trade from a MARKET perspective?]
Confidence: <number 0-100>

═══ KEY FACTORS ═══
- RSI > 70 on BUY = overbought risk, LOWER confidence
- RSI < 30 on SELL = oversold bounce risk, LOWER confidence
- MACD histogram positive + BUY = momentum confirmed
- Bollinger above upper band + BUY = overbought danger
- Low volume = weak conviction
- Bonding curve > 85% = pre-graduation volatility
- Broader market declining = extra caution on BUY`,
      },
      {
        role: 'user',
        content: marketContext + statsContext + investmentPlanContext + memoryContext,
      },
    ];

    const localToolsUsed: string[] = [];

    try {
      let result = await callAI(messages, {
        tools: TRADING_TOOLS,
        maxTokens: 500,
        timeoutMs: 20000,
      });

      // Handle function calling loop (max 3 rounds)
      let rounds = 0;
      while (result?.toolCalls && result.toolCalls.length > 0 && rounds < 3) {
        rounds++;
        messages.push({
          role: 'assistant',
          content: result.content || '',
          tool_calls: result.toolCalls,
        });

        for (const toolCall of result.toolCalls) {
          let parsedArgs: Record<string, string> = {};
          try { parsedArgs = JSON.parse(toolCall.function.arguments); } catch { /* empty */ }

          const toolResult = await executeToolCall(toolCall.function.name, parsedArgs, { markets, agent });
          localToolsUsed.push(toolCall.function.name);
          messages.push({ role: 'tool', content: toolResult, tool_call_id: toolCall.id });
        }

        result = await callAI(messages, {
          tools: TRADING_TOOLS,
          maxTokens: 500,
          timeoutMs: 20000,
        });
      }

      if (result?.content) {
        return { content: result.content, provider: result.provider, tools: localToolsUsed };
      }
    } catch (err) {
      console.warn('[MarketAnalyst] failed:', err);
    }
    return null;
  })();

  // ─── Agent 2: Risk Manager (parallel, no tools, fast) ──────────────────
  const riskPromise = runRiskManagerReview(signal, agent, market, statsContext, investmentPlanContext);

  // ─── Wait for both agents ──────────────────────────────────────────────
  const [analystResult, riskResult] = await Promise.all([analystPromise, riskPromise]);

  // ─── Combine results ──────────────────────────────────────────────────
  if (analystResult?.content) {
    const parsed = parseAIResponse(analystResult.content, signal.confidence);
    toolsUsed.push(...analystResult.tools);

    let finalConfidence = parsed.adjustedConfidence;
    let reasoning = parsed.reasoning;

    // Apply Risk Manager adjustment (can only lower confidence)
    if (riskResult) {
      finalConfidence = Math.max(0, finalConfidence + riskResult.confidenceAdjustment);
      reasoning += `\n\n═══ RISK MANAGER (${riskResult.verdict}) ═══\n${riskResult.reason}`;
      if (riskResult.confidenceAdjustment < 0) {
        reasoning += `\n[Risk adjustment: ${riskResult.confidenceAdjustment} → final confidence: ${finalConfidence}]`;
      }
    }

    finalConfidence = Math.max(0, Math.min(100, finalConfidence));

    return {
      adjustedConfidence: finalConfidence,
      aiReasoning: reasoning,
      aiUsed: true,
      provider: analystResult.provider,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      riskManagerUsed: !!riskResult,
      riskManagerVerdict: riskResult?.verdict,
    };
  }

  // If Market Analyst failed, check if Risk Manager alone can provide value
  if (riskResult && riskResult.verdict === 'BLOCK') {
    return {
      adjustedConfidence: Math.max(0, signal.confidence + riskResult.confidenceAdjustment),
      aiReasoning: `Market Analyst unavailable. Risk Manager: ${riskResult.verdict} — ${riskResult.reason}`,
      aiUsed: true,
      riskManagerUsed: true,
      riskManagerVerdict: riskResult.verdict,
    };
  }

  // Fallback: return original signal unchanged
  return {
    adjustedConfidence: signal.confidence,
    aiReasoning: 'AI ANOA advisor unavailable — using rule-based confidence',
    aiUsed: false,
  };
}
