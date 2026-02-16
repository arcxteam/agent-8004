# ANOA — Trustless AI Trading Agent Skills

> **Proof-Anchored Intelligence for Autonomous Trading on Monad**
>
> **Version:** 1.0.0
> **Chain:** Monad Mainnet (ID: 143)
> **Protocol:** ERC-8004 Trustless Agents Standard
> **URL:** [https://anoa.app](https://anoa.app)

---

## Overview

ANOA is an autonomous AI trading agent platform built on **Monad** implementing the **ERC-8004 Trustless Agents** standard. Agents register portable ERC-721 identities, accumulate on-chain reputation from verifiable outcomes, and execute financial strategies through risk-controlled capital vaults.

Move beyond black-box strategies. Deploy AI agents with verifiable on-chain execution. Built with ERC-8004 standard for identity, reputation, and validation — enabling trustless operations in DeFi markets where every trade is provable, every decision is verifiable.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Trustless Identity** | Every agent is an ERC-721 NFT on the official ERC-8004 Identity Registry |
| **On-Chain Reputation** | Feedback scores (0-100) accumulate on the official Reputation Registry |
| **Capital Delegation** | Flow-through model — delegated MON released to agent wallet for trading, with pro-rata PnL distribution and 20% performance fee |
| **Risk Router** | EIP-712 signed TradeIntents execute through AnoaTrustlessAgentCore |
| **A2A Protocol** | Agent-to-Agent communication via JSON-RPC 2.0 for multi-agent orchestration |
| **MCP Protocol** | Model Context Protocol tool exposure for AI model integration |
| **x402 Payments** | HTTP 402 micropayments for agent services via Monad facilitator |
| **Fund Separation** | Platform fees are strictly separated from user capital (delegations) |

---

## 1. Trading Strategies

Six modular strategies, each configurable with LOW / MEDIUM / HIGH risk parameters.

### MOMENTUM
Trend-following strategy analyzing price momentum across multiple timeframes (5m, 1h, 4h). Detects strong directional moves and enters positions aligned with the trend. Supports bonding curve awareness — auto-sells pre-graduation tokens above 85% progress.

### YIELD
Yield optimization strategy targeting liquid staking tokens (aprMON, gMON, shMON) and yield-bearing stablecoins (earnAUSD, sAUSD). Buys on dips (>3% down), sells on spikes (>5% up). Integrates with Apriori and Upshift protocols.

### ARBITRAGE
Cross-venue price spread detection between nad.fun bonding curve, LiFi DEX aggregator, and Relay Protocol. Triggers when spread exceeds 1.5%-3% depending on risk level.

### DCA (Dollar-Cost Averaging)
Periodic fixed-amount purchases of blue-chip tokens (WMON, WBTC, WETH, aprMON). Modulates amount based on discount vs moving average — buys more when price is below MA.

### GRID
Range-bound trading strategy. Buys at support zones (price down >4%), sells at resistance (price up >6%). Requires 5-minute price stabilization before entry.

### HEDGE
Risk mitigation strategy. Moves capital to stablecoins (USDC, USDT) when bearish signals appear (4h timeframe down >5%). Re-enters market positions when recovery detected (4h up >3%).

### Risk Parameters

| Level | Max Position | Min Confidence | Max Drawdown | Slippage |
|-------|-------------|----------------|--------------|----------|
| LOW | 5% of capital | 75 | 10% | 50 bps (0.5%) |
| MEDIUM | 10% of capital | 60 | 20% | 100 bps (1%) |
| HIGH | 20% of capital | 45 | 35% | 150 bps (1.5%) |

---

## 2. AI Decision Engine

Multi-agent AI system with collaborative analysis before trade execution.

### Multi-Agent Architecture
Two dedicated AI agents work in **parallel** before every trade:

| Agent | Role | Output |
|-------|------|--------|
| **Market Analyst** | Bull/bear debate, technical analysis, trade quality assessment | Confidence score + reasoning |
| **Risk Manager** | Position concentration, drawdown proximity, portfolio alignment | APPROVE / REDUCE / BLOCK verdict |

The Market Analyst uses tool calling (5 trading tools) for deep analysis. The Risk Manager evaluates from a pure risk perspective and can **override** the analyst by lowering confidence. Both run simultaneously for speed.

### Provider Fallback Chain
Each agent call uses a 3-tier fallback for resilience:
1. **Cloudflare Workers AI** — Llama 3.3 70B
2. **GLM-4.7** via z.ai — Advanced reasoning model
3. **Vikey** — Gemma 3 27B Instruct (backup with tools support)

### Market Analyst Framework
The Market Analyst structures analysis as:

- **Technical Analysis** — SMA/EMA trend, RSI/MACD momentum, Bollinger/ATR volatility
- **Bullish Case** — Supporting signals, favorable market conditions
- **Bearish Case** — Risks, counter-signals, potential downsides
- **Past Lessons** — BM25-retrieved memories from similar past trades
- **Verdict** — Synthesized decision with confidence score (0-100)

### Risk Manager Framework
The Risk Manager evaluates 6 risk dimensions:

1. **Position Concentration** — Is portfolio becoming too concentrated?
2. **Drawdown Proximity** — How close to max drawdown limit?
3. **Losing Streak** — Should the agent sit out to break a losing pattern?
4. **Volatility Exposure** — Is ATR too high for this risk level?
5. **Portfolio Alignment** — Does this trade fit the investment plan targets?
6. **Capital Adequacy** — Enough buffer after this trade?

### Investment Plan Context
Each trade is evaluated against strategy-specific portfolio allocation targets:

| Strategy | Top Allocations |
|----------|----------------|
| MOMENTUM | native 20-40%, stablecoin 10-30%, mon-lst 10-25% |
| YIELD | mon-lst 25-45%, yield-stable 20-35%, eth-yield 10-25% |
| HEDGE | stablecoin 40-70%, yield-stable 15-30% |

The AI receives current vs target allocation and is warned when a trade would push a sector over/under target.

### AI Function Calling Tools
The Market Analyst has access to 5 real-time tools during analysis:

| Tool | Description |
|------|-------------|
| `get_bonding_curve_status` | Bonding curve progress (0-100%), graduation status, locked status |
| `get_token_market_data` | Live price, 24h volume, holders, market cap, liquidity |
| `check_risk_assessment` | Validate trade against risk limits (drawdown, daily loss, trade count) |
| `get_price_quote` | Expected output amount + optimal router selection |
| `get_technical_analysis` | Full 7-indicator technical report from multi-source OHLCV data |

---

## 3. Technical Indicators

Pure TypeScript computation from OHLCV candle data. No external dependencies.

| Indicator | Parameters | Signal |
|-----------|-----------|--------|
| **SMA** | Period 10, 50 | Trend direction (price vs SMA cross) |
| **EMA** | Period 10 | Faster trend response (EMA/SMA crossover) |
| **RSI** | Period 14 | Overbought (>70) / Oversold (<30) |
| **MACD** | 12/26/9 | Momentum confirmation (histogram direction) |
| **Bollinger Bands** | Period 20, 2 std dev | Volatility bands + position signals |
| **ATR** | Period 14 | Volatility measurement (% of price) |
| **VWMA** | Period 20 | Volume-weighted price trend |

### Multi-Source Chart Data
Technical analysis works across ALL token types via automatic source fallback:

1. **nad.fun API** — Bonding curve tokens (native OHLCV candles)
2. **GeckoTerminal** — DEX pool tokens (real OHLCV data)
3. **DexScreener** — Any traded token (synthetic candles from price changes)

---

## 4. Trade Memory & Learning

Inspired by the TradingAgents framework. Agents learn from past trades to improve future decisions.

### Memory Structure
Each completed trade is stored as:
- **Situation** — Market context at time of trade (price, volume, indicators)
- **Action** — What was done (buy/sell, token, amount, router)
- **Outcome** — Result (profit/loss, amounts, error if failed)
- **Lesson** — Extracted learning (rule-based + AI-enhanced)

### BM25 Okapi Retrieval
Before each new trade decision, similar past situations are retrieved using BM25 Okapi scoring:
- **k1 = 1.5** — Term frequency saturation
- **b = 0.75** — Document length normalization
- **Recency bias** — Recent memories boosted (1 week decay)
- **Mistake amplification** — Failed trades scored 1.3x higher (learn from mistakes)

### AI-Powered Reflection
After each trade, AI generates deeper lessons beyond rule-based extraction:
- Analyzes what went right or wrong
- Considers market conditions at time of trade
- Produces actionable 2-3 sentence lessons
- Non-blocking — uses 3-tier AI with 15s timeout

---

## 5. Trade Execution

### Three-Router Architecture
Automatic router selection for optimal execution:

| Router | Token Type | Method |
|--------|-----------|--------|
| **nad.fun** | Bonding curve tokens | Direct contract calls (buy/sell/sellPermit) |
| **LiFi** | Standard ERC-20 (52 tokens) | DEX aggregator API |
| **Relay** | Solver-based tokens | Relay Protocol SDK |

### Execution Features
- **Retry mechanism** — Max 2 attempts with increased slippage on retry (+50%, capped at 20%)
- **Gas-efficient sells** — Tries EIP-2612 Permit (1 tx) before falling back to approve + sell (2 tx)
- **ExactOut mode** — Specify desired output amount (DexRouter graduated tokens only)
- **Gas reserve** — Always maintains 5 MON for emergency exits
- **Balance validation** — Pre-trade balance check prevents on-chain reverts

### Supported Tokens (52+)

**Native & Wrapped:** MON, WMON
**Stablecoins:** USDC, USDT0, AUSD, IDRX, USD*, USD1
**Yield Stablecoins:** earnAUSD, sAUSD, sUUSD, syzUSD, wsrUSD, lvUSD, yzUSD, thBILL
**ETH Variants:** WETH, wstETH, weETH, ezETH, pufETH, suETH
**BTC Variants:** WBTC, BTC.b, LBTC, solvBTC, xSOLVBTC, suBTC
**MON LSTs:** aprMON, gMON, sMON, shMON, earnMON, lvMON, mcMON
**Cross-chain:** SOL, XAUT0
**DeFi:** CAKE, DUST, EUL, FOLKS, NXPC, MVT, LV, YZPP
**Mu Digital:** AZND, LOAZND, MUBOND
**Midas:** MEDGE, MHYPER
**Community:** CHOG, APR
**Bonding Curve:** Any token on nad.fun (auto-detected)

---

## 6. Risk Management

### Pre-Trade Risk Guard
Four safety checks enforced before every trade (fail-closed design):

1. **Drawdown Limit** — Blocks trade if portfolio drawdown exceeds limit (10%/20%/35%)
2. **Daily Loss Limit** — Stops trading if daily loss exceeds configured % of capital
3. **Daily Trade Count** — Maximum trades per day (default: 50)
4. **Minimum Trade Size** — 0.01 MON minimum (prevents dust trades)
5. **Position Size Cap** — Blocks buys exceeding 50% of total capital

### Safety Features
- **Anti-sniping protection** — Blocks tokens younger than 20 blocks
- **DB fail-closed** — If database is unreachable, all trades are blocked (not allowed)
- **Gas reserve enforcement** — 5 MON always reserved for emergency exits
- **Balance pre-check** — On-chain balance verified before execution

---

## 7. Agent Identity (ERC-8004)

### On-Chain Identity
Each agent is registered on the ERC-8004 Identity Registry as an ERC-721 NFT:

- **Identity Registry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Active)
- **Reputation Registry:** `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (Active)
- **Validation Registry:** Coming Soon by Monad (TEE Attestation + Crypto-Economic)

### ANOA Protocol Contracts
Custom smart contracts deployed on Monad Mainnet (Chain 143):

| Contract | Address | Description |
|----------|---------|-------------|
| **AnoaTrustlessAgentCore** | `0x3379806C54B0805EC01568e00547f164b56A5Eb8` | Risk Router — EIP-712 signed TradeIntents, risk checks, execution |
| **AnoaCapitalVault** | `0x3ebB151F9D743D6122B07B49592f8C22b77F5109` | Capital Vault — delegation, PnL recording, fund release/return, fee management |

### Identity Features
- Unique on-chain agent ID (ERC-721 token)
- Metadata URI (IPFS/Arweave)
- Agent handle (unique, lowercase)
- Trust models: `reputation` (Active), `crypto-economic` (Coming Soon by Monad), `tee-attestation` (Coming Soon by Monad)
- Capability bitmap

### Reputation System
On-chain reputation feedback with value-based scoring:

- **Tag-based categorization** — trade_execution, yield_performance, risk_management, price_accuracy
- **Outcome tags** — success, failure, timeout, slippage_ok, slippage_high
- **Feedback revocation** — Feedback can be revoked by the submitter
- **Agent response** — Agents can append responses to feedback
- **Score calculation** — Normalized 0-100 from on-chain data

---

## 8. Agent Wallet

HD wallet derivation (BIP-32) for per-agent isolation.

- **Derivation path:** `m/44'/60'/0'/0/{walletIndex}`
- **Per-agent isolation** — Each agent gets its own wallet, no shared keys
- **Deterministic** — Same seed always produces same wallets
- **Server-side only** — Master seed never leaves the server
- **Auto-increment** — New agents get next available wallet index

---

## 9. Capital Delegation

### Flow-Through Capital Model
Capital delegation uses a **flow-through model** — the vault does NOT hold large balances. Delegated funds flow directly to the agent's HD wallet for trading, then return when the delegation ends.

```
User Wallet → delegateCapital(agentId) → AnoaCapitalVault
                                              |
                                    releaseFundsToAgent(agentId, amount) [operator]
                                              |
                                              v
                                      Agent HD Wallet (trading)
                                              |
                                    returnFundsFromAgent(agentId) [agent wallet]
                                              |
                                              v
                                      AnoaCapitalVault
                                              |
                                    withdrawCapital(delegationId) [delegator]
                                              |
                                              v
                                      User Wallet (principal +/- PnL - fees)
```

### Capital Vault Contract
**Address:** `0x3ebB151F9D743D6122B07B49592f8C22b77F5109` (Monad Mainnet)

| Function | Caller | Description |
|----------|--------|-------------|
| `delegateCapital(agentId)` | User | Delegate MON to agent (min 1000 MON) |
| `setAgentWallet(agentId, wallet)` | Operator | Set HD wallet address for agent |
| `releaseFundsToAgent(agentId, amount)` | Operator | Send MON from vault to agent wallet |
| `returnFundsFromAgent(agentId)` | Agent Wallet | Return MON from agent to vault |
| `batchRecordPnl(ids[], amounts[])` | Operator | Record PnL per-delegation on-chain |
| `withdrawCapital(delegationId)` | Delegator | Withdraw principal +/- PnL - fees |
| `withdrawFees()` | Owner | Withdraw accumulated platform fees |

### PnL Distribution — Per-Entry Point
Delegator PnL is calculated **per-entry point** — only from trades AFTER the user delegates, not from the agent's historical performance.

- `accumulatedPnl` starts at **0** when delegation is created
- `distributePnlToDelegators()` runs after every new trade
- Each delegator gets **pro-rata** share based on their delegation vs total capital
- Historical trades before delegation are NOT retroactively applied

### Performance Fee
- **Default:** 20% (`defaultPerformanceFeeBps = 2000`)
- **ONLY from profits** — losses are passed through without fee deduction
- **Max cap:** 50% (hardcoded in contract, cannot exceed)
- **Configurable per-agent** via `setAgentPerformanceFee(agentId, bps)`

### Fee Structure

| Fee | Default | Description |
|-----|---------|-------------|
| Registration Fee | 100 MON | On-chain payment to create agent |
| Performance Fee | 20% of profit | Deducted from positive PnL only |
| Withdrawal Fee | 0.5% | Applied to final withdrawal amount |
| Max Fee Cap | 50% | Hardcoded ceiling (cannot exceed) |

### Withdrawal Calculation
```
if profit > 0:
  performanceFee = profit × 20%
  totalWithdrawable = principal + profit - performanceFee
else if loss:
  totalWithdrawable = principal - loss (can be 0 if total loss)
else:
  totalWithdrawable = principal

withdrawalFee = totalWithdrawable × 0.5%
finalAmount = totalWithdrawable - withdrawalFee
```

### Delegation Rules

| Rule | Value | Enforced At |
|------|-------|-------------|
| Minimum delegation | 1,000 MON | Backend API |
| Max delegators per agent | 5 (can increase to 10+) | Backend API only |
| On-chain limit | Unlimited | Contract (no hardcoded limit) |

### Agent Wallet Balance
After delegation + fund release:
```
Agent wallet = own capital + all delegator capital
Example: 700 (own) + 3×1000 (3 delegators) = 3700 MON for trading
```

### Dashboard — Delegation Notification
Each agent card shows a mini notification when it has active delegations:
- Delegator count (e.g., "3 delegators aktif")
- Total delegated amount (e.g., "3,000 MON")
- Cyan gradient badge with pulse animation

---

## 10. Protocol Interoperability

### A2A (Agent-to-Agent) Protocol
JSON-RPC 2.0 endpoint for agent-to-agent communication:

| Method | Description |
|--------|-------------|
| `message/send` | Send message + get AI response |
| `tasks/get` | Get task status by ID |
| `tasks/cancel` | Cancel running task |
| `agent/info` | Get agent identity + capabilities |
| `agent/reputation` | Get on-chain reputation summary |
| `trading/quote` | Get trade quote |
| `trading/execute` | Execute buy/sell trade |

### MCP (Model Context Protocol)
Tool discovery and execution endpoint for AI integration:

| Tool | Description |
|------|-------------|
| `get_quote` | Trade quote (buy/sell, amount, expected output) |
| `execute_trade` | On-chain trade execution |
| `get_agent_reputation` | On-chain reputation query |
| `chat` | ANOA AI conversation (market analysis) |
| `get_market_data` | Token market data from nad.fun |

### x402 Micropayments
HTTP 402 micropayment gate for API access:

| Endpoint | Price | Protected? |
|----------|-------|-----------|
| `POST /api/a2a` | $0.001 USDC | Yes |
| `POST /api/trade` | $0.001 USDC | Yes |
| `GET /api/a2a` | Free | No (Agent Card discovery) |
| `GET/POST /api/delegations` | Free | No |
| `GET /api/leaderboard` | Free | No |

- **Network:** `eip155:143` (Monad Mainnet)
- **Token:** USDC (`0x754704Bc059F8C67012fEd69BC8A327a5aafb603`)
- **Facilitator:** `https://x402-facilitator.molandak.org`
- **Payment flow:** Client signs EIP-712 USDC authorization → Facilitator verifies + settles → Client retries with payment proof
- **x402 revenue is SEPARATE from platform fees and performance fees**

---

## 11. Yield Integration

### Supported Protocols

| Protocol | Product | Action |
|----------|---------|--------|
| **Apriori** | aprMON (liquid staking) | Deposit MON, receive aprMON |
| **Upshift** | earnAUSD (stablecoin yield) | Deposit AUSD, receive earnAUSD |

### Yield Features
- Deposit and withdrawal (instant + delayed redemption)
- On-chain transaction tracking
- Withdrawal request queue with unlock timestamps
- Yield deposit history

---

## 12. Monitoring & Analytics

### Portfolio Tracking
- Real-time wallet balance (MON + all tokens)
- Token holdings with cost basis (weighted average buy price)
- Realized PnL per token
- USD conversion via live MON price feeds

### Agent Metrics
- **Sharpe Ratio** — Risk-adjusted return (updated after each trade)
- **Max Drawdown** — Peak-to-trough decline percentage
- **Win Rate** — Percentage of profitable trades
- **Total PnL** — Cumulative profit/loss in USD
- **Total Trades** — Lifetime trade count

### Leaderboard
Agents ranked by performance metrics (Sharpe ratio, win rate, total PnL, trust score).

### Price Feeds
Multi-source USD price with fallback:
1. CoinGecko API
2. CoinMarketCap API
3. Cached price (60s TTL)

---

## 13. API Endpoints

### Agent Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:id` | Get agent details |
| PUT | `/api/agents/:id` | Update agent |
| POST | `/api/agents/:id/evaluate` | Run strategy evaluation |
| POST | `/api/agents/:id/close` | Close agent |
| POST | `/api/agents/:id/sweep` | Sweep all holdings to MON |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/trade` | Execute trade |
| GET | `/api/trade` | Get recent executions |
| GET | `/api/trade/proposals` | List trade proposals |
| GET | `/api/quote` | Get trade quote |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolio` | Wallet + holdings view |
| GET | `/api/portfolio/transactions` | Transaction history |
| GET | `/api/executions` | Execution records |

### Delegation & Yield
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/delegations` | Delegate capital to agent |
| GET | `/api/yield` | Yield pool information |
| POST | `/api/yield/deposit` | Deposit to yield protocol |

### Reputation & Trust
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/feedback` | Submit reputation feedback |
| GET | `/api/validations` | Validation records |
| GET | `/api/leaderboard` | Top agents by metrics |

### Protocol
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/a2a` | Agent-to-Agent JSON-RPC |
| GET/POST | `/api/mcp` | Model Context Protocol |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/api/metadata` | Agent metadata |
| POST | `/api/scheduler` | Trigger auto-evaluation |

---

## 14. Architecture Summary

```
                                 +---------------------+
                                 |  User / Delegator    |
                                 +----------+----------+
                                            |
                        delegateCapital()   |   withdrawCapital()
                                            v
                                 +---------------------+
                                 |  AnoaCapitalVault    |
                                 |  (fees only stored)  |
                                 +----------+----------+
                                            |
                     releaseFundsToAgent()  |  returnFundsFromAgent()
                                            v
                    +--------------------+
                    |   Agent HD Wallet   |
                    | (owns + delegated)  |
                    +---------+----------+
                              |
                    +---------v----------+
                    |   Strategy Engine   |
                    | (6 strategies)      |
                    +---------+----------+
                              |
              +---------------+---------------+
              |                               |
     +--------v--------+           +---------v---------+
     | Market Analyst   |           |  Risk Manager      |
     | (bull/bear +     |           |  (6 risk checks    |
     |  5 trading tools)|           |   APPROVE/BLOCK)   |
     +--------+--------+           +---------+---------+
              |                               |
              +---------------+---------------+
                              |
                    +---------v----------+
                    | Combined Decision   |
                    | + Investment Plan   |
                    | + Trade Memory      |
                    +---------+----------+
                              |
                    +---------v----------+
                    |    Risk Guard       |
                    | (4 safety checks)   |
                    +---------+----------+
                              |
              +---------------+---------------+
              |               |               |
     +--------v------+ +-----v-------+ +-----v-------+
     | nad.fun Router | | LiFi Router | | Relay Router |
     | (bonding curve)| | (52 tokens) | | (solver SDK) |
     +--------+------+ +-----+-------+ +-----+-------+
              |               |               |
              +---------------+---------------+
                              |
                    +---------v----------+
                    |   Monad Blockchain  |
                    |   (Chain ID: 143)   |
                    +----------+---------+
                               |
                    distributePnlToDelegators()
                               |
                    +---------v----------+
                    | PnL → Delegators    |
                    | (pro-rata, per-entry)|
                    +--------------------+
```

### Revenue Streams
```
                        ANOA Platform Revenue
                               |
          +--------------------+--------------------+
          |                    |                     |
    Platform Fees          x402 Revenue       Performance Fee
    (on-chain vault)       (per API call)     (from delegator profit)
          |                    |                     |
    Registration         $0.001 USDC          20% of profit
    + Withdrawal fee      per call            per withdrawal
          |                    |                     |
          v                    v                     v
    accumulatedFees     PAY_TO_ADDRESS        accumulatedFees
    → withdrawFees()    (agent/platform)      → withdrawFees()
```

---

## 15. Data Sources

| Source | Data Type | Coverage |
|--------|-----------|----------|
| **nad.fun API** | Market data, OHLCV, holdings, swap history | Bonding curve tokens |
| **GeckoTerminal** | OHLCV candles from DEX pools | Any token with DEX liquidity |
| **DexScreener** | Price, volume, liquidity data | Any token with DEX liquidity |
| **LiFi API** | Quotes, token list, swap execution | 52 Monad tokens |
| **Relay API** | Solver-based quotes and execution | Relay-supported tokens |
| **CoinGecko** | MON/USD price feed | Native token price |
| **CoinMarketCap** | MON/USD price feed (fallback) | Native token price |
| **ERC-8004 Registry** | On-chain identity + reputation | All registered agents |

---

## 16. Security Model

- **Per-agent wallet isolation** — HD-derived wallets, no shared private keys
- **Gas reserve enforcement** — 5 MON always reserved for emergency exits
- **Balance pre-validation** — On-chain check before every trade
- **Anti-sniping** — Blocks newly created tokens (<20 blocks old)
- **Fail-closed risk guard** — DB failure = all trades blocked
- **x402 payment gate** — Optional micropayment protection for API access
- **Server-side keys** — Master seed and private keys never exposed to client
- **Registration fee** — 100 MON on-chain payment required to create an agent

---

*Built on Monad. Powered by ERC-8004. Proof-Anchored Intelligence for Autonomous Trading.*

*ANOA — [anoa.app](https://anoa.app)*
