# Autonomous Trading Agent Simulation — nad.fun + LiFi + Relay

> End-to-end simulation: from agent creation, MON balance, to profit/loss without human intervention.
> 3-Router Architecture: nad.fun (bonding curve) → LiFi (DEX aggregator) → Relay (solver)
> Multi-Agent AI: Market Analyst + Risk Manager in parallel, 3-tier provider (CF → GLM-4.7 → Vikey)
> Trade Memory: BM25 Okapi retrieval + AI-powered reflection (TradingAgents-inspired)
> Multi-Source OHLCV: nad.fun → GeckoTerminal → DexScreener (chart-aggregator fallback)
> Investment Plan: Portfolio allocation per sector vs target per strategy
> Timeframe per strategy: MOMENTUM (5m+1h+4h), YIELD (4h+1h), ARBITRAGE (5m+1h), DCA (4h+1h), GRID (4h+1h+5m), HEDGE (4h+1h)
> Last updated: February 15, 2026 (Update #5 — Multi-Agent, Trade Memory, Chart Aggregator, Investment Plan)

---

## Base Assumptions

- Mainnet Monad (chain ID 143) — REAL MONEY
- MON price: ~$0.35 (from CoinGecko API, 60s cache)
- Scheduler: every 5 minutes (`SCHEDULER_AUTO_LOOP=true`, `SCHEDULER_INTERVAL_MS=300000`)
- GAS_RESERVE_MON = 5.0 MON (agent NEVER trades below this balance)
- Token pool per cycle: 5–10 tokens (5 nad.fun discovery + 3 random MONAD_TOKENS)
- nad.fun API: PUBLIC without API key, rate limit 10 req/min (throttle 6.5s/request + cache 5 minutes)
- Multi-Agent AI: Market Analyst (bull/bear + tools) + Risk Manager (risk override), in parallel
- AI Provider: Cloudflare → GLM-4.7 (z.ai) → Vikey (3-tier fallback per agent call)
- AI uses technical analysis (SMA, EMA, RSI, MACD, Bollinger, ATR) + bull/bear debate
- Chart data: multi-source (nad.fun → GeckoTerminal → DexScreener) via chart-aggregator
- Trade Memory: BM25 Okapi retrieval, past lessons injected into AI prompt
- AI Reflection: after every trade, AI analyzes outcome for deeper lessons
- Investment Plan: portfolio allocation per sector vs target range per strategy
- Bonding curve: still exists as supplementary (not priority), used for sweet spot + pre-graduation
- Timeframe adjusted per strategy (see table below)

---

## Table of Contents

1. [Phase 0: Create Agent](#fase-0-create-agent)
2. [Phase 1: Scheduler Cycle](#fase-1-scheduler-cycle)
3. [MOMENTUM Simulation](#simulasi-momentum)
4. [YIELD Simulation](#simulasi-yield)
5. [ARBITRAGE Simulation](#simulasi-arbitrage)
6. [DCA Simulation](#simulasi-dca)
7. [GRID Simulation](#simulasi-grid)
8. [HEDGE Simulation](#simulasi-hedge)
9. [AI Advisor — Multi-Agent Architecture (TradingAgents-Inspired)](#ai-advisor--multi-agent-architecture-tradingagents-inspired)
10. [Technical Indicators Module](#technical-indicators-module)
11. [Trade Memory & Learning System](#trade-memory--learning-system)
12. [Chart Aggregator (Multi-Source OHLCV)](#chart-aggregator-multi-source-ohlcv)
13. [Investment Plan Context](#investment-plan-context)
14. [3-Router Execution](#3-router-execution)
15. [Rate Limit & Multi-Agent Scaling](#rate-limit--multi-agent-scaling)
16. [Close & Sweep Agent](#close--sweep-agent)
17. [Risk Config per Level](#risk-config-per-level)

---

## Phase 0: Create Agent

**Flow: User in browser → create agent → pay fee → agent active**

### Step 0.1: User Connect Wallet
```
User opens /agents/create → connect MetaMask/WalletConnect via AppKit
Wallet connected to Monad Mainnet (chain 143)
```

### Step 0.2: User Selects Configuration
```
Form Create Agent:
├── Name: "AgentAlpha"
├── Strategy: MOMENTUM / YIELD / ARBITRAGE / DCA / GRID / HEDGE
├── Risk Level: low / medium / high
├── Auto-Execute: true (autonomous) / false (human-in-the-loop)
├── Max Daily Trades: 50 (default)
├── Daily Loss Limit: 10% (default)
└── Initial Capital: (how much MON will be sent to agent wallet)
```

### Step 0.3: ERC-8004 Registration (On-Chain)
```
1. User signs tx → mint NFT on Identity Registry (0x8004A169...)
   ├── Pay 100 MON registration fee
   ├── erc8004TxHash = result.hash
   └── registrationFeeTxHash = result.hash

2. POST /api/agents body:
   {
     name: "AgentAlpha",
     strategy: "MOMENTUM",
     riskParams: { riskLevel: "medium", slippageBps: 100 },
     autoExecute: true,
     erc8004TxHash: "0x...",
     registrationFeeTxHash: "0x...",
     userAddress: "0xUser..."
   }
```

### Step 0.4: Server Creates Agent
```
API /api/agents (POST):
├── Generate walletIndex = MAX(walletIndex) + 1 → e.g.: 3
├── Derive wallet: AGENT_MASTER_SEED → m/44'/60'/0'/0/3 → address 0xAgent...
├── Create Prisma Agent record:
│   ├── id: "clx1abc123"
│   ├── strategy: MOMENTUM
│   ├── status: ACTIVE
│   ├── autoExecute: true
│   ├── totalCapital: 0 (will be updated after user transfers)
│   ├── maxDailyTrades: 50
│   ├── dailyLossLimit: 10.0
│   ├── riskParams: { riskLevel: "medium", slippageBps: 100 }
│   ├── walletIndex: 3
│   └── walletAddr: "0xAgent..."
├── Create FeePayment record: { amount: 100, currency: "MON", txHash: "0x..." }
└── ERC-8004 registration: submitReputationFeedback (initial)
```

### Step 0.5: User Transfers MON to Agent Wallet
```
User sends 100 MON to 0xAgent... (manual transfer from MetaMask)
Agent wallet balance: 100 MON
Agent ready to trade!
```

---

## Phase 1: Scheduler Cycle

**Trigger: POST `/api/scheduler` (self-trigger loop every 5 minutes)**

Every cycle, the scheduler performs this for EVERY ACTIVE agent:

### Step 1.1: Token Discovery (On-Chain Events + API Enrichment)
```
discoverTradableTokens() →
1. Query on-chain events from Curve contract (0xA728...):
   ├── CurveBuy events  → last 7,200 blocks (~1 hour)
   ├── CurveSell events → last 7,200 blocks (~1 hour)
   └── CurveCreate events → last 7,200 blocks (~1 hour)

2. Extract unique token addresses, rank by tradeCount
3. Track createdAtBlock per token (anti-sniping)
4. Take top 8 tokens → enrich: nad.fun API (getTokenInfo + getMarketData)
5. Filter: volume >= 100 MON, holders >= 5, not locked
6. Return: top 5 nad.fun tokens

API budget per cycle:
├── Token discovery enrichment: 8 tokens × 2 API calls = ~16 calls
├── Throttle: 6.5s per call × 16 = ~104 seconds (~1.7 minutes)
├── Cache: data cached for 5 minutes, repeat calls = 0 API calls
└── Total per cycle: ~16 API calls (within rate limit 10 req/min)
```

### Step 1.2: MONAD_TOKENS Diversity (LiFi/Relay)
```
After discovery, add 3 random MONAD_TOKENS for LiFi/Relay:
├── E.g.: WETH, CHOG, APRMON (random every cycle)
├── Deduplicate with discovered tokens
├── Cap total: max 10 tokens per cycle
└── This ensures MOMENTUM can also trade via LiFi/Relay
```

### Step 1.3: Portfolio Fetch
```
publicClient.getBalance(0xAgent) → 100 MON
getHoldings(0xAgent) → { holdings: [] }

agentContext = {
  id: "clx1abc123",
  strategy: "MOMENTUM",
  riskLevel: "medium",
  totalCapital: 100,
  totalPnl: 0,
  maxDrawdown: 0,
  walletBalance: 100,
  holdings: [],
}
```

### Step 1.4: Strategy Evaluation
```
evaluateStrategy(agentContext, tokenAddresses, autoPropose, discoveredTokensMetadata)
├── Drawdown check: 0 < 0.20 (medium limit) → OK
├── fetchMarketSnapshots(addresses, metadata)
│   Per token: getMarketData() + getTokenMetrics(['5m','1h','4h'])  ← 3 timeframes
│   Per token: Lens.getProgress(), isGraduated(), isLocked()         ← on-chain (free)
│   Per token: attach createdAtBlock + latestBlock
│
│   API budget: 10 tokens × 2 API calls = ~20 calls
│   Throttle: 6.5s × 20 = ~130 seconds (~2.2 minutes)
│   With 5-minute cache: tokens already enriched = 0 calls
│
├── evaluateStrategy selects the 1 BEST signal (bestSignal/bestScore pattern)
│   → Only returns the signal with highest confidence
│   → Must be >= minConfidence (low=75, medium=60, high=45)
│   → Returns null if no signal passes
│
├── If signal exists → AI Enhancement (TradingAgents-inspired)
│   → callAI() → CF → GLM → Vikey (3-tier fallback)
│   → AI MUST call get_technical_analysis (SMA/EMA/RSI/MACD/Bollinger/ATR)
│   → AI performs bull/bear debate analysis
│   → AI adjusts confidence (60:40 blend rule-based + AI)
│   → Max 3 rounds function calling
│
├── If confidence >= threshold → Risk Guard check (5 checks)
└── If risk OK + autoExecute → POST /api/trade
```

---

## MOMENTUM Simulation

**Agent: strategy=MOMENTUM, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 5m (×0.30) + 1h (×0.40) + 4h (×0.30) | Fallback: 5m (×0.45) + 1h (×0.55)**
**Router: nad.fun (bonding curve tokens) + LiFi (ERC20) + Relay (solver)**

### BUY Scenario: Token PEPE rising strongly (nad.fun, full 3TF)
```
PEPE (nad.fun, progress 62%):
├── 5m: +5% price, +30% volume, 15 txs
├── 1h: +8% price, +20% volume
├── 4h: +12% price (strong trend)

Calculation:
momentumScore = 5*0.30 + 8*0.40 + 12*0.30 = 1.5 + 3.2 + 3.6 = 8.3
volumeMultiplier = 1.2 (volume rising in 5m)
adjustedScore = 8.3 * 1.2 = 9.96

Bonding Curve Intelligence (supplementary):
progress 62% (sweet spot 50-70%) → boost 1.10x
adjustedScore = 9.96 * 1.10 = 10.96

4h Trend Alignment:
4h > 0 and adjustedScore > 0 → boost 1.08x
adjustedScore = 10.96 * 1.08 = 11.83

Market Quality:
volume24h > 1000 → +15% boost → 11.83 * 1.15 = 13.61
holders > 50 → +10% boost → 13.61 * 1.10 = 14.97

14.97 > 3 (BUY threshold) → BUY signal!
confidence = min(95, 50 + 14.97*5) = 95

Position sizing:
rawSize = 100 * 0.10 (medium 10%) = 10 MON
safeSize = min(10, 100 - 5.0) = 10 MON

Signal: BUY PEPE, amount=10 MON, confidence=95

AI Advisor (TradingAgents-inspired):
├── AI calls get_technical_analysis(PEPE) → returns SMA/RSI/MACD/Bollinger report
├── AI analysis:
│   TECHNICAL: RSI(14)=68 (strong momentum not yet overbought), MACD histogram positive,
│              price above SMA(10) and SMA(50), Bollinger near upper band
│   BULLISH: Strong 3-timeframe alignment, volume increasing, bonding curve sweet spot
│   BEARISH: RSI approaching overbought (68), near Bollinger upper band
│   VERDICT: Strong momentum with manageable risk. Confidence: 85
├── Blend: 95*0.6 + 85*0.4 = 57 + 34 = 91
└── Final confidence: 91

Trade: POST /api/trade → nad.fun BondingCurveRouter.buy()
├── Lens.getAmountOut(PEPE, 10 MON, true) → [Router, 5000 PEPE]
├── slippage 1% → amountOutMin = 4950
├── sendTransaction(value: 10 MON)
└── SUCCESS → txHash: 0xabc...

After trade:
├── walletBalance: ~89.99 MON (100 - 10 - gas)
├── Holdings: [PEPE: 5000 tokens, avgBuyPrice: 0.002]
└── TokenHolding record created
```

### BUY Scenario: WETH via LiFi (without 4h data)
```
WETH (LiFi supported, 4h data NOT available):
├── 5m: +3% price, +25% volume, 40 txs
├── 1h: +4.5% price
├── 4h: null (API does not return data)

Fallback (without 4h): 5m×0.45 + 1h×0.55
momentumScore = 3*0.45 + 4.5*0.55 = 1.35 + 2.475 = 3.825
volumeMultiplier = 1.2 → adjustedScore = 4.59
Market quality boosts → adjustedScore = ~5.5

confidence = min(95, 50 + 5.5*5) = 78

AI Advisor: calls get_technical_analysis(WETH)
├── RSI(14)=55, MACD neutral, SMA aligned → moderate support
├── Confidence: 72
├── Blend: 78*0.6 + 72*0.4 = 46.8 + 28.8 = 76
└── Final: 76

Trade: POST /api/trade → isLiFiSupportedToken(WETH) = true → LiFi path
```

### SELL Scenario: Pre-Graduation (bonding curve supplementary)
```
PEPE progress = 88% (> 85% threshold):
├── Agent holdings: 5000 PEPE
├── Force SELL signal (pre-graduation protection)
├── confidence = min(90, 60 + 88*0.3) = min(90, 86.4) = 86
└── SELL via sellPermit (EIP-2612, saves gas)
```

### SELL Scenario: Momentum Reversal
```
Momentum Reversal (adjustedScore < -3):
├── PEPE drops -4% in 5m, -6% in 1h, -8% in 4h → adjustedScore = -(1.2+2.4+2.4) * 1.2 = -7.2
├── SELL confidence = min(95, 50 + 7.2*5) = 86
├── Amount = getHoldingBalance() = 5000 PEPE tokens
└── SELL via sellPermit (EIP-2612)
```

---

## YIELD Simulation

**Agent: strategy=YIELD, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 4h (primary dip detection) + 1h (fallback) — does NOT use 5m (yield = patience)**

### YIELD_TOKENS (18 yield-bearing tokens):
```
MON LSTs (7): APRMON, GMON, SMON, SHMON, EARNMON, LVMON, MCMON
ETH LSTs (4): WSTETH, WEETH, EZETH, PUFETH
Yield Stablecoins (7): EARNAUSD, SAUSD, SUUSD, SYZUSD, WSRUSD, LVUSD, YZUSD
```

### BUY Scenario: Yield token dip (4h timeframe)
```
APRMON (liquid staking MON, ~6.8% APR):
├── 4h: -4.2% price (significant dip)
├── 1h: -1.5% (confirms still dipping)
├── liquidity > 0 → OK

primaryTf = 4h (available)
primaryLabel = '4h'
Trigger: primaryTf.priceChange(-4.2) < -3 && liquidity > 0 → BUY!
confidence = min(85, 60 + |-4.2| * 2.5) = min(85, 70.5) = 71
71 >= 60 (medium min) → PASSES

AI Advisor: calls get_technical_analysis(APRMON)
├── RSI(14)=35 (near oversold, good entry for yield)
├── BULLISH: Oversold RSI, dip in an asset with 6.8% APR
├── BEARISH: Broader market could still be declining
├── VERDICT: Good accumulation point for yield. Confidence: 75
├── Blend: 71*0.6 + 75*0.4 = 42.6 + 30 = 73
└── Final: 73

Trade:
├── isLiFiSupportedToken(APRMON) = true → LiFi path
├── getLiFiQuote(MON → APRMON, 10 MON)
├── executeLiFiSwap() → SUCCESS
└── Holdings: [APRMON: X tokens, earning ~6.8% APR passively]
```

### SELL Scenario: Yield token spike
```
APRMON rises +6% in 4h, but 1h already slowing down (1h < 2%):
├── Trigger: primaryTf(4h).priceChange > 5 && m1h.priceChange < 2
├── confidence = min(80, 55 + 6*2) = 67
└── SELL full position → take profit
```

---

## ARBITRAGE Simulation

**Agent: strategy=ARBITRAGE, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 5m + 1h (short-term spread detection)**

### 3-Venue Price Comparison:
```
Per token, compare prices across:
├── Venue 1: nad.fun (bonding curve / graduated DEX)
├── Venue 2: LiFi (DEX aggregator — routes to best DEX)
└── Venue 3: Relay Protocol (solver-based aggregator)

Spread detection (proxy):
spreadIndicator = |m5m.priceChange - (m1h.priceChange / 12)|
```

### Scenario: Spread detected on CHOG
```
CHOG:
├── 5m: +3.2% price, 8 txs
├── 1h: +6% price
├── spreadIndicator = |3.2 - (6/12)| = |3.2 - 0.5| = 2.7

Threshold (medium): minSpread = 2.0
2.7 > 2.0 → ARBITRAGE signal!
confidence = min(90, 55 + 2.7*8) = min(90, 76.6) = 77

Trade: SELL CHOG via best-price path
├── isLiFiSupportedToken(CHOG) → true → LiFi
├── Slippage 1% → if spread > 1% → TX revert → skip
└── Margin percent 1-2%: if difference is too large, ignored
```

---

## DCA Simulation

**Agent: strategy=DCA, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 4h (discount detection primary) + 1h (fallback) — DCA = long-term, no 5m noise**

### DCA Target Tokens (11 blue-chip):
```
WMON, WBTC, WETH, WSTETH, WEETH, EZETH, SOL, LBTC, APRMON, GMON, SMON
```

### Scenario: DCA Buy on Dip (4h timeframe)
```
Evaluate all 11 tokens → find the most discounted:
├── WETH: m4h.priceChange = -6.8% → discount = 6.8
├── WBTC: m4h.priceChange = -2.5% → discount = 2.5
├── APRMON: m4h.priceChange = -3.8% → discount = 3.8

bestTarget = WETH (discount 6.8 highest), tfLabel = '4h'

Position sizing (DCA = HALF normal):
rawSize = 100 * 0.10 * 0.5 = 5 MON
confidence = 65 + min(20, 6.8*3) = 65 + 20 = 85

Signal: BUY WETH, amount=5 MON, confidence=85
Trade: LiFi path (WETH is in MONAD_TOKENS)
```

---

## GRID Simulation

**Agent: strategy=GRID, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 4h (range definition) + 1h (position) + 5m (entry stabilization)**

### Grid Zones (based on 4h range):
```
├── Support zone: pricePosition(4h) < -4% (near bottom)
├── Resistance zone: pricePosition(4h) > +6% (near top)
└── Neutral: between -4% and +6% → NO SIGNAL
```

### BUY Scenario: Token in support zone
```
CHOG:
├── m4h.priceChange = -5.5% (dropped below range)
├── m5m.priceChange = +0.3% (starting to bounce, > -1%)

rangeTf = 4h, rangeLabel = '4h'
Trigger: pricePosition(-5.5) < -4 && m5m(+0.3) > -1 → BUY!
confidence = min(85, 55 + |-5.5| * 3) = 72

AI Advisor: technical analysis → RSI(14)=28 (oversold), near lower Bollinger
├── BULLISH: Oversold RSI, support zone, 5m stabilizing
├── Confidence: 78
└── Final (blend): 72*0.6 + 78*0.4 = 74
```

### SELL Scenario: Token in resistance zone
```
CHOG:
├── m4h.priceChange = +8% (rose above range)
├── m5m.priceChange = +0.2% (momentum fading, < 1%)

Trigger: pricePosition(+8) > 6 && m5m(+0.2) < 1 → SELL!
confidence = min(85, 55 + 8*2.5) = 75
```

---

## HEDGE Simulation

**Agent: strategy=HEDGE, risk=medium, capital=100 MON, autoExecute=true**
**Timeframe: 4h (trend direction) + 1h (confirmation) — Hedge = macro view**

### ENTER HEDGE Scenario: Market crash
```
Evaluate ALL tradable markets:
├── avgChange4h = average m4h.priceChange across all tokens = -7.5%
├── avgChange1h = average m1h.priceChange across all tokens = -2.3%

has4h = true → primaryAvg = avgChange4h = -7.5%
confirmAvg = avgChange1h = -2.3%

Trigger: primaryAvg(-7.5) < -5 && confirmAvg(-2.3) < -1 → HEDGE MODE!
severity = 7.5
confidence = min(90, 55 + 7.5*3) = 78

Signal: BUY USDC, amount=15 MON, confidence=78
Trade: LiFi path (MON → USDC swap)
```

### EXIT HEDGE Scenario: Market recovery
```
avgChange4h = +4.5% (recovery)
avgChange1h = +1.2% (positive momentum)

Trigger: primaryAvg(4.5) > 3 && confirmAvg(1.2) > 0.5 → EXIT HEDGE!
→ BUY the strongest recovering token via LiFi/nad.fun
```

---

## AI Advisor — Multi-Agent Architecture (TradingAgents-Inspired)

**2 AI Agents work in PARALLEL before every trade: Market Analyst + Risk Manager.**
**Inspired by TradingAgents framework — multi-analyst, bull/bear debate, risk override.**

### Multi-Agent Flow:
```
Signal from Strategy Engine enters →

┌─────────────────────────────┐     ┌─────────────────────────────┐
│     AGENT 1: MARKET ANALYST │     │     AGENT 2: RISK MANAGER   │
│                             │     │                             │
│ ► Bull/bear debate          │     │ ► Position concentration    │
│ ► 5 trading tools (FC)      │     │ ► Drawdown proximity        │
│ ► Technical analysis        │     │ ► Losing streak detection   │
│ ► Past trade memories       │     │ ► Volatility exposure       │
│ ► Investment plan context   │     │ ► Portfolio alignment       │
│ ► Max 3 rounds tool calling │     │ ► Capital adequacy          │
│                             │     │                             │
│ Output: Confidence 0-100    │     │ Output: APPROVE/REDUCE/BLOCK│
│         + bull/bear verdict │     │         + adjustment -30..0 │
└──────────────┬──────────────┘     └──────────────┬──────────────┘
               │          Promise.all()            │
               └──────────────┬────────────────────┘
                              ▼
               ┌──────────────────────────────┐
               │     COMBINED DECISION        │
               │                              │
               │ analystConfidence            │
               │ + riskAdjustment (-30..0)    │
               │ = finalConfidence            │
               │                              │
               │ Blend: 60% rule-based        │
               │      + 40% AI confidence     │
               └──────────────────────────────┘
```

### Market Analyst (Agent 1) — Detail:
```
Prompt:
├── "You are ANOA Market Analyst — an AI trading analyst on Monad blockchain"
├── "Your role is MARKET ANALYSIS — bull/bear debate and technical assessment"
├── "A separate Risk Manager agent handles risk assessment independently"

Input context (injected into user message):
├── Trade Signal: action, token, amount, strategy, rule-based confidence
├── Agent Portfolio: capital, PnL, drawdown, wallet balance, holdings
├── Market Data: price, volume, holders, marketcap, liquidity, metrics per TF
├── Broader Market: avg 1h change across all other tokens
├── Trade History Stats: totalTrades, winRate, avgPnl, recentStreak
├── Investment Plan: current vs target allocation per sector
├── Past Memories: BM25-retrieved lessons from similar trades (max 3)
├── "IMPORTANT: Call get_technical_analysis with the token address"

Tools (function calling, max 3 rounds):
├── get_technical_analysis  → OHLCV → SMA/EMA/RSI/MACD/Bollinger/ATR report
├── get_bonding_curve_status → Progress, graduation, lock status
├── get_token_market_data   → Price, volume, holders, marketcap
├── check_risk_assessment   → Risk limit validation
└── get_price_quote         → Estimated trade output

Output format (REQUIRED):
├── **TECHNICAL ANALYSIS:** [indicator summary from tools]
├── **BULLISH CASE:** [reasons the trade could succeed]
├── **BEARISH CASE:** [risks and counter-signals]
├── **PAST LESSONS:** [references to similar trade memories]
├── **VERDICT:** [synthesis decision]
└── Confidence: <0-100>
```

### Risk Manager (Agent 2) — Detail:
```
Prompt:
├── "You are ANOA Risk Manager — a dedicated risk assessment agent"
├── "Your ONLY job is to evaluate whether a proposed trade should proceed from a RISK perspective"
├── "You are NOT a market analyst. You do NOT consider upside potential. You focus purely on RISK"

Input context:
├── Proposed trade: action, token, amount, confidence
├── Agent state: risk level, drawdown, capital, wallet balance
├── Market data: price, volume, liquidity, 1h change
├── Active positions count
├── Trade history stats (losing streak warning)
├── Investment plan alignment

6 Risk Dimensions Evaluated:
├── 1. POSITION CONCENTRATION — is portfolio too concentrated?
├── 2. DRAWDOWN PROXIMITY — how close to max drawdown limit?
├── 3. LOSING STREAK — agent losing consecutively? should sit out?
├── 4. VOLATILITY EXPOSURE — is ATR/price volatility too high?
├── 5. PORTFOLIO ALIGNMENT — does trade match allocation targets?
└── 6. CAPITAL ADEQUACY — enough buffer after trade?

Output format (EXACT):
├── RISK_VERDICT: APPROVE | REDUCE | BLOCK
├── RISK_CONFIDENCE_ADJUSTMENT: <-30 to 0>
└── RISK_REASON: <one sentence>

Rules:
├── Can ONLY LOWER confidence (never increase, 0 = no change, negative = reduce)
├── BLOCK verdict forces minimum -25 adjustment
├── maxTokens: 150, temperature: 0.2, timeoutMs: 10000
└── No tools — fast, text-only evaluation
```

### 3-Tier AI Provider (per agent call):
```
Every agent call (Market Analyst + Risk Manager) uses the SAME 3-tier fallback:

1. Cloudflare (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
   ├── FREE 10k neurons/day
   ├── Supports function calling (5 tools)
   └── Primary — 99% of queries handled here

2. GLM-4.7 / z.ai (advanced reasoning)
   ├── Backup if Cloudflare is down/error
   ├── Supports function calling (5 tools)
   └── Secondary

3. Vikey (gemma-3-27b-instruct)
   ├── Last resort backup
   ├── Supports function calling (5 tools)
   └── Tertiary

4. FAIL-SAFE: if all 3 AI providers fail
   ├── Market Analyst fails → use rule-based confidence (no blend)
   ├── Risk Manager fails → no adjustment (neutral)
   └── BOTH fail → original signal pass-through, aiUsed=false
```

### Combined Decision Example:
```
Signal enters: BUY PEPE, confidence=95 (rule-based)

Market Analyst:
├── Calls get_technical_analysis(PEPE) → RSI=68, MACD positive, SMA aligned
├── Bull/bear debate → strong momentum with manageable risk
├── AI Confidence: 85
├── Blend: 95*0.6 + 85*0.4 = 57 + 34 = 91

Risk Manager (parallel):
├── Evaluates: position not concentrated, drawdown 2% (far from 10% limit)
├── RISK_VERDICT: APPROVE
├── RISK_CONFIDENCE_ADJUSTMENT: 0

Final: 91 + 0 = 91 → PASSES (>= 75 minConfidence LOW)

─── Risk Manager BLOCK Scenario ───
Signal: BUY TOKEN_X, confidence=80

Risk Manager:
├── Agent already has 3 consecutive losing trades
├── Drawdown 8.5% (close to 10% limit)
├── RISK_VERDICT: BLOCK
├── RISK_CONFIDENCE_ADJUSTMENT: -25

Final: 72 + (-25) = 47 → DOES NOT PASS (< 75 minConfidence LOW)
→ Trade cancelled by Risk Manager override
```

### Confidence Guidelines:
```
80-100: Strong alignment between technicals, fundamentals, and strategy signal
60-79:  Moderate support with some conflicting signals
40-59:  Mixed signals, proceed with caution
20-39:  Significant red flags, likely should not trade
0-19:   Strong counter-signals, trade should be blocked
```

### Key AI Decision Factors:
```
- RSI > 70 on BUY signal = overbought risk → LOWER confidence
- RSI < 30 on SELL signal = oversold bounce risk → LOWER confidence
- MACD histogram positive + BUY = momentum confirmed → RAISE confidence
- Bollinger above upper band + BUY = overbought danger → LOWER confidence
- Low volume + any signal = weak conviction → LOWER confidence
- Bonding curve > 85% = pre-graduation volatility → CAUTION
- Agent drawdown near limit = Risk Manager will REDUCE/BLOCK
- Broader market declining = caution on BUY signals
- Agent on losing streak = Risk Manager may force sit-out
- Trade pushes sector OVER target allocation = LOWER confidence
```

---

## Technical Indicators Module

**File: `src/lib/technical-indicators.ts` — Pure TypeScript, no dependencies**

### Calculated Indicators:
```
Moving Averages:
├── SMA(10) — Short-term trend
├── SMA(50) — Medium-term trend
└── EMA(10) — Responsive short-term average

Momentum:
├── RSI(14) — Overbought/oversold (70/30 threshold)
├── MACD (12,26,9) — Momentum direction
├── MACD Signal Line — 9-period EMA of MACD
└── MACD Histogram — MACD minus Signal (positive = bullish)

Volatility:
├── Bollinger Upper Band (20, 2σ) — Overbought zone
├── Bollinger Middle (SMA 20) — Baseline
├── Bollinger Lower Band (20, 2σ) — Oversold zone
└── ATR(14) — Average True Range (volatility measure)

Volume:
├── VWMA(20) — Volume-weighted moving average
└── Volume Trend — increasing/decreasing/stable (5-candle comparison)
```

### Auto-Generated Signals:
```
Bullish signals auto-detected:
├── Price above SMA(10/50)
├── EMA(10) above SMA(50) (golden crossover)
├── RSI < 30 (oversold bounce potential)
├── MACD histogram positive
├── Price below lower Bollinger (oversold)
├── Rising volume + rising price

Bearish signals auto-detected:
├── Price below SMA(10/50)
├── EMA(10) below SMA(50) (death crossover)
├── RSI > 70 (overbought reversal risk)
├── MACD histogram negative
├── Price above upper Bollinger (overbought)
├── Rising volume + falling price
├── Declining volume (weakening trend)
├── ATR > 10% of price (high volatility warning)
```

### Data Source (Multi-Source via Chart Aggregator):
```
OHLCV from 3 sources with automatic fallback:
├── Source 1: nad.fun API → GET /agent/chart/{token}?resolution=5&countback=60
├── Source 2: GeckoTerminal API → /networks/monad/pools/{pool}/ohlcv/minute?aggregate=5
├── Source 3: DexScreener API → /tokens/v1/monad/{token} → synthetic candles
│
├── 60 candles × 5 minutes = 5 hours of historical data
├── Cache: 3-minute TTL per token
├── Minimum: 15 candles for valid analysis
└── Sufficient for SMA(50), RSI(14), MACD(26), Bollinger(20), ATR(14)

Coverage:
├── nad.fun tokens → nad.fun API (native OHLCV)
├── LiFi/Relay tokens (WETH, WBTC, APRMON, etc.) → GeckoTerminal (real OHLCV)
├── Tokens without GeckoTerminal pool → DexScreener (synthetic candles)
└── All tokens can be technically analyzed — no blind spots
```

---

## Trade Memory & Learning System

**File: `src/lib/trade-memory.ts` — BM25 Okapi retrieval + AI-powered reflection**
**Inspired by TradingAgents memory.py + reflection.py — agent learns from previous trades.**

### Memory Architecture:
```
Every completed trade → stored as TradeMemory:
├── situation:  Description of market conditions at trade time (price, volume, indicators)
├── action:     What was done (BUY/SELL + token + amount + router)
├── outcome:    Trade result (profit/loss, amounts, error if failed)
├── lesson:     Extracted lesson (rule-based + AI reflection)
├── timestamp:  When the trade occurred
├── pnlUsd:     Profit/loss in USD
└── profitable: Boolean — was it profitable?

Storage: Prisma Execution records → last 50 per agent → in-memory cache (5 min TTL)
```

### BM25 Okapi Retrieval:
```
Before a new trade → search for similar memories from past trades:

Query: "buy signal for PEPE, Strategy: MOMENTUM, Confidence: 85, 5m: +5%, 1h: +8%"
│
├── Tokenize query: ["buy", "signal", "pepe", "momentum", "confidence", ...]
├── Tokenize each memory document (situation + lesson + action)
│
├── BM25 Scoring per document:
│   ├── k1 = 1.5 (term frequency saturation)
│   ├── b = 0.75 (document length normalization)
│   ├── IDF = log((N - df + 0.5) / (df + 0.5) + 1)
│   ├── TF_norm = (tf * (k1+1)) / (tf + k1*(1-b + b*(docLen/avgDocLen)))
│   └── score = Σ(IDF * TF_norm) per query term
│
├── Boosting:
│   ├── Recency bias: score *= 1 + max(0, 1 - ageHours/168)  ← 1 week decay
│   └── Mistake amplification: score *= 1.3 if trade failed/lost  ← learn from mistakes
│
└── Return top 3 memories → injected into AI Market Analyst prompt

Example output to AI:
═══ LESSONS FROM PAST TRADES ═══
── Past Trade #1 (2h ago, LOSS) ──
Action: BUY 0xab12...cd34 — 5 MON via nadfun (slippage: 50bps)
Outcome: SUCCESS — In: 5, Out: 2500 tokens, PnL: -$0.85
Lesson: BUY on RSI=72 resulted in loss. Wait for RSI<65 before buying high-momentum tokens.

── Past Trade #2 (1d ago, PROFIT) ──
Action: SELL 0xef56...gh78 — 3000 tokens via lifi (slippage: 100bps)
Outcome: SUCCESS — In: 3000 tokens, Out: 8.2 MON, PnL: +$1.25
Lesson: SELL at bonding curve 88% was correctly timed. Continue pre-graduation exits above 85%.

IMPORTANT: Do not repeat past mistakes. Apply lessons learned to your current assessment.
```

### AI-Powered Reflection:
```
After a trade completes → AI generates a deeper lesson (non-blocking):

Input to AI (3-tier fallback, 15s timeout):
├── Trade action + outcome + PnL
├── Market conditions at trade time (price, RSI, MACD, volume, bonding curve)
└── "Provide a concise lesson (2-3 sentences) for the agent to improve future decisions"

Example AI reflections:
├── "BUY on RSI=72 resulted in loss. Wait for RSI<65 before buying high-momentum tokens."
├── "SELL at bonding curve 88% was correctly timed. Continue pre-graduation exits above 85%."
├── "Small position (0.5 MON) on low-volume token yielded negligible profit. Increase min size."

Rules:
├── Non-blocking — if AI fails, rule-based lesson is still stored
├── maxTokens: 300, temperature: 0.3, timeoutMs: 15000
├── Lesson is updated in-place in memory cache
└── More in-depth than rule-based extraction
```

### Rule-Based Lesson Extraction:
```
If AI reflection fails, lesson is extracted from rules:

Failed trade:
├── Slippage error → "Slippage was too tight for the available liquidity..."
├── Balance error → "Insufficient balance for this trade..."
├── Revert → "Transaction reverted on-chain. May indicate pool issues..."

Profitable:
├── PnL > $1 → "Very profitable. Look for similar setups..."
├── PnL > $0.1 → "Moderate profit. Continue applying this pattern..."
├── PnL < $0.1 → "Marginally profitable. Consider waiting for stronger signals..."

Loss:
├── PnL < -$1 → "Significant loss. Signal may have been too aggressive..."
├── PnL < -$0.1 → "Loss. Review whether RSI/MACD confirmed direction..."
└── Break-even → "Gas costs ate into gain. Only trade when confidence high enough..."
```

---

## Chart Aggregator (Multi-Source OHLCV)

**File: `src/lib/chart-aggregator.ts` — Pure fetch + cache, no external dependencies**
**Ensures technical analysis works for ALL tokens, not just nad.fun.**

### 3-Source Fallback Chain:
```
getChartDataMultiSource(tokenAddress, '5m', 60) →

Source 1: nad.fun API
├── Endpoint: GET /agent/chart/{token}?resolution=5&countback=60
├── Coverage: bonding curve + graduated tokens on nad.fun
├── Data: real OHLCV candles (timestamp, open, high, low, close, volume)
├── Timeout: 8 seconds
└── Return if candles >= 15

  ↓ fails or < 15 candles

Source 2: GeckoTerminal API
├── Step 1: GET /networks/monad/tokens/{token}/pools → find best pool
├── Step 2: GET /networks/monad/pools/{pool}/ohlcv/minute?aggregate=5&limit=60
├── Coverage: any token that has a DEX pool on Monad
├── Data: real OHLCV candles from on-chain pool data
├── Timeout: 8+10 seconds
└── Return if candles >= 15

  ↓ fails or < 15 candles

Source 3: DexScreener API
├── Endpoint: GET /tokens/v1/monad/{token}
├── Data: priceUsd, vol24h, priceChange 5m/1h/6h/24h
├── Synthetic candles: built from price change interpolation
│   ├── 60 candles × 5 minutes = 5 hours
│   ├── Linear interpolation between known price points
│   └── Noise ±0.5% for realistic OHLC variation
├── Coverage: any token traded on a Monad DEX
└── Return if candles >= 15

Cache: 3-minute TTL per cache key (token:interval:limit)
```

### Token Coverage:
```
├── nad.fun bonding curve tokens → nad.fun API (Source 1)
├── LiFi tokens (WETH, WBTC, USDC, APRMON, etc.) → GeckoTerminal (Source 2)
├── Relay tokens → GeckoTerminal (Source 2)
├── Any DEX-traded token → DexScreener (Source 3)
└── Before chart-aggregator: only nad.fun tokens had technical analysis
    After: ALL tokens have technical analysis — no blind spots
```

---

## Investment Plan Context

**Every trade is evaluated against target portfolio allocation per strategy.**
**Helps AI decide whether a trade aligns with the investment plan.**

### Token Sectors (10 categories):
```
native:        MON, WMON
stablecoin:    USDC, USDT0, AUSD, IDRX
yield-stable:  EARNAUSD, SAUSD, SUUSD, SYZUSD, WSRUSD, LVUSD, YZUSD
eth:           WETH
eth-yield:     WSTETH, WEETH, EZETH, PUFETH
btc:           WBTC, LBTC, SOLVBTC
mon-lst:       APRMON, GMON, SMON, SHMON, EARNMON
memecoin:      CHOG
defi:          APR, CAKE, DUST
cross-chain:   SOL
```

### Target Allocation per Strategy:
```
MOMENTUM:
├── native 20-40%, mon-lst 10-25%, eth 5-15%, btc 5-15%
├── stablecoin 10-30%, defi 5-15%, memecoin 0-10%

YIELD:
├── mon-lst 25-45%, yield-stable 20-35%, eth-yield 10-25%
├── native 5-15%, stablecoin 10-20%, eth 0-10%, btc 0-10%

ARBITRAGE:
├── native 30-50%, stablecoin 20-40%
├── mon-lst 5-15%, eth 5-15%, btc 5-10%

DCA:
├── native 20-35%, mon-lst 15-25%, eth 10-20%, btc 10-20%
├── stablecoin 15-25%, eth-yield 5-10%

GRID:
├── native 25-45%, stablecoin 25-45%
├── mon-lst 5-15%, eth 5-10%, btc 5-10%

HEDGE:
├── stablecoin 40-70%, yield-stable 15-30%
├── native 5-15%, mon-lst 5-15%, eth-yield 0-10%
```

### Example Context to AI:
```
═══ INVESTMENT PLAN ═══
Current Portfolio Allocation:
  native: 65.2% ($97.80 MON)
  mon-lst: 20.1% ($30.15 APRMON)
  stablecoin: 14.7% ($22.05 USDC)

Target Ranges (MOMENTUM strategy):
  native: 20-40% (current: 65.2% → OVER)
  mon-lst: 10-25% (current: 20.1% → OK)
  stablecoin: 10-30% (current: 14.7% → OK)
  eth: 5-15% (current: 0.0% → UNDER)

WARNING: Buying WMON would INCREASE native allocation above target range (40%).
→ AI will lower confidence because the trade worsens portfolio imbalance
```

---

## 3-Router Execution

### Router Auto-Detection (in trade/route.ts):
```
Token enters → check routing:

1. RELAY PATH (solver-based aggregator):
   ├── If router='relay' OR isRelaySupportedToken()
   ├── getRelayQuote() → Relay API
   └── executeRelaySwap() → RelayRouter.multicall()

2. LIFI PATH (DEX aggregator):
   ├── If router='lifi' OR isLiFiSupportedToken()
   ├── For 53 MONAD_TOKENS (WMON, WBTC, WETH, USDC, APRMON, etc.)
   ├── getLiFiQuote() → li.quest/v1/quote
   └── executeLiFiSwap() → LIFI_ROUTER

3. NAD.FUN PATH (bonding curve + graduated DEX):
   ├── Default for tokens NOT in MONAD_TOKENS
   ├── Lens.getAmountOut() → detect router (BondingCurve vs Dex)
   ├── BUY: Router.buy() + send MON
   ├── SELL: sellPermit (EIP-2612) → fallback approve+sell
   └── ABI: bondingCurveRouterAbi / dexRouterAbi

Spread Protection:
├── slippageBps: low=50 (0.5%), medium=100 (1%), high=150 (1.5%)
├── If spread > slippageBps → TX revert → skip trade
├── Margin 1-2%: agent does NOT trade if difference is too large
└── Retry: max 2 attempts, +50% slippage on retry (cap 20%)
```

---

## Rate Limit & Multi-Agent Scaling

### Single Agent (current):
```
Per scheduler cycle (5 minutes):
├── Token discovery: 8 tokens × 2 API calls = 16 calls
├── Market snapshots: 10 tokens × 2 API calls = 20 calls (with cache many are skipped)
├── Holdings: 1 call
├── AI technical analysis: 1 chart data call (only for signal token)
├── Total: ~38 API calls × 6.5s = ~4.1 minutes
└── Cache: after cycle 1, much data is cached → cycle 2 is much faster
```

### Multi-Agent Scaling (future):
```
All agents SHARE the same token pool:
├── Token discovery: 1x per cycle (NOT per agent)
├── Market snapshots: 1x per cycle, cached, shared across all agents
├── Unique per agent: holdings query + strategy evaluation (CPU only)
├── AI advisor: 1 AI call + 1 chart data call per signal per agent

Scenario 10 agents:
├── Shared: 37 API calls (same as 1 agent, due to cache)
├── Per agent: 1 holdings call + 1 AI chart call = 2 API calls
├── Total: 37 + (10 × 2) = 57 API calls
├── With cache: ~30 API calls (many cache hits)
└── Status: STILL within rate limit 10 req/min with throttle

Scenario 50+ agents:
├── Consider: generating nad.fun API key (100 req/min)
├── Or: extending cache TTL from 5 to 10 minutes
└── Or: batch agent evaluation (evaluate sequentially, share all cache)
```

---

## Close & Sweep Agent

### Close Agent:
```
POST /api/agents/{id}/close
├── Agent status → CLOSED
├── Calculate final PnL
├── Settle active delegations
└── Agent is no longer evaluated by the scheduler
```

### Sweep (Auto-Sell + Transfer to Owner):
```
POST /api/agents/{id}/sweep
├── Step 1: Auto-sell ALL token holdings
│   ├── Query TokenHolding → [WETH: 0.00285, CHOG: 5000]
│   ├── SELL WETH → via LiFi
│   ├── SELL CHOG → via nad.fun
│   └── All tokens → MON
├── Step 2: Transfer ALL MON to owner wallet
│   └── sweepAmount = balance - gas → sendTransaction
└── Step 3: Update DB → swept = true, balance = 0
```

---

## Risk Config per Level

| Parameter | Low | Medium | High |
|-----------|-----|--------|------|
| minConfidence | 75 | 60 | 45 |
| maxPositionPct | 5% | 10% | 20% |
| maxDrawdown | 10% | 20% | 35% |
| slippageBps | 50 (0.5%) | 100 (1%) | 150 (1.5%) |

### Risk Guard (5 Pre-Trade Checks):
```
1. Drawdown: current maxDrawdown < maxDrawdownLimit ? → OK / STOP
2. Daily loss: getDailyLoss(agentId) < dailyLossLimit% ? → OK / STOP
3. Daily trades: getDailyTradeCount(agentId) < 50 ? → OK / STOP
4. Min size: amount >= 0.01 MON ? → OK / BLOCK
5. Max exposure: amount < totalCapital * 50% ? → OK / BLOCK
```

### Safety Nets:
```
├── GAS_RESERVE_MON = 5.0 (agent does NOT trade below this)
├── Anti-sniping: skip token < 20 blocks old
├── Failed TX retry: max 2 attempts, +50% slippage, cap 20%
├── Balance check: correct decimals per token (6/8/18)
├── Transaction timeout: 60 seconds
├── sellPermit (EIP-2612): saves ~50% gas
├── Correct ABI selection: bondingCurveRouter vs dexRouter
├── AI fail-safe: if AI is down → trading continues (rule-based)
├── Throttle queue: 6.5s between nad.fun API calls
├── Cache 5 minutes: no redundant API calls
└── Spread protection: slippage > tolerance → TX revert → skip
```

---

## Summary: 6 Strategies vs Trading Profile

| Strategy | Trading Type | Timeframe | Target Tokens | Primary Router |
|----------|-------------|-----------|--------------|-------------|
| **MOMENTUM** | Trend following | 5m + 1h + 4h | nad.fun + MONAD_TOKENS | nad.fun + LiFi + Relay |
| **YIELD** | Value investing | 4h + 1h (no 5m) | 18 yield tokens (LST + stablecoin) | LiFi |
| **ARBITRAGE** | Spread capture | 5m + 1h | 53 MONAD_TOKENS + nad.fun | nad.fun + LiFi + Relay |
| **DCA** | Cost averaging | 4h + 1h (no 5m) | 11 blue-chip | LiFi |
| **GRID** | Range trading | 4h + 1h + 5m | All tokens | nad.fun + LiFi |
| **HEDGE** | Defensive | 4h + 1h (no 5m) | USDC/stablecoin | LiFi |

---

## File Reference

| Component | File |
|----------|------|
| Create Agent + Fee | `src/app/api/agents/route.ts`, `src/app/agents/create/page.tsx` |
| Agent Wallet (HD) | `src/lib/agent-wallet.ts` |
| Scheduler Loop | `src/app/api/scheduler/route.ts` |
| Token Discovery | `src/lib/token-discovery.ts` |
| Strategy Engine (6) | `src/lib/strategy-engine.ts` |
| AI Advisor (Multi-Agent) | `src/lib/ai-advisor.ts` |
| Technical Indicators | `src/lib/technical-indicators.ts` |
| Chart Aggregator | `src/lib/chart-aggregator.ts` |
| Trade Memory + Reflection | `src/lib/trade-memory.ts` |
| Risk Guard | `src/lib/risk-guard.ts` |
| Trade Execute | `src/app/api/trade/route.ts` |
| nad.fun API Client | `src/lib/nadfun-api.ts` |
| LiFi Client | `src/lib/lifi-client.ts` |
| Relay Client | `src/lib/relay-client.ts` |
| PnL Tracker | `src/lib/pnl-tracker.ts` |
| Vault Operator | `src/lib/vault-operator.ts` |
| Contract ABIs | `src/config/contracts.ts` |
| Contract Addresses | `src/config/chains.ts` |
| Close Agent | `src/app/api/agents/[id]/close/route.ts` |
| Sweep Funds | `src/app/api/agents/[id]/sweep/route.ts` |
