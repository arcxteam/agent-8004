# ANOA — AI Agent Trading Logic End-to-End

> Complete explanation of the AI trading agent pipeline: from trigger to post-trade.
> Verified line-by-line from source code — February 2026
> Total source code involved: ~6,000+ lines (20+ lib files)

---

## Table of Contents

1. [Overview: 10-Step Trading Pipeline](#overview-10-step-trading-pipeline)
2. [Library Files Map (`src/lib/`)](#library-files-map-srclib)
3. [Step 1: Trigger — Scheduler](#step-1-trigger--scheduler)
4. [Step 2: Safety Check — Drawdown & Risk Guard](#step-2-safety-check--drawdown--risk-guard)
5. [Step 3: Fetch Market Data — nad.fun API](#step-3-fetch-market-data--nadfun-api)
6. [Step 4: Strategy Evaluation — 6 Strategies](#step-4-strategy-evaluation--6-strategies)
7. [Step 5: AI Signal Enhancement — 3-Tier Fallback](#step-5-ai-signal-enhancement--3-tier-fallback)
8. [Step 6: Confidence Gate](#step-6-confidence-gate)
9. [Step 7: Trade Proposal — Human-in-the-Loop](#step-7-trade-proposal--human-in-the-loop)
10. [Step 8: Human Approval](#step-8-human-approval)
11. [Step 9: Trade Execution — 3-Router Architecture](#step-9-trade-execution--3-router-architecture)
12. [Step 10: Post-Trade Pipeline](#step-10-post-trade-pipeline)
13. [Dependency Map: File → File](#dependency-map-file--file)
14. [Token Universe](#token-universe)

---

## Overview: 10-Step Trading Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. TRIGGER                                                             │
│     POST /api/scheduler (all agents)                                    │
│     POST /api/agents/:id/evaluate (single agent)                       │
│                                                                         │
│  2. SAFETY CHECK                                                        │
│     Check drawdown vs limit (LOW 10%, MEDIUM 20%, HIGH 35%)            │
│     Risk guard: daily loss, max trades, gas reserve, position size     │
│     If exceeded → HALT, do not continue                                │
│                                                                         │
│  3. FETCH MARKET DATA                                                   │
│     nad.fun API: getMarketData() + getTokenMetrics()                   │
│     Per token: price, volume, holders, marketCap, liquidity            │
│     Per timeframe (5m, 1h, 6h, 24h): priceChange%, volumeChange, txs  │
│     Token discovery: on-chain events (CurveCreate/Buy/Sell)            │
│                                                                         │
│  4. STRATEGY EVALUATION (1 of 6)                                        │
│     MOMENTUM | YIELD | ARBITRAGE | DCA | GRID | HEDGE                  │
│     Input: agent context + market snapshots + holdings                 │
│     Output: TradeSignal {action, token, amount, confidence, reason}    │
│                                                                         │
│  5. AI SIGNAL ENHANCEMENT                                               │
│     3-tier: Cloudflare AI → GLM-4.7 (z.ai) → Vikey.ai                │
│     Bull/bear debate + 5 function-calling tools                        │
│     Trade memory (BM25 Okapi) + technical indicators (7)              │
│     Confidence adjustment: BULLISH +10 / BEARISH -20 / NEUTRAL -5     │
│                                                                         │
│  6. CONFIDENCE GATE                                                     │
│     LOW ≥ 75 | MEDIUM ≥ 60 | HIGH ≥ 45                               │
│     Below threshold → signal logged but NO proposal created            │
│                                                                         │
│  7. TRADE PROPOSAL                                                      │
│     EIP-712 signed intent → Prisma TradeProposal (status: PENDING)    │
│     TTL: 15 minutes, auto-expire if no response                       │
│     (Only for autoExecute=false agents)                                │
│                                                                         │
│  8. HUMAN APPROVAL (autoExecute=false only)                             │
│     APPROVE → verify signature → execute trade                         │
│     REJECT → mark rejected + reason                                    │
│     NOTHING → auto-expire after 15 minutes                             │
│                                                                         │
│  9. TRADE EXECUTION (3-Router Architecture)                             │
│     Router A: nad.fun bonding curve (Lens + Router contracts)          │
│     Router B: LiFi DEX aggregator (52 tokens, REST API → on-chain)    │
│     Router C: Relay Protocol (solver-based, best price routing)        │
│     Wallet: HD per-agent (BIP-32 from AGENT_MASTER_SEED)              │
│                                                                         │
│ 10. POST-TRADE PIPELINE                                                 │
│     PnL calculation (CoinGecko + CoinMarketCap) →                     │
│     Agent metrics update (totalPnl, winRate, totalTrades) →            │
│     Balance reconciliation (on-chain → DB sync) →                      │
│     Trade memory recording + AI reflection →                           │
│     Reputation feedback → Validation artifact                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Library Files Map (`src/lib/`)

### File Tree

```
src/lib/
├── strategy-engine.ts       → BRAIN: 6 strategies + main evaluator
├── ai-advisor.ts            → AI enhancement: 3-tier fallback + 5 tools + bull/bear debate
├── trade-memory.ts          → BM25 Okapi trade memory + AI reflection
├── technical-indicators.ts  → 7 indicators (SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA)
├── chart-aggregator.ts      → 3-source OHLCV (nad.fun → DexScreener → GeckoTerminal)
├── trade-judgement.ts       → OpenClaw: proposal + EIP-712 + approval
├── risk-guard.ts            → Pre-trade risk checks (6 checks)
├── pnl-tracker.ts           → PnL: CoinGecko + CoinMarketCap MON/USD + calculation
├── nadfun-api.ts            → nad.fun REST: market data, metrics, chart, holdings
├── lifi-client.ts           → LiFi DEX: quote + swap + 52 tokens + getERC20Holdings
├── relay-client.ts          → Relay Protocol: quote + swap (solver-based)
├── token-discovery.ts       → On-chain event scanning (CurveCreate/Buy/Sell)
├── erc8004.ts               → ERC-8004: identity + reputation on-chain
├── agent-wallet.ts          → HD wallet: BIP-32 derivation per agent
├── config.ts                → ENV vars, network, RPC URLs
├── rpc-client.ts            → Viem publicClient: timeout 10s, retry 2x
├── prisma.ts                → Singleton Prisma client
├── x402-server.ts           → x402 payment: $0.001 USDC per trade/A2A
├── r2-storage.ts            → Cloudflare R2: metadata/proofs/artifacts
├── get-base-url.ts          → Server base URL resolver
└── utils.ts                 → Format: address, number, currency, %, time, cn()
```

---

## Step 1: Trigger — Scheduler

**File:** `src/app/api/scheduler/route.ts`

### How It Works

```
POST /api/scheduler
│
├── 1. TOKEN DISCOVERY: discoverTradableTokens()
│      ├── Query on-chain events (CurveCreate/Buy/Sell) from last 7,200 blocks
│      ├── Rank by trade activity, enrich top 8 from nad.fun API
│      └── Return trending token addresses
│
├── 2. ADD DIVERSITY TOKENS: 3 random MONAD_TOKENS (LiFi/Relay coverage)
│      ├── Ensure agents don't only evaluate nad.fun tokens
│      └── Cap total at 10 tokens per cycle
│
├── 3. FETCH ACTIVE AGENTS from database
│      prisma.agent.findMany({ where: { status: 'ACTIVE' } })
│
├── 4. Per agent: Check cooldown (5-minute minimum between evaluations)
│      const MIN_EVAL_INTERVAL_MS = 5 * 60 * 1000;
│      lastEvalMap: Map<string, number> (in-memory, resets on server restart)
│
├── 5. Per agent: PORTFOLIO FETCH
│      ├── publicClient.getBalance(walletAddr) → MON balance
│      ├── getHoldings(walletAddr) → nad.fun bonding curve tokens
│      ├── getERC20Holdings(publicClient, walletAddr) → 52 MONAD_TOKENS via multicall
│      └── Merge holdings (deduplicate by address)
│
├── 6. Per agent: BALANCE RECONCILIATION
│      ├── totalOnChainValue = walletBalance + holdingsValue
│      ├── If drift > 0.1 MON → update DB totalCapital
│      └── Ensures DB matches on-chain reality
│
├── 7. Per agent: evaluateStrategy(agentContext, tokens, autoPropose)
│      ├── autoExecute=true → risk guard → execute trade
│      └── autoExecute=false → create TradeProposal (PENDING)
│
├── 8. Error isolation: if 1 agent fails, others continue
│
└── 9. Auto-loop: if SCHEDULER_AUTO_LOOP=true → setTimeout next run
```

### Alternative Trigger: Manual Evaluate

```
POST /api/agents/:id/evaluate
├── Same as scheduler but for 1 agent only
├── Optional parameter: autoPropose (default true)
├── Optional parameter: tokens[] (custom token addresses)
└── Useful for testing / debugging
```

### GET Status

```
GET /api/scheduler
└── Return: { activeAgents, autoExecuteAgents, pendingProposals, lastRun }
```

**Important Notes:**
- Cooldown map is in-memory → resets on deploy/restart
- If `SCHEDULER_AUTO_LOOP=true`, scheduler self-triggers via `setTimeout`
- All agents evaluated sequentially (not parallel) to respect nad.fun API rate limits
- Token pool is shared across all agents (not per-agent)

---

## Step 2: Safety Check — Drawdown & Risk Guard

**Files:** `src/lib/strategy-engine.ts`, `src/lib/risk-guard.ts`

Before any evaluation, the engine checks if the agent has exceeded risk limits.

### Risk Parameters

```typescript
const RISK_PARAMS = {
  low: {
    maxPositionPct: 0.05,      // 5% capital per trade
    minConfidence: 75,          // Requires high confidence
    maxDrawdownLimit: 0.10,    // Stop if drawdown > 10%
    gasReserve: 5.0,           // Keep 5 MON for gas
  },
  medium: {
    maxPositionPct: 0.10,      // 10% capital per trade
    minConfidence: 60,
    maxDrawdownLimit: 0.20,    // Stop if drawdown > 20%
    gasReserve: 3.0,
  },
  high: {
    maxPositionPct: 0.20,      // 20% capital per trade
    minConfidence: 45,
    maxDrawdownLimit: 0.35,    // Stop if drawdown > 35%
    gasReserve: 1.0,
  },
};
```

### Risk Guard — 6 Pre-Trade Checks

```
checkRiskLimits(agent, trade) → { ok: boolean; reason?: string }

| Check              | Condition                              | Result if Failed |
|--------------------|----------------------------------------|-----------------|
| Gas reserve        | walletBalance - amount < gasReserve    | Blocked         |
| Max position       | amount > totalCapital × maxPositionPct | Blocked         |
| Daily loss limit   | dayLosses > totalCapital × dailyLoss%  | Blocked         |
| Max daily trades   | todayTrades >= maxDailyTrades          | Blocked         |
| Max drawdown       | currentDrawdown > maxDrawdownLimit     | Blocked         |
| Minimum capital    | totalCapital < minimum threshold       | Blocked         |
```

---

## Step 3: Fetch Market Data — nad.fun API

**File:** `src/lib/strategy-engine.ts`, `src/lib/nadfun-api.ts`

### Data Flow

```
fetchMarketSnapshots(tokenAddresses)
│
├── Per token (PARALLEL via Promise.allSettled):
│
│   ├── getMarketData(addr)
│   │   API: GET /agent/market/:token_id
│   │   Return: price, priceUsd, volume24h, holders, marketCap, liquidity
│   │
│   └── getTokenMetrics(addr, ['5m','1h','6h','24h'])
│       API: GET /agent/metrics/:token_id?timeframes=5,60,360,1D
│       Return: per timeframe → priceChange%, volumeChange, txCount
│
├── Bonding curve intelligence (on-chain, free):
│   ├── Lens.getProgress() → graduation progress %
│   ├── isGraduated() → has token left bonding curve?
│   └── Anti-sniping: skip tokens < 5 blocks old
│
└── Resolve symbol names from MONAD_TOKENS map
    Output: MarketSnapshot[] array
```

### nad.fun API Endpoints

| Endpoint | Path | Return |
|----------|------|--------|
| Market Data | `GET /agent/market/:token` | price, volume, holders, cap, liquidity |
| Token Metrics | `GET /agent/metrics/:token?timeframes=5,60,360,1D` | priceChange%, vol, txCount per TF |
| Swap History | `GET /agent/swap-history/:token?limit=20&page=1` | swaps array (hash, type, amounts) |
| Chart OHLCV | `GET /agent/chart/:token?resolution=60&from=X&to=Y` | timestamps, OHLCV arrays |
| Holdings | `GET /agent/holdings/:address` | bonding curve token balances |
| Token Info | `GET /agent/token/:token` | name, symbol, image, creator, graduated |

**API URLs:**
- Testnet: `https://dev-api.nad.fun`
- Mainnet: `https://api.nadapp.net`

**Rate Limiting:**
- Without API key: 10 req/min (6.5s throttle between requests)
- With `NAD_API_KEY`: 100 req/min (650ms between requests)
- In-memory cache: 5-minute TTL, max 200 entries

---

## Step 4: Strategy Evaluation — 6 Strategies

**File:** `src/lib/strategy-engine.ts`

Each agent has 1 strategy (chosen during creation). The engine calls the strategy evaluator to produce `TradeSignal | null`.

### 4.1 MOMENTUM

**Logic:** Follow price trends using multi-timeframe scoring.

```
momentumScore = 5m_priceChange × 0.15 (noise filter)
              + 1h_priceChange × 0.35 (direction)
              + 4h/6h_priceChange × 0.30 (trend context)
              + 24h_priceChange × 0.20 (macro trend)

volumeMultiplier = volume_rising ? 1.2 : 0.8
adjustedScore = momentumScore × volumeMultiplier

BUY:  adjustedScore > +3 AND 1h_txCount ≥ 5
      confidence = min(95, 50 + adjustedScore × 5)

SELL: adjustedScore < -3 AND 1h_txCount ≥ 3
      confidence = min(95, 50 + |adjustedScore| × 5)
```

Anti-sniping: Skip tokens created < 5 blocks ago.
Bonding curve intelligence: Avoid tokens > 85% graduated.

### 4.2 YIELD

**Logic:** Buy yield-bearing tokens on dips.

```
Target tokens: 18 yield-bearing tokens
  MON LSTs: APRMON, GMON, SMON, SHMON, EARNMON, LVMON, MCMON
  ETH LSTs: WSTETH, WEETH, EZETH, PUFETH
  Yield Stablecoins: EARNAUSD, SAUSD, SUUSD, SYZUSD, WSRUSD, LVUSD, YZUSD

BUY:  priceChange(4h) < -3% AND liquidity > 0
      confidence = min(85, 60 + |priceChange| × 2.5)

SELL: priceChange(4h) > +5% AND 1h momentum fading
      confidence = min(80, 55 + priceChange × 2)
```

### 4.3 ARBITRAGE

**Logic:** Detect price divergence between timeframes (proxy for cross-venue).

```
Filter: Only tokens in MONAD_TOKENS (LiFi/Relay supported)

spreadIndicator = |5m_priceChange - (1h_priceChange / 12)|

Threshold per risk:
  HIGH:   spreadIndicator > 1.5%
  MEDIUM: spreadIndicator > 2.0%
  LOW:    spreadIndicator > 3.0%

confidence = min(90, 55 + spreadIndicator × 8)
```

### 4.4 DCA — Dollar Cost Averaging

**Logic:** Always buy, pick cheapest token relative to 24h average.

```
Target tokens: WMON, WBTC, WETH + other blue-chips

ALWAYS BUY — never sell
Pick token with largest discount (deepest 24h drop)
Position size = totalCapital × maxPositionPct × 0.5 ← HALF normal size
confidence = 65 + dipBonus (min 20, max from discount × 3)
```

### 4.5 GRID

**Logic:** Range-bound trading — buy at support, sell at resistance.

```
Filter: volume24h ≥ 1000

BUY zone:  24h_priceChange < -4% AND 1h_priceChange > -1% (stabilizing)
SELL zone: 24h_priceChange > +6% AND 1h_priceChange < +1% (momentum fading)
confidence = min(85, 55 + |pricePosition| × 3)
```

### 4.6 HEDGE

**Logic:** Rotate to stablecoins during bearish markets, exit on recovery.

```
Analyze: average 24h and 1h priceChange of ALL non-stablecoin tokens

HEDGE IN (move to stablecoins):
  avg_24h < -5% AND avg_1h < -1% → BUY USDC
  Position: totalCapital × maxPositionPct × 1.5 (larger than normal)

HEDGE OUT (re-enter market):
  avg_24h > +3% AND avg_1h > +0.5% → BUY best recovery token
```

### TradeSignal Output

```typescript
interface TradeSignal {
  action: 'buy' | 'sell';
  tokenAddress: string;     // 0x...
  tokenSymbol: string;      // "CHOG", "WBTC", etc.
  amount: number;           // MON amount
  confidence: number;       // 0-100
  reason: string;           // Human-readable explanation
  strategy: StrategyType;
  metadata?: Record<string, unknown>;
}
```

If no signal is generated → return `null` → evaluation ends, no proposal.

---

## Step 5: AI Signal Enhancement — 3-Tier Fallback

**File:** `src/lib/ai-advisor.ts`

### When Called

Only if Step 4 produces a TradeSignal (not null).

### Provider Chain

```
Request → Cloudflare AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
              │
              ├── Success → Return AI verdict
              │
              └── Failure → GLM-4.7 (z.ai)
                                │
                                ├── Success → Return AI verdict
                                │
                                └── Failure → Vikey.ai (gemma-3-27b-instruct)
                                                  │
                                                  ├── Success → Return AI verdict
                                                  │
                                                  └── Failure → Pass through original signal unchanged
```

### AI Prompt Structure

The AI receives:
1. **Role**: Market Analyst and Risk Manager
2. **Market Data**: Price, volume, holders, market cap
3. **Technical Analysis**: SMA, EMA, RSI, MACD, Bollinger, ATR, VWMA
4. **Portfolio State**: Capital, PnL, current holdings, wallet balance
5. **Past Trade Memories**: Top 3 relevant memories from BM25 retrieval
6. **Trade Signal**: Proposed action, amount, confidence, reasoning
7. **Instructions**: Perform bull/bear debate, output BULLISH/BEARISH/NEUTRAL verdict

### 5 Function-Calling Tools

| Tool | Description |
|------|-------------|
| `get_bonding_curve_status` | Query on-chain bonding curve progress, graduation status |
| `get_token_market_data` | Price, volume, holders, market cap from nad.fun |
| `check_risk_assessment` | Validate trade against risk limits |
| `get_price_quote` | Get execution quote from LiFi or nad.fun |
| `get_technical_analysis` | Full technical indicators report (7 indicators) |

### Confidence Adjustment

| AI Verdict | Effect on Signal |
|------------|-----------------|
| BULLISH (BUY signal) | Confidence +10 (max 95) |
| BEARISH (BUY signal) | Confidence -20 (may drop below threshold) |
| NEUTRAL | Confidence -5 |
| BULLISH (SELL signal) | Confidence -15 |
| BEARISH (SELL signal) | Confidence +10 |

If ALL 3 AI tiers fail → confidence remains unchanged (aiUsed=false).

---

## Step 6: Confidence Gate

**File:** `src/lib/strategy-engine.ts`

After AI enhancement, check if confidence is still high enough.

```typescript
if (signal && signal.confidence >= riskParams.minConfidence) {
  // Proceed with trade or create proposal
} else {
  // Signal logged in result.reasoning but NO proposal created
}
```

| Risk Level | Minimum Confidence for Execution |
|-----------|----------------------------------|
| LOW | ≥ 75 |
| MEDIUM | ≥ 60 |
| HIGH | ≥ 45 |

**Note:** AI can lower confidence below threshold, meaning a signal that initially passed can be rejected after AI review.

---

## Step 7: Trade Proposal — Human-in-the-Loop

**File:** `src/lib/trade-judgement.ts`

### For autoExecute=false Agents

When `autoExecute=false`, the strategy engine creates a TradeProposal for human review:

```
createTradeProposal({
  agentId, tokenAddress, amount, action, slippageBps,
  proposedBy: "strategy-engine:MOMENTUM",
  quoteData: { confidence, reason, strategy, metadata }
})
│
├── EIP-712 Signing (if AGENT_MASTER_SEED available):
│   Domain: { name: 'ANOA Trade Intent', version: '1', chainId: 143 }
│   Types: TradeIntent { agentId, tokenAddress, amount, action, ... }
│
├── Save to database:
│   prisma.tradeProposal.create({
│     status: "PENDING", expiresAt: now + 15 minutes
│   })
│
└── Return: { id, agentId, status: "PENDING", expiresAt }
```

### For autoExecute=true Agents

When `autoExecute=true`, the scheduler bypasses proposals and executes directly:
1. Risk guard check → if passed → execute trade via `/api/trade`
2. No human approval needed

---

## Step 8: Human Approval

**File:** `src/lib/trade-judgement.ts`, `src/app/api/trade/proposals/route.ts`

### 3 Options for Human (autoExecute=false only)

```
A. APPROVE
   PATCH /api/trade/proposals { id, action: "approve", approvedBy: "0xHuman" }
   → Verify EIP-712 signature → Execute trade → Mark EXECUTED

B. REJECT
   PATCH /api/trade/proposals { id, action: "reject", reason: "Too risky" }
   → Mark REJECTED + reason

C. NOTHING
   Auto-expire after 15 minutes
```

---

## Step 9: Trade Execution — 3-Router Architecture

**File:** `src/app/api/trade/route.ts`

### Router Selection

```
Token received for trade
    │
    ├─ Is nad.fun bonding curve token? ────── Yes ──→ nad.fun Router
    │   (not graduated, has bonding curve)             (Bonding Curve Router)
    │
    ├─ Is in MONAD_TOKENS (52 tokens)? ────── Yes ──→ LiFi Router
    │   (WMON, USDC, WETH, WBTC, APRMON...)           (0x026F2520...)
    │
    └─ Relay available? ──────────────────── Yes ──→ Relay Protocol
        (solver-based, may find better price)          (0x3eC130B6...)
```

### nad.fun Trade Flow

**BUY:**
```
1. Lens.getAmountOut(token, amountIn, true) → [router, expectedOut]
2. Validate: router ≠ 0x0, amountOut ≠ 0
3. Calculate minAmountOut with slippage
4. Router.buy(token, to, amountOutMin, deadline) { value: amountIn }
5. Wait receipt, check not reverted
```

**SELL:**
```
1. Lens.getAmountOut(token, amountIn, false) → [router, expectedOut]
2. Try sellPermit (EIP-2612, saves ~50% gas)
3. Fallback: approve() + sell() (2 transactions)
4. Wait receipt, check not reverted
```

### LiFi Trade Flow

```
1. getLiFiQuote({ fromToken, toToken, amount, fromAddress })
2. Check ERC-20 approval → approve() if needed
3. Validate: tx.to === LIFI_ROUTER (security check)
4. walletClient.sendTransaction(quote.transactionRequest)
5. publicClient.waitForTransactionReceipt(txHash)
```

### Relay Trade Flow

```
1. getRelayQuote({ fromToken, toToken, amount, wallet })
2. executeRelaySwap(quote, walletClient, publicClient)
3. Transaction sent via Relay solver network
4. Wait for receipt
```

### Contract Addresses (Mainnet)

| Router | Address | Purpose |
|--------|---------|---------|
| nad.fun Bonding Curve | `0x6F6B8F1a20703309951a5127c45B49b1CD981A22` | Buy/sell bonding curve tokens |
| nad.fun DEX | `0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137` | Graduated token trading |
| nad.fun LENS | `0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea` | Price quotes + curve data |
| LiFi | `0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37` | DEX aggregator (52 tokens) |
| Relay | `0x3eC130B627944cad9b2750300ECB0A695DA522B6` | Solver-based routing |

---

## Step 10: Post-Trade Pipeline

**File:** `src/app/api/trade/route.ts`

After trade SUCCESS, the following processes run (partially parallel, non-blocking):

### 10a. PnL Calculation

```
getMonUsdPrice() → CoinGecko → CoinMarketCap → stale cache → error
calculatePnlUsd(amountIn, amountOut, action)
├── pnlMon = amountOut - amountIn
├── pnlUsd = pnlMon × monPrice
└── Return: { pnlMon, pnlUsd, monPrice }
```

### 10b. Agent Metrics Update

```
Update agent in DB:
├── totalPnl += pnlMon
├── totalTrades++
├── winRate = wins / totalTrades × 100
└── Upsert TokenHolding with avgCostBasis
```

### 10c. Trade Memory Recording

```
recordTradeOutcome(agentId, situation, result)
├── Store: situation, action, outcome, lesson, pnlUsd, profitable
├── AI Reflection: generate deeper lesson (non-blocking)
└── Future retrieval via BM25 Okapi scoring
```

### 10d. Reputation Feedback

```
submitTradeReputationFeedback(agentId, execution)
├── Score: SUCCESS → min(100, 50 + pnlUsd × 10), FAILURE → 30
├── Save to Prisma Feedback table
└── Submit to ERC-8004 Reputation Registry (on-chain)
```

### 10e. Validation Artifact

```
createTradeValidation(execution)
├── keccak256 hash of execution data
├── Score: SUCCESS → 80, FAILURE → 50
└── Upload to Cloudflare R2 (optional)
```

---

## Dependency Map: File → File

### Trading Pipeline Dependencies

```
TRIGGER
  scheduler/route.ts
    → strategy-engine.evaluateStrategy()
    → token-discovery.discoverTradableTokens()
    → nadfun-api.getHoldings()
    → lifi-client.getERC20Holdings() (multicall)
    → risk-guard.checkRiskLimits()
    → prisma (agent.findMany)

STRATEGY ENGINE
  strategy-engine.ts
    → nadfun-api (getMarketData, getTokenMetrics)
    → trade-judgement (createTradeProposal)
    → ai-advisor (enhanceSignalWithAI)
    → trade-memory (getRelevantMemories)
    → lifi-client (MONAD_TOKENS, isLiFiSupportedToken)

AI ADVISOR
  ai-advisor.ts
    → technical-indicators (getTechnicalReport)
    → chart-aggregator (getChartDataMultiSource)
    → trade-memory (getRelevantMemories)
    → nadfun-api (getMarketData, getTokenInfo)
    → Cloudflare AI API (external)
    → GLM-4.7 z.ai (external)
    → Vikey API (external)

TRADE EXECUTION
  trade/route.ts
    → lifi-client (getLiFiQuote, executeLiFiSwap)
    → relay-client (getRelayQuote, executeRelaySwap)
    → nadfun contracts on-chain (Lens, Router via viem)
    → pnl-tracker (getMonUsdPrice)
    → trade-memory (recordTradeOutcome)
    → agent-wallet (getAgentAccount → HD wallet)
    → prisma (execution, agent, feedback)
```

### External API Connections

| Service | File | Endpoint | Timeout | Fallback |
|---------|------|----------|---------|----------|
| nad.fun | nadfun-api.ts | `api.nadapp.net/agent/*` | 10s | Error thrown |
| LiFi | lifi-client.ts | `li.quest/v1/quote` | 30s | Use nad.fun |
| Relay | relay-client.ts | `api.relay.link/quote` | 10s | Use LiFi |
| CoinGecko | pnl-tracker.ts | `api.coingecko.com/...` | 5s | CoinMarketCap |
| CoinMarketCap | pnl-tracker.ts | `pro-api.coinmarketcap.com/...` | 5s | Stale cache |
| DexScreener | chart-aggregator.ts | `api.dexscreener.com/...` | 8s | GeckoTerminal |
| GeckoTerminal | chart-aggregator.ts | `api.geckoterminal.com/...` | 10s | Synthetic candles |
| Cloudflare AI | ai-advisor.ts | `api.cloudflare.com/.../ai/v1/...` | 10s | GLM-4.7 |
| GLM-4.7 | ai-advisor.ts | `open.z.ai/api/...` | 10s | Vikey |
| Vikey | ai-advisor.ts | `api.vikey.ai/...` | 10s | Use original confidence |
| aPriori | yield/route.ts | `stake-api-prod.apr.io/monad` | 10s | Cache (12h TTL) |
| Upshift | yield/route.ts | `api.upshift.finance/...` | 10s | Cache (12h TTL) |
| Cloudflare R2 | r2-storage.ts | S3-compatible | 10s | Continue without upload |
| Monad RPC | rpc-client.ts | Network-specific URL | 10s | Retry 2x |

---

## Token Universe

### 52 LiFi Portfolio Tokens (MONAD_TOKENS)

Categories:
- **Native & Wrapped**: MON, WMON
- **Stablecoins**: USDC, USDT0, AUSD, IDRX, USD*, USD1
- **Yield Stablecoins**: earnAUSD, sAUSD, suUSD, etc.
- **ETH Variants**: WETH, wstETH, weETH, ezETH, pufETH, suETH
- **BTC Variants**: WBTC, BTC.B, LBTC, solvBTC, xSolvBTC, suBTC
- **MON Staking/LST**: aprMON, gMON, sMON, shMON, earnMON, lvMON, mcMON
- **Cross-chain**: SOL, XAUT0
- **DeFi Protocol**: CAKE, DUST, EUL, etc.
- **Custom**: CHOG, APR

Full list: `src/lib/lifi-client.ts` → `MONAD_TOKENS`

### nad.fun Tokens

All tokens listed on nad.fun bonding curve platform. No fixed list — validated via `Lens.getAmountOut()`. If Lens returns valid router + amount, token is supported.

### Strategy → Token Mapping

| Strategy | Target Tokens | Router |
|----------|--------------|--------|
| MOMENTUM | All non-stablecoin | nad.fun + LiFi + Relay |
| YIELD | 18 yield-bearing tokens | LiFi |
| ARBITRAGE | MONAD_TOKENS + nad.fun | nad.fun + LiFi + Relay |
| DCA | Blue-chip (WMON, WBTC, WETH, etc.) | LiFi |
| GRID | All tokens with volume > 1000 | nad.fun + LiFi |
| HEDGE | USDC/stablecoins (hedge in), best token (hedge out) | LiFi |

---

*Last Updated: February 2026*
