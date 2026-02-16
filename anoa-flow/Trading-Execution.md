# ANOA: Trading Execution — 3-Router Architecture, PnL, Risk

> Complete explanation of on-chain trade execution: from signal to transaction.
> Last updated: February 2026

---

## Table of Contents

1. [Overview: 3-Router Architecture](#overview-3-router-architecture)
2. [Router Selection Logic](#router-selection-logic)
3. [nad.fun Bonding Curve Execution](#nadfun-bonding-curve-execution)
4. [LiFi DEX Aggregator Execution](#lifi-dex-aggregator-execution)
5. [Relay Protocol Execution](#relay-protocol-execution)
6. [Wallet Signing Flow](#wallet-signing-flow)
7. [Token Universe (52 Tokens)](#token-universe-52-tokens)
8. [PnL Calculation](#pnl-calculation)
9. [Risk Metrics](#risk-metrics)
10. [Risk Guard (Pre-Trade Checks)](#risk-guard-pre-trade-checks)
11. [Post-Trade Pipeline](#post-trade-pipeline)
12. [x402 Micropayment Protection](#x402-micropayment-protection)
13. [GAP Analysis](#gap-analysis)

---

## Overview: 3-Router Architecture

**Primary file:** `src/app/api/trade/route.ts` (1,119 lines)

```
POST /api/trade
{ tokenAddress, amount, action, agentId, slippageBps?, router? }

                    +-------------------+
                    | Router Selection   |
                    | (auto-detect)      |
                    +---------+---------+
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
    +-----------------+ +-----------------+ +-----------------+
    | nad.fun          | | LiFi             | | Relay            |
    | Bonding Curve    | | DEX Aggregator   | | Protocol         |
    |                  | |                  | |                  |
    | Lens -> Router   | | Quote -> Swap    | | Quote -> Execute |
    | contracts        | | API              | | Solver           |
    | (on-chain)       | | (on-chain)       | | (on-chain)       |
    +-----------------+ +-----------------+ +-----------------+
```

### Contract Addresses (Mainnet):

| Router | Address | Purpose |
|--------|---------|---------|
| **nad.fun Bonding Curve** | `0x6F6B8F1a20703309951a5127c45B49b1CD981A22` | Buy/sell bonding curve tokens |
| **nad.fun DEX** | `0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137` | Graduated token trading |
| **nad.fun LENS** | `0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea` | Price quotes + curve data |
| **LiFi** | `0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37` | DEX aggregator (52 tokens) |
| **Relay** | `0x3eC130B627944cad9b2750300ECB0A695DA522B6` | Solver-based routing |
| **Relay Approval** | `0x58cC3e0aA6CD7bf795832A225179ec2d848cE3e7` | ERC-20 approval proxy |

---

## Router Selection Logic

**File:** `src/app/api/trade/route.ts` (lines 196-202)

```
Token received for trade
    |
    +-- router='relay' explicit?  ---- Yes ---> Relay Protocol
    |
    +-- router='lifi' explicit?   ---- Yes ---> LiFi Router
    |
    +-- router='nadfun' explicit? ---- Yes ---> nad.fun Router
    |
    +-- Auto-detect:
        |
        +-- In MONAD_TOKENS (52 tokens)?  ---- Yes ---> LiFi (preferred)
        |
        +-- Relay supported token?        ---- Yes ---> Relay Protocol
        |
        +-- Default (nad.fun bonding curve token) -----> nad.fun Router
```

### Decision Priority:

```typescript
// 1. Relay: explicit or auto-detect (Relay-only tokens)
useRelay = routerPreference === 'relay' || (
  !isLiFiSupportedToken(tokenAddress) &&
  isRelaySupportedToken(tokenAddress)
);

// 2. LiFi: explicit or auto-detect (52 MONAD_TOKENS)
useLiFi = !useRelay && (
  routerPreference === 'lifi' || isLiFiSupportedToken(tokenAddress)
);

// 3. nad.fun: everything else (bonding curve tokens)
useNadFun = !useRelay && !useLiFi;
```

**LiFi is preferred over Relay** when both support a token, because LiFi has been tested more extensively.

---

## nad.fun Bonding Curve Execution

**Contracts:** Lens (read) + Router (write) + Curve (state)
**File API:** `src/lib/nadfun-api.ts` (308 lines) -- data API (read-only)
**File ABI:** `src/config/contracts.ts` -- lensAbi, routerAbi, bondingCurveRouterAbi, dexRouterAbi, curveAbi

### Bonding Curve Architecture:

```
+-------------------------------------------------------------+
|                   nad.fun Bonding Curve                        |
|                                                               |
|  +----------+    +----------+    +--------------------+       |
|  |  Lens    |    |  Curve   |    |  Router             |       |
|  | (View)   |    | (State)  |    | (Execute)           |       |
|  |          |    |          |    |                      |       |
|  | getAmount|    | reserves:|    | buy(params)          |       |
|  | Out()    |--->| realMON  |    | sell(params)         |       |
|  |          |    | realToken|    | sellPermit(params)   |       |
|  | returns: |    | virtual  |    | exactOutBuy(params)  |       |
|  | [router, |    | MON/Token|    | exactOutSellPermit() |       |
|  |  amtOut] |    |          |    |                      |       |
|  +----------+    +----------+    +--------------------+       |
+-------------------------------------------------------------+
```

### BUY Flow (trade/route.ts lines 319-601):

```
1. Lens.getAmountOut(token, amountIn, isBuy=true)
   -> Returns: [routerAddress, expectedAmountOut]

2. VALIDATION:
   -> routerAddress !== 0x0 (token must exist on nad.fun)
   -> amountOut !== 0 (liquidity must exist)

3. Detect router type:
   -> BondingCurveRouter (pre-graduation) or DexRouter (post-graduation)

4. Calculate minAmountOut = amountOut * (10000 - slippageBps) / 10000
   -> Default slippage: 1% (100 bps)

5. Router.buy({
     token: tokenAddress,
     to: agentWallet,
     amountOutMin: minAmountOut,
     deadline: now + 300s,
   }, { value: amountIn })
   -> Sends MON (native), receives tokens

6. Wait receipt (60s timeout), check not reverted
   -> If revert: RETRY 1x with slippage +50% (max 20%)
7. Return { txHash, amountIn, amountOut, gasUsed }
```

### SELL Flow (trade/route.ts lines 319-601):

**With EIP-2612 sellPermit (saves ~50% gas):**

```
1. Lens.getAmountOut(token, amountIn, isBuy=false)
   -> Returns: [routerAddress, expectedAmountOut]

2. VALIDATION (same as BUY)
   -> routerAddress !== 0x0, amountOut !== 0

3. Detect router type (BondingCurve vs Dex)

4. Calculate amountOutMin with slippage

5. TRY: sellPermit (1 transaction, saves gas)
   a. Fetch token name + nonce for EIP-2612
   b. Sign permit off-chain (EIP-712 typed data):
      - owner: agentWallet
      - spender: routerAddress
      - value: amountIn
      - nonce: from token contract
      - deadline: now + 300s
   c. parseSignature(sig) -> { v, r, s }
   d. Router.sellPermit({
        amountIn, amountOutMin, amountAllowance: amountIn,
        token, to: agentWallet, deadline, v, r, s
      })
   -> 1 TX: permit + sell in 1 call

6. CATCH: Fallback approve + sell (2 transactions)
   -> Token may not support EIP-2612
   a. ERC20.approve(routerAddress, amountIn)
   b. Wait receipt (60s timeout)
   c. Router.sell({ amountIn, amountOutMin, token, to, deadline })

7. Wait receipt (60s timeout), check not reverted
   -> If revert: RETRY 1x with slippage +50% (max 20%)
8. Return { txHash, amountIn, amountOut, gasUsed }
```

### Failed TX Retry Mechanism:

```
+-------------------------------------------------------------+
| RETRY MECHANISM -- nad.fun execution path                      |
|                                                               |
| Quote Phase (NOT retried):                                    |
| +-- Lens.getAmountOut() -> [router, amountOut]               |
| +-- Validate router != 0x0                                   |
| +-- Validate amountOut != 0                                  |
|                                                               |
| Execution Phase (MAX 2 attempts):                             |
| +-- Attempt 1: slippage = slippageBps (default 100 = 1%)    |
| |   +-- Send TX (buy or sellPermit/approve+sell)             |
| |   +-- Wait receipt (60s timeout)                           |
| |   +-- If reverted -> catch, log, continue to attempt 2    |
| |                                                             |
| +-- Attempt 2: slippage = min(slippageBps * 1.5, 2000)      |
|     +-- Fresh deadline                                       |
|     +-- Relaxed amountOutMin                                 |
|     +-- If still fails -> throw error                        |
+-------------------------------------------------------------+
```

### nad.fun Data API (nadfun-api.ts, 308 lines):

| Endpoint | Function | Returns |
|----------|----------|---------|
| `getMarketData(token)` | Price, volume, holders | MarketData |
| `getTokenMetrics(token)` | Price change per timeframe | TokenMetrics |
| `getSwapHistory(token)` | Past swaps | SwapRecord[] |
| `getChartData(token)` | OHLCV candles | ChartCandle[] |
| `getHoldings(wallet)` | Wallet token holdings | Holding[] |
| `getTokenInfo(token)` | Token metadata | TokenInfo |

**URLs:**
- Testnet: `https://dev-api.nad.fun`
- Mainnet: `https://api.nadapp.net`

**Rate Limiting:**
| Mode | Rate | Interval |
|------|------|----------|
| Without `NAD_API_KEY` | 10 req/min | 6.5s between requests |
| With `NAD_API_KEY` | 100 req/min | 650ms between requests |

---

## LiFi DEX Aggregator Execution

**File:** `src/lib/lifi-client.ts` (472 lines)
**LiFi Router:** `0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37`

### Quote + Execute Flow (trade/route.ts lines 258-317):

```
1. getLiFiQuote({
     fromToken: 'MON',
     toToken: 'WETH',
     amount: '1.5',
     fromAddress: agentWalletAddress,
     slippageBps: 100,
   })
   -> Resolve token symbols to MONAD_TOKENS addresses
   -> POST https://li.quest/v1/quote
   -> Return: LiFiQuote { transactionRequest, fromAmount, toAmount }

2. executeLiFiSwap(quote, walletClient, publicClient)
   -> Check ERC20 allowance (if fromToken != native)
   -> If insufficient: approve(LiFi_ROUTER, amount)
   -> Validate tx.to === LIFI_ROUTER (security check)
   -> walletClient.sendTransaction(tx)
   -> Wait receipt, verify not reverted
   -> Return: { txHash, fromAmount, toAmount, gasUsed }
```

### ERC20 Approval Logic (lifi-client.ts):

```typescript
// Check current allowance
const currentAllowance = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'allowance',
  args: [walletAddress, LIFI_ROUTER],
});

// Approve if needed
if (currentAllowance < amountBigInt) {
  const approveTx = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [LIFI_ROUTER, amountBigInt],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
}
```

### Security Validation:

```typescript
// CRITICAL: Verify LiFi response targets the correct router
if (txRequest.to.toLowerCase() !== LIFI_ROUTER.toLowerCase()) {
  throw new Error('LiFi transaction target mismatch - potential attack');
}
```

---

## Relay Protocol Execution

**File:** `src/lib/relay-client.ts` (288 lines)
**Relay Router:** `0x3eC130B627944cad9b2750300ECB0A695DA522B6`
**Relay Approval Proxy:** `0x58cC3e0aA6CD7bf795832A225179ec2d848cE3e7`

### Quote + Execute Flow (trade/route.ts lines 212-257):

```
1. getRelayQuote({
     fromToken: tokenAddress,
     toToken: 'MON',
     amount: amountWei,
     wallet: agentWalletAddress,
   })
   -> Calls Relay SDK: client.actions.getQuote()
   -> Same-chain swap (chainId: 143 -> 143)
   -> tradeType: 'EXACT_INPUT'
   -> Return: RelayQuote { steps, fees, outputAmount }

2. executeRelaySwap(relayQuote, walletClient)
   -> Calls Relay SDK: client.actions.execute()
   -> Wallet signs and sends transaction
   -> onProgress callback captures txHash and amounts
   -> Return: { txHash, fromAmount, toAmount }
```

### Retry Logic:

```
MAX_RELAY_ATTEMPTS = 2

Attempt 1:
+-- getRelayQuote() -> fresh quote
+-- executeRelaySwap() -> execute
+-- If fails -> continue to attempt 2

Attempt 2:
+-- getRelayQuote() -> re-quote (fresh price)
+-- executeRelaySwap() -> retry
+-- If still fails -> throw error
```

### Functions in relay-client.ts:

| Function | Lines | Description |
|----------|-------|-------------|
| `getRelayQuote()` | 97-156 | Get swap quote from Relay solver |
| `executeRelaySwap()` | 167-232 | Execute swap using Relay SDK |
| `isRelayAvailable()` | 275-277 | Check if Relay SDK is available |
| `isRelaySupportedToken()` | 283-287 | Check if token is in supported list |

---

## Wallet Signing Flow

```
+-------------------------------------------------------------+
| WALLET SIGNING -- All Trading Transactions                     |
|                                                               |
| 1. getAgentAccount(agentId)                                  |
|    +-- Query DB: agent.walletIndex                           |
|    +-- mnemonicToAccount(AGENT_MASTER_SEED, walletIndex)     |
|    +-- Return: LocalAccount (HD-derived)                     |
|                                                               |
| 2. createWalletClient({                                      |
|      chain: monadMainnet/Testnet,                            |
|      transport: http(rpcUrl),                                |
|      account: localAccount,  <-- HD wallet per-agent         |
|    })                                                        |
|                                                               |
| 3. All transactions signed by this agent's wallet:           |
|    +-- nad.fun Router.buy()       -> agent signs             |
|    +-- nad.fun Router.sell()      -> agent signs             |
|    +-- nad.fun sellPermit()       -> agent signs (EIP-2612)  |
|    +-- ERC20.approve()            -> agent signs             |
|    +-- LiFi swap tx               -> agent signs             |
|    +-- Relay swap tx              -> agent signs             |
|    +-- Gas paid by agent wallet                              |
|                                                               |
| NOTE: Reputation feedback uses HD wallet when agentDbId      |
| is provided (agent0-service.ts). See Wallet-Architecture.md. |
+-------------------------------------------------------------+
```

---

## Token Universe (52 Tokens)

### LiFi/Relay Supported Tokens (MONAD_TOKENS, lifi-client.ts):

**52 tokens** across these categories:

| Category | Count | Examples |
|----------|-------|---------|
| Native & Wrapped | 2 | MON, WMON |
| Stablecoins | 8 | USDC, USDT0/USDT, AUSD, IDRX, USD*, USD1 |
| Yield Stablecoins | 8 | earnAUSD, sAUSD, suUSD, syzUSD, wsrUSD, lvUSD, yzUSD, THBILL |
| ETH Variants | 6 | WETH, wstETH, weETH, ezETH, pufETH, suETH |
| BTC Variants | 6 | WBTC, BTC.B, LBTC, solvBTC, xSolvBTC, suBTC |
| MON Staking/LST | 7 | aprMON, gMON, sMON, shMON, earnMON, lvMON, mcMON |
| Cross-chain | 2 | SOL, XAUT0 |
| DeFi Protocols | 8 | CAKE, DUST, EUL, FOLKS, NXPC, MVT, LV, YZPP |
| Mu Digital | 3 | AZND, LOAZND, MUBOND |
| Midas | 2 | MEDGE, MHYPER |
| Custom | 2 | CHOG, APR |

### nad.fun Tokens:

All tokens listed on the nad.fun bonding curve platform. No fixed list -- verified via `Lens.getAmountOut()`. If Lens returns a valid router + amount, the token is supported.

### Router Selection per Token Type:

| Token Type | Router | Reason |
|------------|--------|--------|
| Any token in `MONAD_TOKENS` (52) | LiFi (preferred) | High liquidity, tested path |
| Relay-only supported tokens | Relay | Solver-based routing |
| nad.fun bonding curve tokens | nad.fun | On-chain bonding curve |

### ERC-20 Holdings Query (getERC20Holdings):

`lifi-client.ts` includes `getERC20Holdings()` which uses viem `multicall` to batch query `balanceOf()` for all 52 MONAD_TOKENS in 1-2 RPC calls. This supplements nad.fun's `getHoldings()` which only returns bonding curve tokens.

---

## PnL Calculation

**File:** `src/lib/pnl-tracker.ts` (142 lines)

### MON/USD Price Feed:

```
Priority chain with 60-second cache:

1. Memory cache (if < 60s old) --> Return cached price
2. CoinGecko API --> GET /simple/price?ids=monad&vs_currencies=usd
3. CoinMarketCap API --> GET /v1/cryptocurrency/quotes/latest?symbol=MON
4. Stale cache (any age) --> Return stale price as last resort
5. Error --> throw (caller handles gracefully)
```

### PnL Calculation -- Capital Flow Model:

```typescript
async function calculatePnlUsd(amountIn: number, amountOut: number, action: string) {
  const monPrice = await getMonUsdPrice();

  // Capital flow model:
  // BUY:  PnL = -(MON spent)     -> capital outflow
  // SELL: PnL = +(MON received)  -> capital inflow
  const pnlMon = action === 'buy'
    ? -amountIn    // MON spent (outflow)
    : amountOut;   // MON received (inflow)
  const pnlUsd = pnlMon * monPrice;

  return { pnlMon, pnlUsd, monPrice };
}
```

### TokenHolding Cost Basis Tracking:

**File:** `src/app/api/trade/route.ts` -- `updateTokenHolding()`

```
+-----------------------------------------------------+
| Cost Basis Tracking (via Prisma TokenHolding)          |
|                                                       |
| BUY: upsert TokenHolding                             |
| +-- If new: create { balance, avgBuyPrice, cost }    |
| +-- If exists: weighted average update               |
|     +-- newBalance = oldBalance + tokensReceived      |
|     +-- newTotalCost = oldTotalCost + monSpent        |
|     +-- newAvgPrice = newTotalCost / newBalance       |
| +-- Result: avgBuyPrice per token position            |
|                                                       |
| SELL: update TokenHolding                             |
| +-- sellPrice = monReceived / tokensSold              |
| +-- realizedPnl += (sellPrice - avgBuyPrice) * qty    |
| +-- balance -= tokensSold                             |
| +-- totalCost -= avgBuyPrice * tokensSold (pro-rata)  |
+-----------------------------------------------------+
```

**Prisma model:**

```prisma
model TokenHolding {
  walletAddr  String
  tokenAddr   String
  balance     Decimal  @db.Decimal(78, 18)
  avgBuyPrice Decimal? @db.Decimal(78, 18)
  totalCost   Decimal? @db.Decimal(78, 18)
  realizedPnl Decimal  @default(0)
  @@unique([walletAddr, tokenAddr])
}
```

---

## Risk Metrics

**File:** `src/lib/risk-metrics.ts` (91 lines)

### Sharpe Ratio:

```typescript
function calculateSharpeRatio(executions: Execution[]): number {
  // 1. Extract PnL from each execution
  const returns = executions
    .filter(e => e.status === 'SUCCESS' && e.pnl != null)
    .map(e => Number(e.pnl));

  // 2. Calculate mean return
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  // 3. Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // 4. Annualize: Sharpe = (mean / stdDev) * sqrt(250)
  // Capped at [-5, 5]
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(250) : 0;
  return Math.max(-5, Math.min(5, sharpe));
}
```

### Max Drawdown:

```typescript
function calculateMaxDrawdown(executions: Execution[]): number {
  // 1. Sort by executedAt
  // 2. Calculate cumulative PnL series
  // 3. Track peak (highest cumulative PnL)
  // 4. Track drawdown (current - peak)
  // 5. Return largest drawdown as percentage

  let peak = 0, maxDrawdown = 0, cumulative = 0;
  for (const exec of sorted) {
    cumulative += Number(exec.pnl);
    peak = Math.max(peak, cumulative);
    const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}
```

### Win Rate:

```typescript
function calculateWinRate(executions: Execution[]): number {
  const completed = executions.filter(e => e.status === 'SUCCESS');
  const winners = completed.filter(e => Number(e.pnl) > 0);
  return completed.length > 0 ? (winners.length / completed.length) * 100 : 0;
}
```

### Update After Trade:

After each trade, all metrics are recalculated from the full execution history:

```typescript
const executions = await prisma.execution.findMany({
  where: { agentId, status: 'SUCCESS' },
  orderBy: { executedAt: 'asc' },
});
const metrics = calculateAllMetrics(executions);
await prisma.agent.update({
  where: { id: agentId },
  data: {
    totalPnl: { increment: pnlUsd },
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    maxDrawdown: metrics.maxDrawdown,
    sharpeRatio: metrics.sharpeRatio,
  },
});
```

---

## Risk Guard (Pre-Trade Checks)

**File:** `src/lib/risk-guard.ts` (162 lines)

### checkRiskLimits() -- 5 Pre-Trade Checks:

Called before every auto-executed trade:

| # | Check | Condition | Result if Failed |
|---|-------|-----------|------------------|
| 1 | **Drawdown Limit** | maxDrawdown > risk level limit (low: 10%, medium: 20%, high: 35%) | Blocked |
| 2 | **Daily Loss Limit** | Today's cumulative losses > dailyLossLimit% of capital | Blocked |
| 3 | **Daily Trade Count** | Today's trades >= maxDailyTrades | Blocked |
| 4 | **Minimum Trade Size** | amount < 0.01 MON | Blocked |
| 5 | **Buy Capital Check** | BUY amount > 50% of totalCapital | Blocked |

### Fail-Closed Design:

```
getDailyLoss():
+-- Query Prisma for today's executions
+-- Sum PnL values
+-- On DB error: returns -Infinity (blocks trade)

getDailyTradeCount():
+-- Query Prisma for today's execution count
+-- On DB error: returns Infinity (blocks trade)
```

Risk guard is **fail-closed**: if the database is unreachable, trades are blocked rather than allowed.

---

## Post-Trade Pipeline

After successful on-chain transaction (trade/route.ts):

```
+-----------------------------------------------------+
| Post-Trade Pipeline (after tx receipt)                 |
|                                                       |
| 1. Update Execution record -> SUCCESS                |
|    +-- status: SUCCESS                               |
|    +-- pnl: calculated PnL (USD, capital flow model) |
|    +-- txHash: on-chain tx hash                      |
|    +-- gasUsed: from receipt                         |
|    +-- result: { amountIn, amountOut, ... }          |
|                                                       |
| 2. Update Agent metrics                              |
|    +-- totalPnl += pnlUsd                            |
|    +-- totalTrades = recalculated                    |
|    +-- winRate = recalculated                        |
|    +-- sharpeRatio = recalculated                    |
|    +-- maxDrawdown = recalculated                    |
|                                                       |
| 3. Sync agent capital                                |
|    +-- totalCapital += pnlMon                        |
|                                                       |
| 4. Record trade memory (NON-BLOCKING)                |
|    +-- Store situation + action + outcome + lesson   |
|    +-- Used by BM25 Okapi for future trade decisions |
|                                                       |
| 5. Submit reputation feedback (NON-BLOCKING)         |
|    +-- Save to Prisma Feedback table                 |
|    +-- Submit to ERC-8004 Reputation Registry        |
|    +-- Uses HD wallet when agentDbId provided        |
|                                                       |
| 6. Distribute PnL to delegators (NON-BLOCKING)      |
|    +-- Pro-rata: (delegation / totalCapital) * pnl   |
|    +-- Performance fee: 20% on profits only          |
|    +-- Update delegations in Prisma $transaction     |
|    +-- Record on-chain via vault (best-effort)       |
|                                                       |
| 7. Create trade validation artifact (NON-BLOCKING)   |
|    +-- POST /api/validations                         |
|                                                       |
| 8. Update TokenHolding cost basis (NON-BLOCKING)     |
|    +-- BUY: upsert with weighted avg price           |
|    +-- SELL: reduce balance, calc realized PnL       |
|                                                       |
| 9. Return response to client                         |
|    { success: true, txHash, pnl, metrics }           |
+-----------------------------------------------------+
```

---

## x402 Micropayment Protection

**File:** `src/lib/x402-server.ts` (113 lines)

```
Trade API protected by x402 micropayments:
- Price: $0.001 USDC per trade
- Only if PAY_TO_ADDRESS ENV is set
- Uses @x402/next middleware
- Payment via HTTP 402 protocol
- Facilitator: https://x402-facilitator.molandak.org
- USDC (Mainnet): 0x754704Bc059F8C67012fEd69BC8A327a5aafb603

If PAY_TO_ADDRESS not set -> trades are FREE (development mode)
```

---

## GAP Analysis

| Issue | Status |
|-------|--------|
| nad.fun bonding curve BUY/SELL | WORKING (on-chain) |
| LiFi DEX aggregator swap (52 tokens) | WORKING (on-chain) |
| Relay Protocol solver swap | WORKING (on-chain) |
| 3-Router auto-detection | WORKING |
| Per-agent HD wallet signing | WORKING |
| ERC20 approval handling | WORKING |
| Slippage protection | WORKING (default 1%) |
| PnL calculation (capital flow model) | WORKING |
| Risk metrics (Sharpe/DD/WR) | WORKING |
| CoinGecko price feed | WORKING (1-min cache) |
| CoinMarketCap fallback price | WORKING |
| x402 micropayment | WORKING (optional) |
| EIP-2612 sellPermit | WORKING (saves ~50% gas) |
| Router address validation | WORKING (non-zero check + LiFi target check) |
| Receipt timeout (60s) | WORKING |
| Cost basis tracking per-token | WORKING (TokenHolding) |
| Failed tx retry mechanism | WORKING (max 2 attempts, +50% slippage for nad.fun, re-quote for Relay) |
| PnL distribution to delegators | WORKING (pro-rata, 20% fee) |
| Balance check before trade | WORKING (MON + token + gas reserve) |
| Risk guard (5 pre-trade checks) | WORKING (fail-closed) |
| Trade memory recording | WORKING (BM25 Okapi retrieval) |
| Anti-sniping awareness | WORKING (skip tokens < 5 blocks old) |
| AI advisor with function calling | WORKING (5 tools) |
| Gas price optimization | NOT IMPLEMENTED |
| Multi-hop routing (LiFi) | WORKING (automatic via LiFi API) |

---

## File References

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/api/trade/route.ts` | 1,119 | 3-router trade execution endpoint |
| `src/lib/lifi-client.ts` | 472 | LiFi DEX aggregator + MONAD_TOKENS + getERC20Holdings |
| `src/lib/relay-client.ts` | 288 | Relay Protocol solver integration |
| `src/lib/nadfun-api.ts` | 308 | nad.fun data API (6 endpoints) |
| `src/lib/pnl-tracker.ts` | 142 | PnL + MON/USD price (CoinGecko -> CoinMarketCap) |
| `src/lib/risk-metrics.ts` | 91 | Sharpe ratio, drawdown, win rate |
| `src/lib/risk-guard.ts` | 162 | 5 pre-trade safety checks (fail-closed) |
| `src/lib/trade-memory.ts` | - | BM25 Okapi trade memory storage + retrieval |
| `src/lib/ai-advisor.ts` | 1,024 | AI advisor with 5 function calling tools |
| `src/lib/agent-wallet.ts` | 146 | HD wallet for signing |
| `src/lib/x402-server.ts` | 113 | Micropayment middleware |
| `src/lib/vault-operator.ts` | 124 | On-chain PnL recording |
| `src/lib/token-discovery.ts` | 358 | On-chain token discovery (nad.fun events) |
| `src/lib/strategy-engine.ts` | 1,012 | 6 strategies + gas reserve + anti-sniping |
| `src/config/contracts.ts` | 1,907 | ABI: lensAbi, routerAbi, bondingCurveRouterAbi, dexRouterAbi, curveAbi, erc20Abi |
| `src/config/chains.ts` | 158 | Monad chain config + RPC + contract addresses |

---

*Last Updated: February 2026*
