/**
 * Trade Memory System — Learning from Past Trade Outcomes
 *
 * Inspired by TradingAgents framework (memory.py + reflection.py).
 * Stores trade situations + outcomes, retrieves similar past situations
 * using text similarity for AI decision-making.
 *
 * Flow:
 *   1. After trade executes → recordTradeOutcome() stores situation + result + lesson
 *   2. Before new trade → getRelevantMemories() finds similar past situations
 *   3. AI advisor receives past_memory_str with lessons learned
 *   4. AI uses these lessons to avoid repeating mistakes
 *
 * Storage: Prisma Execution records (params + result + pnl) → converted to TradeMemory
 * Retrieval: TF-IDF-like term matching (simplified BM25) on situation text
 *
 * No external dependencies — pure TypeScript.
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TradeMemory {
  /** Situation description: market context, signal, token, strategy */
  situation: string;
  /** Action taken: buy/sell + token + amount */
  action: string;
  /** Outcome: profit/loss, what happened after */
  outcome: string;
  /** Lesson extracted from this experience */
  lesson: string;
  /** When this trade happened */
  timestamp: Date;
  /** PnL in USD */
  pnlUsd: number;
  /** Was it profitable? */
  profitable: boolean;
}

interface ExecutionRecord {
  id: string;
  agentId: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  pnl: { toNumber: () => number } | number | null;
  status: string;
  executedAt: Date;
  completedAt: Date | null;
  errorMsg: string | null;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────

/** In-memory cache of trade memories per agent, loaded from DB */
const memoryCache = new Map<string, TradeMemory[]>();
const lastLoadTime = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Record a trade outcome as a memory entry.
 * Called after a trade execution completes (SUCCESS or FAILED).
 *
 * @param agentId - Agent database ID
 * @param execution - Execution record from DB
 * @param marketContext - Optional market context string at time of trade
 */
export function recordTradeOutcome(
  agentId: string,
  execution: ExecutionRecord,
  marketContext?: string
): TradeMemory {
  const params = execution.params || {};
  const result = execution.result || {};
  const pnlValue = execution.pnl
    ? (typeof execution.pnl === 'number' ? execution.pnl : execution.pnl.toNumber())
    : 0;
  const profitable = pnlValue > 0;

  // Build situation description
  const tokenAddr = params.tokenAddress || 'unknown';
  const shortAddr = `${tokenAddr.slice(0, 6)}...${tokenAddr.slice(-4)}`;
  const action = (params.action || execution.type || 'unknown').toLowerCase();
  const amount = params.amount || '0';
  const router = result.router || params.router || 'unknown';
  const slippage = params.slippageBps || 100;

  const situation = buildSituation(action, shortAddr, amount, router, marketContext);

  const actionStr = `${action.toUpperCase()} ${shortAddr} — ${amount} MON via ${router} (slippage: ${slippage}bps)`;

  const outcome = buildOutcome(execution, pnlValue, result);

  const lesson = extractLesson(action, pnlValue, profitable, execution, result);

  const memory: TradeMemory = {
    situation,
    action: actionStr,
    outcome,
    lesson,
    timestamp: execution.executedAt,
    pnlUsd: pnlValue,
    profitable,
  };

  // Add to in-memory cache
  if (!memoryCache.has(agentId)) {
    memoryCache.set(agentId, []);
  }
  const memories = memoryCache.get(agentId)!;
  memories.push(memory);

  // Keep only last 100 memories per agent
  if (memories.length > 100) {
    memoryCache.set(agentId, memories.slice(-100));
  }

  return memory;
}

/**
 * Build situation text describing the market conditions when trade happened.
 */
function buildSituation(
  action: string,
  tokenShort: string,
  amount: string,
  router: string,
  marketContext?: string,
): string {
  const parts: string[] = [];
  parts.push(`Trade ${action} on token ${tokenShort}`);
  parts.push(`Amount: ${amount} MON`);
  parts.push(`Router: ${router}`);

  if (marketContext) {
    // Extract key metrics from market context if available
    const lines = marketContext.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.includes('priceChange') || line.includes('Price:') ||
          line.includes('Volume:') || line.includes('RSI') ||
          line.includes('MACD') || line.includes('Bollinger') ||
          line.includes('confidence') || line.includes('Confidence')) {
        parts.push(line.trim());
      }
    }
  }

  return parts.join('. ');
}

/**
 * Build outcome description from execution result.
 */
function buildOutcome(execution: ExecutionRecord, pnlUsd: number, result: Record<string, unknown>): string {
  if (execution.status === 'FAILED') {
    return `FAILED — ${execution.errorMsg || 'Transaction reverted'}`;
  }

  const amountIn = result.amountIn || 'unknown';
  const amountOut = result.amountOut || 'unknown';
  const pnlStr = pnlUsd >= 0 ? `+$${pnlUsd.toFixed(4)}` : `-$${Math.abs(pnlUsd).toFixed(4)}`;

  return `SUCCESS — In: ${amountIn}, Out: ${amountOut}, PnL: ${pnlStr}`;
}

/**
 * Extract a learning lesson from the trade outcome.
 * This is the key intelligence — what should the agent learn from this trade?
 */
function extractLesson(
  action: string,
  pnlUsd: number,
  profitable: boolean,
  execution: ExecutionRecord,
  result: Record<string, unknown>,
): string {
  // Failed trade lesson
  if (execution.status === 'FAILED') {
    const error = (execution.errorMsg || '').toLowerCase();
    if (error.includes('slippage') || error.includes('insufficient output')) {
      return 'Slippage was too tight for the available liquidity. Consider increasing slippage tolerance or reducing trade size for low-liquidity tokens.';
    }
    if (error.includes('insufficient') || error.includes('balance')) {
      return 'Insufficient balance for this trade. Always verify wallet balance before proposing trades.';
    }
    if (error.includes('revert') || error.includes('execution reverted')) {
      return 'Transaction reverted on-chain. This may indicate pool issues, contract restrictions, or front-running. Be cautious with this token.';
    }
    return `Trade failed: ${execution.errorMsg || 'unknown reason'}. Verify token liquidity and contract status before retrying.`;
  }

  // Profitable trade lessons
  if (profitable) {
    if (pnlUsd > 1.0) {
      return `${action.toUpperCase()} was very profitable (+$${pnlUsd.toFixed(2)}). The market conditions and timing were favorable. Look for similar setups: strong momentum alignment across timeframes.`;
    }
    if (pnlUsd > 0.1) {
      return `${action.toUpperCase()} yielded moderate profit (+$${pnlUsd.toFixed(2)}). Strategy signal was correct. Continue applying this pattern when technical indicators align.`;
    }
    return `${action.toUpperCase()} was marginally profitable (+$${pnlUsd.toFixed(4)}). Gains were small relative to gas costs. Consider waiting for stronger signals or larger position sizes.`;
  }

  // Loss trade lessons
  if (pnlUsd < -1.0) {
    return `${action.toUpperCase()} resulted in significant loss ($${pnlUsd.toFixed(2)}). The signal may have been too aggressive or market conditions shifted. Reduce confidence for similar setups and consider tighter stop conditions.`;
  }
  if (pnlUsd < -0.1) {
    return `${action.toUpperCase()} resulted in a loss ($${pnlUsd.toFixed(2)}). Review whether RSI/MACD confirmed the signal direction. Avoid trading against strong counter-trends.`;
  }

  // Break-even
  return `${action.toUpperCase()} was roughly break-even. Gas costs may have eaten into any small gain. Only trade when confidence is high enough to overcome transaction costs.`;
}

/**
 * Load trade memories for an agent from the database.
 * Uses caching to avoid repeated DB queries.
 */
export async function loadMemories(agentId: string): Promise<TradeMemory[]> {
  const now = Date.now();
  const lastLoad = lastLoadTime.get(agentId) || 0;

  // Return cached if fresh enough
  if (now - lastLoad < CACHE_TTL_MS && memoryCache.has(agentId)) {
    return memoryCache.get(agentId)!;
  }

  try {
    // Load last 50 completed executions for this agent
    const executions = await prisma.execution.findMany({
      where: {
        agentId,
        status: { in: ['SUCCESS', 'FAILED'] },
      },
      orderBy: { executedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        agentId: true,
        type: true,
        params: true,
        result: true,
        pnl: true,
        status: true,
        executedAt: true,
        completedAt: true,
        errorMsg: true,
      },
    });

    const memories: TradeMemory[] = [];
    for (const exec of executions) {
      const memory = recordTradeOutcome(
        agentId,
        exec as unknown as ExecutionRecord,
      );
      memories.push(memory);
    }

    // Store in cache (newest first from DB, but we want chronological order)
    memories.reverse();
    memoryCache.set(agentId, memories);
    lastLoadTime.set(agentId, now);

    return memories;
  } catch (err) {
    console.warn('Failed to load trade memories:', err);
    return memoryCache.get(agentId) || [];
  }
}

/**
 * Get relevant memories for the current trading situation.
 * Uses BM25 Okapi scoring algorithm for lexical similarity matching.
 *
 * BM25 parameters:
 *   k1 = 1.5 (term frequency saturation)
 *   b = 0.75 (document length normalization)
 *
 * Equivalent to TradingAgents memory.py: BM25Okapi-based retrieval.
 *
 * @param agentId - Agent database ID
 * @param currentSituation - Description of current market situation
 * @param nMatches - Number of similar memories to return (default: 3)
 */
export async function getRelevantMemories(
  agentId: string,
  currentSituation: string,
  nMatches = 3,
): Promise<TradeMemory[]> {
  const memories = await loadMemories(agentId);

  if (memories.length === 0) return [];

  // Tokenize current situation (query)
  const queryTerms = tokenize(currentSituation);
  if (queryTerms.length === 0) return memories.slice(-nMatches);

  // BM25 Okapi parameters
  const k1 = 1.5;
  const b = 0.75;
  const totalDocs = memories.length;

  // Tokenize all documents and compute stats
  const docTermArrays: string[][] = [];
  const docFreq = new Map<string, number>(); // How many docs contain each term
  let totalDocLength = 0;

  for (const mem of memories) {
    const terms = tokenize(mem.situation + ' ' + mem.lesson + ' ' + mem.action);
    docTermArrays.push(terms);
    totalDocLength += terms.length;

    // Count unique terms per document for DF
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  const avgDocLength = totalDocs > 0 ? totalDocLength / totalDocs : 1;

  // Score each memory using BM25 Okapi
  const scored: Array<{ memory: TradeMemory; score: number }> = [];

  for (let i = 0; i < memories.length; i++) {
    const docTerms = docTermArrays[i];
    const docLength = docTerms.length;

    // Count term frequencies in this document
    const termFreq = new Map<string, number>();
    for (const t of docTerms) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }

    let score = 0;

    for (const qt of queryTerms) {
      const tf = termFreq.get(qt) || 0;
      if (tf === 0) continue;

      const df = docFreq.get(qt) || 0;

      // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

      // TF component with BM25 saturation and length normalization
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));

      score += idf * tfNorm;
    }

    // Boost recent memories (recency bias — 1 week decay)
    const ageHours = (Date.now() - memories[i].timestamp.getTime()) / (1000 * 3600);
    const recencyBoost = 1 + Math.max(0, 1 - ageHours / 168);
    score *= recencyBoost;

    // Boost unprofitable memories (learn more from mistakes)
    if (!memories[i].profitable) {
      score *= 1.3;
    }

    if (score > 0) {
      scored.push({ memory: memories[i], score });
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, nMatches).map(s => s.memory);
}

/**
 * Format memories into a string for AI prompt injection.
 * This is the `past_memory_str` that gets added to the AI advisor context.
 *
 * Equivalent to TradingAgents trader.py:
 * "Here is some reflections from similar situations you traded in
 *  and the lessons learned: {past_memory_str}"
 */
export function formatMemoriesForPrompt(memories: TradeMemory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = [];
  lines.push('═══ LESSONS FROM PAST TRADES ═══');
  lines.push('Use these lessons from similar past situations to improve your decision:');
  lines.push('');

  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    const timeAgo = formatTimeAgo(m.timestamp);
    const result = m.profitable ? 'PROFIT' : (m.pnlUsd === 0 ? 'BREAK-EVEN' : 'LOSS');

    lines.push(`── Past Trade #${i + 1} (${timeAgo}, ${result}) ──`);
    lines.push(`Action: ${m.action}`);
    lines.push(`Outcome: ${m.outcome}`);
    lines.push(`Lesson: ${m.lesson}`);
    lines.push('');
  }

  lines.push('IMPORTANT: Do not repeat past mistakes. Apply lessons learned to your current assessment.');

  return lines.join('\n');
}

/**
 * Build a situation description from current signal and market data.
 * Used to query relevant memories before making a new trade decision.
 */
export function buildCurrentSituation(
  action: string,
  tokenSymbol: string,
  strategy: string,
  confidence: number,
  riskLevel: string,
  marketMetrics?: Record<string, { priceChange: number; volumeChange: number; txCount: number }>,
): string {
  const parts: string[] = [];
  parts.push(`${action} signal for ${tokenSymbol}`);
  parts.push(`Strategy: ${strategy}`);
  parts.push(`Confidence: ${confidence}`);
  parts.push(`Risk level: ${riskLevel}`);

  if (marketMetrics) {
    for (const [tf, data] of Object.entries(marketMetrics)) {
      parts.push(`${tf}: price ${data.priceChange > 0 ? '+' : ''}${data.priceChange.toFixed(1)}%, vol ${data.volumeChange > 0 ? '+' : ''}${data.volumeChange.toFixed(1)}%`);
    }
  }

  return parts.join('. ');
}

/**
 * Get trade statistics summary for an agent.
 */
export async function getTradeStats(agentId: string): Promise<{
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  recentStreak: string; // 'winning', 'losing', 'mixed'
}> {
  const memories = await loadMemories(agentId);

  if (memories.length === 0) {
    return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0, totalPnl: 0, recentStreak: 'mixed' };
  }

  const wins = memories.filter(m => m.profitable).length;
  const losses = memories.filter(m => !m.profitable && m.pnlUsd < 0).length;
  const totalPnl = memories.reduce((s, m) => s + m.pnlUsd, 0);
  const avgPnl = totalPnl / memories.length;

  // Recent streak (last 5 trades)
  const recent = memories.slice(-5);
  const recentWins = recent.filter(m => m.profitable).length;
  let recentStreak: string;
  if (recentWins >= 4) recentStreak = 'winning';
  else if (recentWins <= 1) recentStreak = 'losing';
  else recentStreak = 'mixed';

  return {
    totalTrades: memories.length,
    wins,
    losses,
    winRate: memories.length > 0 ? (wins / memories.length) * 100 : 0,
    avgPnl,
    totalPnl,
    recentStreak,
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Tokenize text for TF-IDF matching.
 * Lowercase, split by non-alphanumeric, filter short tokens and stop words.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
    'and', 'or', 'but', 'not', 'no', 'this', 'that', 'it', 'its',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'may', 'might', 'can', 'could', 'must', 'need',
    'mon', 'via', 'bps', 'token', // domain stop words
  ]);

  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !stopWords.has(t));
}

/**
 * Format timestamp as human-readable relative time.
 */
function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Clear memory cache for an agent (e.g., when resetting).
 */
export function clearMemoryCache(agentId?: string): void {
  if (agentId) {
    memoryCache.delete(agentId);
    lastLoadTime.delete(agentId);
  } else {
    memoryCache.clear();
    lastLoadTime.clear();
  }
}

// ─── AI-Powered Reflection ──────────────────────────────────────────────────
// Inspired by TradingAgents reflection.py: Reflector class
// After trade execution, use AI to analyze what happened and generate deeper lessons.

/**
 * Generate AI-powered reflection on a completed trade.
 * Uses the 3-tier AI fallback (CF → GLM → Vikey) to analyze the trade outcome
 * and extract actionable lessons, similar to TradingAgents Reflector.
 *
 * Called asynchronously after trade completes — non-blocking.
 *
 * @param agentId - Agent database ID
 * @param memory - The trade memory to reflect on
 * @param marketContext - Optional market context string at time of trade
 */
export async function reflectOnTrade(
  agentId: string,
  memory: TradeMemory,
  marketContext?: string,
): Promise<string | null> {
  try {
    const { callAI } = await import('./ai-advisor');

    const prompt = buildReflectionPrompt(memory, marketContext);

    const result = await callAI(
      [
        { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 300, temperature: 0.3, timeoutMs: 15000 },
    );

    if (result?.content) {
      // Update the memory's lesson with AI-generated reflection
      const cached = memoryCache.get(agentId);
      if (cached) {
        const match = cached.find(m =>
          m.timestamp.getTime() === memory.timestamp.getTime() &&
          m.action === memory.action
        );
        if (match) {
          match.lesson = result.content;
        }
      }
      return result.content;
    }
  } catch {
    // AI reflection is non-blocking — rule-based lesson remains
  }
  return null;
}

const REFLECTION_SYSTEM_PROMPT = `You are an expert trading analyst reviewing a completed trade on Monad blockchain.
Your goal is to extract concise, actionable lessons from this trade outcome.

Analyze:
1. Was the trade decision correct given the market conditions?
2. What factors contributed to the outcome (positive or negative)?
3. What should the agent do differently in similar situations?

Keep your response to 2-3 sentences maximum. Be specific and actionable.
Focus on patterns that can improve future trading decisions.

Examples of good lessons:
- "BUY on RSI=72 resulted in loss. Wait for RSI<65 before buying high-momentum tokens."
- "SELL at bonding curve 88% was correctly timed. Continue pre-graduation exits above 85%."
- "Small position (0.5 MON) on low-volume token yielded negligible profit. Increase minimum position size to 2 MON."`;

function buildReflectionPrompt(memory: TradeMemory, marketContext?: string): string {
  const lines: string[] = [];
  lines.push(`Trade: ${memory.action}`);
  lines.push(`Outcome: ${memory.outcome}`);
  lines.push(`PnL: $${memory.pnlUsd.toFixed(4)}`);
  lines.push(`Result: ${memory.profitable ? 'PROFITABLE' : 'LOSS'}`);

  if (marketContext) {
    lines.push('');
    lines.push('Market conditions at time of trade:');
    // Keep only key lines from market context
    const keyLines = marketContext.split('\n').filter(l =>
      l.includes('Price:') || l.includes('RSI') || l.includes('MACD') ||
      l.includes('Volume') || l.includes('Confidence') || l.includes('Bollinger') ||
      l.includes('priceChange') || l.includes('Bonding')
    );
    lines.push(...keyLines.slice(0, 10));
  }

  lines.push('');
  lines.push('Provide a concise lesson (2-3 sentences) for the agent to improve future decisions.');

  return lines.join('\n');
}
