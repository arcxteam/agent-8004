# ANOA Technical Documentation

> Internal technical reference for ANOA autonomous trading agent platform.

---

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [AI Advisor System](#ai-advisor-system)
3. [Strategy Engine Internals](#strategy-engine-internals)
4. [Trade Memory (BM25 Okapi)](#trade-memory-bm25-okapi)
5. [Technical Indicators](#technical-indicators)
6. [Chart Data Aggregator](#chart-data-aggregator)
7. [3-Router Trade Execution](#3-router-trade-execution)
8. [Balance Reconciliation](#balance-reconciliation)
9. [PnL Tracking](#pnl-tracking)
10. [Risk Guard](#risk-guard)
11. [Token Discovery](#token-discovery)
12. [HD Wallet System](#hd-wallet-system)
13. [RPC Client](#rpc-client)
14. [nad.fun API Client](#nadfun-api-client)
15. [Yield Protocol Integration](#yield-protocol-integration)
16. [Scheduler System](#scheduler-system)

---

## Environment Configuration

**File**: `src/lib/config.ts`

### Required Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | — (required) |
| `NEXT_PUBLIC_NETWORK` | Network selection | `testnet` |
| `AGENT_MASTER_SEED` | HD wallet master seed (BIP-32) | — |
| `AGENT_PRIVATE_KEY` | Single wallet key (fallback) | — |

### AI Provider Variables

| Variable | Provider | Required |
|----------|----------|----------|
| `CLOUDFLARE_AI_TOKEN` | Cloudflare AI (primary) | Recommended |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account | With CLOUDFLARE_AI_TOKEN |
| `GLM_API_KEY` | GLM-4.7 via z.ai (secondary) | Optional |
| `VIKEY_API_KEY` | Vikey.ai (tertiary) | Optional |

### Network-Specific Variables

| Variable | Mainnet Default | Testnet Default |
|----------|----------------|-----------------|
| `NEXT_PUBLIC_RPC_URL_MAINNET` | `https://rpc3.monad.xyz` | — |
| `NEXT_PUBLIC_RPC_URL_TESTNET` | — | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_EXPLORER_URL_MAINNET` | `https://monadscan.com` | — |
| `NEXT_PUBLIC_EXPLORER_URL_TESTNET` | — | `https://testnet.monadscan.com` |

### Optional Variables

| Variable | Purpose |
|----------|---------|
| `NAD_API_KEY` | nad.fun API key (100 req/min vs 10) |
| `RELAY_API_KEY` | Relay Protocol API key (10 req/sec vs 50 quotes/min) |
| `RELAY_PROXY_API` | Relay proxy URL |
| `NEXT_PUBLIC_COINGECKO_API_KEY` | CoinGecko price data |
| `COINMARKETCAP_API_KEY` | CoinMarketCap fallback |
| `PAY_TO_ADDRESS` | x402 payment recipient (disabled if empty) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 storage |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 storage |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket |
| `R2_ENDPOINT` | Cloudflare R2 endpoint |
| `SCHEDULER_AUTO_LOOP` | Enable auto-loop (`true`/`false`) |
| `SCHEDULER_INTERVAL_MS` | Loop interval (default: 300000 = 5 min) |

### Timeouts

| Constant | Value | Usage |
|----------|-------|-------|
| `RPC_TIMEOUT` | 10,000ms | All RPC calls via `createTimeoutPublicClient` |
| `API_TIMEOUT` | 10,000ms | External API calls |
| MON price cache | 60,000ms | `getMonUsdPrice()` cache TTL |
| nad.fun cache | 300,000ms | In-memory API response cache |

---

## AI Advisor System

**File**: `src/lib/ai-advisor.ts`

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
                                └── Failure → Vikey.ai (DeepSeekV3)
                                                  │
                                                  ├── Success → Return AI verdict
                                                  │
                                                  └── Failure → Pass through original signal unchanged
```

### AI Prompt Structure

The AI receives a structured prompt containing:
1. **Role**: Market Analyst and Risk Manager
2. **Market Data**: Price, volume, holders, market cap
3. **Technical Analysis**: SMA, EMA, RSI, MACD, Bollinger, ATR, VWMA
4. **Portfolio State**: Capital, PnL, current holdings, wallet balance
5. **Past Trade Memories**: Top 3 relevant memories from BM25 retrieval
6. **Trade Signal**: Proposed action, amount, confidence, reasoning
7. **Instructions**: Perform bull/bear debate, output BULLISH/BEARISH/NEUTRAL verdict

### Function Calling (5 Tools)

All providers support OpenAI-compatible function calling. Tools are registered as JSON Schema:

```typescript
tools: [
  {
    type: "function",
    function: {
      name: "get_bonding_curve_status",
      description: "Get on-chain bonding curve progress for a token",
      parameters: { type: "object", properties: { tokenAddress: { type: "string" } } }
    }
  },
  // ... 4 more tools
]
```

When AI calls a tool, the system executes it and returns the result for the AI to incorporate into its analysis.

### Confidence Adjustment

| AI Verdict | Effect on Signal |
|------------|-----------------|
| BULLISH (BUY signal) | Confidence +10 (max 95) |
| BEARISH (BUY signal) | Confidence -20 (may drop below threshold) |
| NEUTRAL | Confidence -5 |
| BULLISH (SELL signal) | Confidence -15 |
| BEARISH (SELL signal) | Confidence +10 |

---

## Strategy Engine Internals

**File**: `src/lib/strategy-engine.ts`

### Risk Parameter Matrix

```typescript
const RISK_PARAMS = {
  low:    { maxPositionPct: 0.05, minConfidence: 75, maxDrawdownLimit: 0.10, gasReserve: 5.0 },
  medium: { maxPositionPct: 0.10, minConfidence: 60, maxDrawdownLimit: 0.20, gasReserve: 3.0 },
  high:   { maxPositionPct: 0.20, minConfidence: 45, maxDrawdownLimit: 0.35, gasReserve: 1.0 },
};
```

### MOMENTUM Strategy Scoring

For each token in the pool:

1. **Fetch market data** via `getMarketData(token)` and `getTokenMetrics(token, ['5m', '1h', '6h', '24h'])`
2. **Calculate momentum score** (weighted):
   - 5m price change × 0.15 (noise filter)
   - 1h price change × 0.35 (direction)
   - 4h/6h price change × 0.30 (trend context)
   - 24h price change × 0.20 (macro trend)
3. **Anti-sniping**: Skip tokens created < 5 blocks ago
4. **Bonding curve intelligence**: Query on-chain LENS for curve progress
   - Avoid tokens > 85% graduated (about to leave bonding curve)
   - Prefer tokens with healthy holder distribution
5. **Position sizing**: `amount = totalCapital × maxPositionPct`
   - Ensure `amount + gasReserve < walletBalance`
6. **Sell signal**: Check existing holdings, generate SELL if momentum reverses

### AgentContext Interface

```typescript
interface AgentContext {
  id: string;
  strategy: StrategyType;
  riskLevel: RiskLevel;
  totalCapital: number;       // MON (reconciled with on-chain)
  totalPnl: number;           // MON
  maxDrawdown: number;
  walletAddr?: string;
  walletBalance?: number;     // Native MON balance
  holdings?: Array<{          // nad.fun + ERC-20 merged
    token: string;
    symbol: string;
    balance: string;
    value: string;
  }>;
  dailyLossLimit?: number;
  maxDailyTrades?: number;
}
```

---

## Trade Memory (BM25 Okapi)

**File**: `src/lib/trade-memory.ts`

### Storage

Trade memories are stored as Prisma Execution records with rich context:

```typescript
interface TradeMemory {
  situation: string;    // Market context at time of trade
  action: string;       // "buy TOKEN 1.5 MON" or "sell TOKEN 0.8"
  outcome: string;      // What happened after the trade
  lesson: string;       // Extracted wisdom
  timestamp: Date;
  pnlUsd: number;
  profitable: boolean;
}
```

### BM25 Retrieval Algorithm

When a new trade is being considered, the system retrieves relevant past trades:

1. **Tokenize** the current market situation into terms
2. **Score** each past trade memory using BM25 Okapi formula:
   ```
   score = Σ IDF(term) × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × dl/avgdl))
   ```
   - k1 = 1.5 (term frequency saturation)
   - b = 0.75 (document length normalization)
3. **Recency bias**: Multiply score by `1 / (1 + daysSinceTradeAge × 0.1)`
4. **Mistake amplification**: Losing trades get 2× score multiplier
5. **Return top 3** most relevant memories

### Integration Point

Trade memories are injected into the AI advisor prompt:
```
PAST TRADE MEMORIES (learn from these):
1. [2 days ago] Bought TOKEN_X during pump → Lost 15%. Lesson: Don't chase 5m spikes without 1h confirmation.
2. [5 days ago] Sold TOKEN_Y at RSI 80 → Correct exit. Lesson: RSI overbought + declining volume = good exit.
```

---

## Technical Indicators

**File**: `src/lib/technical-indicators.ts`

### Candle Data Format

```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Indicator Implementations

| Indicator | Function | Parameters | Output |
|-----------|----------|------------|--------|
| **SMA** | `computeSMA(closes, period)` | period: 10, 50 | Moving average value |
| **EMA** | `computeEMA(closes, period)` | period: 10 | Exponential average |
| **RSI** | `computeRSI(closes, period)` | period: 14 | 0-100 oscillator |
| **MACD** | `computeMACD(closes, fast, slow, signal)` | 12, 26, 9 | {macd, signal, histogram} |
| **Bollinger** | `computeBollingerBands(closes, period, stddev)` | 20, 2 | {upper, middle, lower} |
| **ATR** | `computeATR(candles, period)` | 14 | Average True Range value |
| **VWMA** | `computeVWMA(candles, period)` | 20 | Volume-weighted average |

### Technical Report

The `getTechnicalReport(tokenAddress)` function returns a human-readable string:
```
=== Technical Analysis Report ===
Price: 0.00234 MON
1h Change: +5.2%  |  4h Change: +12.1%
SMA(10): 0.00221  |  SMA(50): 0.00198
EMA(10): 0.00228  |  Price > EMA = Bullish
RSI(14): 62.4 (Neutral zone)
MACD: 0.00012 | Signal: 0.00008 | Histogram: +0.00004 (Bullish crossover)
Bollinger: Upper 0.00265 | Middle 0.00221 | Lower 0.00177
ATR(14): 0.00045 (Moderate volatility)
VWMA(20): 0.00225
```

Returns `null` for insufficient candle data (no incorrect values produced).

---

## Chart Data Aggregator

**File**: `src/lib/chart-aggregator.ts`

### 3-Source Fallback Chain

```
Request for OHLCV data
    │
    ├── Cache hit? → Return cached candles (source: "cache")
    │
    ├── nad.fun API → getChartData(token, interval, limit)
    │   └── Success → Return candles (source: "nadfun")
    │
    ├── DexScreener API → /dex/chart/{pair}
    │   └── Success → Return candles (source: "dexscreener")
    │
    └── GeckoTerminal API → /networks/monad/pools/{pool}/ohlcv
        └── Success → Return candles (source: "geckoterminal")
```

### Cache Configuration

| Parameter | Value |
|-----------|-------|
| TTL | 3 minutes |
| Max entries | 100 |
| Auto-purge | Expired entries cleaned on access |

### Result Type

```typescript
interface ChartResult {
  candles: Candle[];
  source: 'nadfun' | 'dexscreener' | 'geckoterminal' | 'cache';
  tokenSymbol?: string;
}
```

---

## 3-Router Trade Execution

**File**: `src/app/api/trade/route.ts`

### Router Selection

```typescript
// 1. Check if token is on nad.fun bonding curve
if (isNadFunToken(tokenAddress)) {
  // Use bonding curve router for buy, DEX router for sell
  return executeNadFunTrade(action, tokenAddress, amount, agentWallet);
}

// 2. Check if token is in MONAD_TOKENS (LiFi supported)
if (isLiFiSupportedToken(tokenAddress)) {
  return executeLiFiTrade(action, tokenAddress, amount, agentWallet);
}

// 3. Check Relay availability
return executeRelayTrade(action, tokenAddress, amount, agentWallet);
```

### nad.fun Trade Flow

**Buy**: Native MON → token via Bonding Curve Router
```
1. Query LENS for price quote
2. Calculate minTokensOut with slippage
3. walletClient.sendTransaction({ to: bondingCurveRouter, value: amountMON, data: buyCalldata })
4. Wait for receipt
5. Parse Transfer event for actual tokens received
```

**Sell**: token → MON via Bonding Curve Router
```
1. Check token allowance for router
2. If needed: approve(bondingCurveRouter, amount)
3. walletClient.writeContract({ functionName: 'sell', args: [token, amount, minOut] })
4. Wait for receipt
```

### LiFi Trade Flow

```
1. getLiFiQuote({ fromToken: MON, toToken: target, amount, fromAddress: agentWallet })
2. Check approval: publicClient.readContract(erc20, 'allowance', [wallet, approvalAddress])
3. If needed: walletClient.writeContract(erc20, 'approve', [approvalAddress, amount])
4. walletClient.sendTransaction(quote.transactionRequest)
5. publicClient.waitForTransactionReceipt(txHash)
6. Verify receipt.status !== 'reverted'
```

### Relay Trade Flow

```
1. getRelayQuote({ fromToken, toToken, amount, wallet })
2. executeRelaySwap(quote, walletClient, publicClient)
3. Transaction sent via Relay solver network
4. Wait for receipt
```

---

## Balance Reconciliation

**Files**: `src/app/api/agents/route.ts`, `src/app/api/leaderboard/route.ts`, `src/app/api/scheduler/route.ts`, `src/app/api/agents/[id]/sync/route.ts`

### Problem

`totalCapital` in DB is only updated via trade PnL increments. Direct transfers, gas costs, and other on-chain activity cause drift between DB and on-chain reality.

### Solution

Every major API endpoint performs reconciliation:

```typescript
// 1. Query on-chain balance + holdings
const [balance, nadfunHoldings, erc20Holdings] = await Promise.all([
  publicClient.getBalance({ address: walletAddr }),
  getHoldings(walletAddr),         // nad.fun bonding curve tokens
  getERC20Holdings(publicClient, walletAddr), // 52 MONAD_TOKENS via multicall
]);

// 2. Merge holdings (deduplicate by address)
const holdingsMap = new Map();
for (const h of nadfunHoldings.holdings) holdingsMap.set(h.token.toLowerCase(), h);
for (const h of erc20Holdings.holdings) {
  if (!holdingsMap.has(h.token.toLowerCase())) holdingsMap.set(h.token.toLowerCase(), h);
}

// 3. Calculate total on-chain value
const walletBalanceMon = Number(balance) / 1e18;
let holdingsValueMon = 0;
for (const h of mergedHoldings) holdingsValueMon += parseFloat(h.value || '0');
const totalOnChainValue = walletBalanceMon + holdingsValueMon;

// 4. Update if drift > 0.1 MON
if (Math.abs(totalOnChainValue - dbCapital) > 0.1) {
  await prisma.agent.update({ where: { id }, data: { totalCapital: totalOnChainValue } });
}
```

### ERC-20 Holdings (getERC20Holdings)

**File**: `src/lib/lifi-client.ts`

Uses viem's `multicall` to batch query `balanceOf()` for all MONAD_TOKENS:

- 52 tokens queried in 1-2 RPC calls
- Deduplicates tokens sharing same address (USDT0/USDT)
- MON-denominated value: WMON + MON LSTs ≈ 1:1, others = '0'
- Non-zero balances only returned

---

## PnL Tracking

**File**: `src/lib/pnl-tracker.ts`

### MON/USD Price Feed

Priority chain with 60-second cache:

```
1. Memory cache (if < 60s old) → Return cached price
2. CoinGecko API → GET /simple/price?ids=monad&vs_currencies=usd
3. CoinMarketCap API → GET /v1/cryptocurrency/quotes/latest?symbol=MON
4. Stale cache (any age) → Return stale price as last resort
5. Error → throw (caller handles gracefully)
```

### Post-Trade PnL Recording

After every successful trade execution:
1. `getMonUsdPrice()` → current MON/USD rate
2. Calculate `pnlMon = outputAmount - inputAmount`
3. Calculate `pnlUsd = pnlMon × monPrice`
4. Record `Execution` with `pnlUsd`, `amountUsd`
5. Update `Agent.totalPnl += pnlMon`, `Agent.totalTrades++`
6. Update `Agent.winRate = wins / totalTrades × 100`
7. Upsert `TokenHolding` with `avgCostBasis` calculation

---

## Risk Guard

**File**: `src/lib/risk-guard.ts`

### Pre-Trade Checks

Called before every auto-executed trade:

```typescript
function checkRiskLimits(agent, trade): { ok: boolean; reason?: string }
```

| Check | Condition | Result if Failed |
|-------|-----------|-----------------|
| **Gas reserve** | walletBalance - tradeAmount < gasReserve | Blocked |
| **Max position** | tradeAmount > totalCapital × maxPositionPct | Blocked |
| **Daily loss limit** | dayLosses > totalCapital × dailyLossLimit% | Blocked |
| **Max daily trades** | todayTrades >= maxDailyTrades | Blocked |
| **Max drawdown** | currentDrawdown > maxDrawdownLimit | Blocked |
| **Minimum capital** | totalCapital < minimum threshold | Blocked |

---

## Token Discovery

**File**: `src/lib/token-discovery.ts`

### Discovery Flow

```
1. Query nad.fun for recent CurveCreate events (new tokens)
2. Query nad.fun for recent buy/sell events (active trading)
3. Rank tokens by trading activity (volume, unique traders)
4. Enrich top 8 tokens with market data (2 API calls each)
5. Return sorted by activity score
6. Rate limit aware: max 16 nad.fun API calls per discovery cycle
```

### Integration with Scheduler

```typescript
// Scheduler calls discovery first
const discovered = await discoverTradableTokens([]);

// Add diversity tokens from MONAD_TOKENS (LiFi/Relay)
const diversityTokens = randomSample(MONAD_TOKENS, 3);

// Cap total at 10 tokens to respect API rate limits
allTokens = [...discovered, ...diversityTokens].slice(0, 10);
```

---

## HD Wallet System

**File**: `src/lib/agent-wallet.ts`

### BIP-32 Derivation

Each agent gets an isolated wallet derived from a master seed:

```
Master Seed (AGENT_MASTER_SEED)
    └── m/44'/60'/0'/0/0 → Agent 0 wallet
    └── m/44'/60'/0'/0/1 → Agent 1 wallet
    └── m/44'/60'/0'/0/N → Agent N wallet
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `isHDWalletConfigured()` | Check if AGENT_MASTER_SEED is set |
| `generateNextWalletIndex()` | Get next available index from DB |
| `deriveWalletAddress(index)` | Derive address for index (public) |
| `getAgentWallet(index)` | Get full wallet (private key) for signing |

### Security

- Master seed never leaves the server
- Each agent wallet is deterministically reproducible
- `walletIndex` stored in DB for recovery
- If `AGENT_PRIVATE_KEY` is set instead, all agents share one wallet (dev mode)

---

## RPC Client

**File**: `src/lib/rpc-client.ts`

### Timeout Protection

All RPC calls are wrapped with automatic timeout:

```typescript
function createTimeoutPublicClient(chain, rpcUrl, timeout = 10000): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout, retryCount: 2, retryDelay: 1000 }),
  });
}
```

### Utilities

| Function | Purpose |
|----------|---------|
| `withTimeout(promise, ms, label)` | Wrap any promise with timeout |
| `safeRpcCall(fn, timeout, label)` | Returns `{ success, data }` or `{ success: false, error }` |
| `createTimeoutPublicClient(chain, url, timeout)` | Create viem client with timeout transport |

---

## nad.fun API Client

**File**: `src/lib/nadfun-api.ts`

### Rate Limiting

| Mode | Rate | Interval |
|------|------|----------|
| Without API key | 10 req/min | 6.5s between requests |
| With `NAD_API_KEY` | 100 req/min | 650ms between requests |

Throttle queue automatically manages request spacing.

### Endpoints

| Function | API Path | Returns |
|----------|----------|---------|
| `getMarketData(token)` | `/agent/market/{token}` | price, volume, holders, marketCap |
| `getTokenMetrics(token, timeframes)` | `/agent/metrics/{token}` | Price change per timeframe |
| `getSwapHistory(token, limit, page)` | `/agent/swap-history/{token}` | Recent swaps |
| `getChartData(token, interval, limit)` | `/agent/chart/{token}` | OHLCV candles |
| `getHoldings(address)` | `/agent/holdings/{address}` | Bonding curve token holdings |
| `getTokenInfo(token)` | `/agent/token/{token}` | Token metadata (name, symbol, graduated) |

### Caching

- In-memory cache with 5-minute TTL
- Max 200 entries, auto-purge on overflow
- Cache key = API path

---

## Yield Protocol Integration

**Files**: `src/app/api/yield/route.ts`, `src/app/api/yield/deposit/route.ts`

### aPriori (Liquid Staking)

| Parameter | Value |
|-----------|-------|
| Contract | `0x0c65A0BC65a5D819235B71F554D210D3F80E0852` |
| Asset | MON → aprMON |
| Type | Liquid staking (ERC-4626 compatible) |
| APY Source | `https://stake-api-prod.apr.io/monad` |

### Upshift (Yield Vault)

| Parameter | Value |
|-----------|-------|
| Contract | `0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA` |
| Asset | aUSD → earnAUSD |
| Type | ERC-4626 vault |
| Withdrawal | Instant (up to limit) or Delayed (request + claim) |
| APY Source | `https://api.upshift.finance/api/public/vault` |

### Deposit Flow

```
1. Validate deposit amount and protocol
2. Setup wallet client for agent
3. Check token approval for protocol contract
4. Execute deposit transaction
5. Record YieldDeposit in DB with received shares
6. Track via TokenHolding
```

---

## Scheduler System

**File**: `src/app/api/scheduler/route.ts`

### POST /api/scheduler — Run Evaluation Cycle

1. **Token Discovery**: `discoverTradableTokens()` from nad.fun events
2. **Diversity**: Add 3 random MONAD_TOKENS for LiFi/Relay coverage
3. **Cap**: Max 10 tokens per cycle (rate limit respect)
4. **Per Agent**:
   - Check cooldown (5-min minimum between evaluations)
   - Fetch wallet balance + holdings (nad.fun + ERC-20)
   - Balance reconciliation (drift > 0.1 MON → DB update)
   - Run `evaluateStrategy()` with full market data
   - autoExecute = true → Risk guard → Trade API → Record
   - autoExecute = false → Create TradeProposal (PENDING)
5. **Auto-loop**: If `SCHEDULER_AUTO_LOOP=true`, schedule next run via `setTimeout`

### GET /api/scheduler — Status

Returns:
- Active agent count
- Auto-execute agent count
- Pending proposals count
- Last run results (signals, proposals, executions, errors)

### Cooldown

```typescript
const MIN_EVAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const lastEvalTime = new Map<string, number>(); // In-memory, resets on restart
```

---

## Contract ABIs Reference

**File**: `src/config/contracts.ts`

| ABI | Functions | Usage |
|-----|-----------|-------|
| `lensAbi` | `getQuote`, `getCurveData` | Price quotes, bonding curve intelligence |
| `curveAbi` | `getProgress`, `isGraduated` | Bonding curve state |
| `routerAbi` | `buy`, `sell` | nad.fun trade execution |
| `bondingCurveRouterAbi` | `createAndBuy`, `buy`, `sell` | Bonding curve trading |
| `dexRouterAbi` | `exactInputSingle` | Graduated token trading |
| `erc20Abi` | `balanceOf`, `approve`, `transfer` | Standard ERC-20 operations |
| `identityRegistryAbi` | `register`, `setMetadata`, `tokenURI` | ERC-8004 identity |
| `reputationRegistryAbi` | `giveFeedback`, `getSummary` | ERC-8004 reputation |
| `aprMonAbi` | `deposit`, `requestWithdrawal`, `claimWithdrawal` | aPriori staking |
| `upshiftVaultAbi` | `deposit`, `redeem`, `requestRedeem` | Upshift vault |
| `anoaAgentIdentityAbi` | `register`, `setHandle`, `setCapabilities` | ANOA identity |
| `anoaAgentReputationAbi` | `recordScore`, `getScore` | ANOA reputation |
| `capitalVaultAbi` | `delegateCapital`, `withdrawCapital`, `payRegistrationFee`, `releaseFundsToAgent`, `returnFundsFromAgent`, `setAgentWallet`, `batchRecordPnl`, `withdrawFees` | Capital vault (flow-through model) |

---

*Last Updated: February 2026*
