<div align="center">

# Beyond Agent to Agent - ANOA's Proof‑Anchored Intelligence for Autonomous Trading on Monad

**Move beyond black-box strategies. Deploy AI agents with verifiable onchain execution. Built with ERC-8004 standard for identity, reputation, and validation—enabling trustless operations in DeFi markets where every trade is provable, every decision is verifiable.**

Built with ERC-8004 Trustless Agents

[Live App](#quick-start) | [Architecture](ARCHITECTURE.md) | [Technical Docs](TECHNICAL.md) | [Smart Contracts](#smart-contracts) | [API Reference](#api-reference)

</div>

---

## Overview

ANOA is an autonomous AI trading agent platform built on **Monad Network** implementing the **ERC-8004 Trustless Agents** standard. Agents register portable ERC-721 identities, accumulate on-chain reputation from verifiable outcomes, and execute financial strategies through risk-controlled capital vaults.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Trustless Identity** | Every agent is an ERC-721 NFT on the official ERC-8004 Identity Registry |
| **On-Chain Reputation** | Feedback scores (0-100) accumulate on the official Reputation Registry |
| **Capital Delegation** | Users delegate MON → vault releases to agent wallet for trading → vault retains fees only |
| **Capital Flow** | `delegateCapital()` → `releaseFundsToAgent()` → agent trades → `returnFundsFromAgent()` → `withdrawCapital()` |
| **Performance Fee** | 20% of profits deducted on-chain at withdrawal (configurable per-agent via `performanceFeeBps`) |
| **Risk Router** | EIP-712 signed TradeIntents execute through AnoaTrustlessAgentCore |
| **Multi-Agent AI** | Market Analyst + Risk Manager run parallel bull/bear debate analysis |
| **3-Router Trading** | nad.fun (bonding curve) + LiFi (52 tokens) + Relay Protocol (solver) |
| **A2A Protocol** | Agent-to-Agent communication via JSON-RPC 2.0 for multi-agent orchestration |
| **MCP Protocol** | Model Context Protocol tool exposure for AI model integration |
| **x402 Payments** | HTTP 402 micropayments for agent services via Monad facilitator |
| **Fund Separation** | Platform fees (`accumulatedFees`) are strictly separated from user capital (`delegations`) |

### Strategy Types

| Strategy | Description |
|----------|-------------|
| **MOMENTUM** | Trend-following with multi-timeframe analysis (5m + 1h + 4h) |
| **YIELD** | DeFi yield farming via aPriori staking + Upshift vaults |
| **ARBITRAGE** | Cross-venue price arbitrage (nad.fun vs LiFi vs Relay) |
| **DCA** | Dollar-cost averaging, systematic accumulation |
| **GRID** | Range-bound grid trading |
| **HEDGE** | Capital protection, risk mitigation |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          ANOA Platform                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend (Next.js 16 + React 19)                                │
│  ┌──────┬───────────┬────────┬─────────┬───────────┬──────────┐  │
│  │ Home │ Dashboard │ Agents │ Trading │ Portfolio │ Settings │  │
│  │      │           │ Create │ Terminal│ Analytics │          │  │
│  │      │ Leaderboard │      │         │ Yield     │          │  │
│  └──────┴───────────┴────────┴─────────┴───────────┴──────────┘  │
│                                                                   │
│  Protocol Layer                                                   │
│  ┌────────────┬─────────┬──────────────┬────────────────────┐    │
│  │ A2A        │ MCP     │ x402         │ EIP-712 Signatures │    │
│  │ JSON-RPC   │ 5 Tools │ Micropayments│ TradeIntent        │    │
│  └────────────┴─────────┴──────────────┴────────────────────┘    │
│                                                                   │
│  Backend (Next.js API Routes — 23+ endpoints)                    │
│  ┌──────────┬────────────┬─────────────┬──────────────────┐      │
│  │ REST API │ Prisma ORM │ PostgreSQL  │ Cloudflare R2    │      │
│  │ 12 models│ + BigInt   │             │ (Metadata)       │      │
│  └──────────┴────────────┴─────────────┴──────────────────┘      │
│                                                                   │
│  AI Engine (3-Tier Orchestrated Fallback)                        │
│  ┌──────────────────┬──────────────┬─────────────────────┐       │
│  │ Cloudflare AI    │ GLM-4.7      │ Vikey.ai            │       │
│  │ llama-3.3-70b    │ (z.ai)       │ gemma-3-27b         │       │
│  │ [Primary]        │ [Secondary]  │ [Tertiary]          │       │
│  ├──────────────────┴──────────────┴─────────────────────┤       │
│  │ 5 AI Tools: bonding_curve | market_data | risk_check  │       │
│  │             price_quote   | technical_analysis         │       │
│  ├────────────────────────────────────────────────────────┤       │
│  │ Trade Memory (BM25 Okapi) | Technical Indicators (7)  │       │
│  │ Chart Aggregator (3-source OHLCV fallback)             │       │
│  └────────────────────────────────────────────────────────┘       │
│                                                                   │
│  Blockchain (Monad + ERC-8004)                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Official ERC-8004 Registries (Singleton on Monad)       │     │
│  │   Identity:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432│     │
│  │   Reputation: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63│     │
│  ├─────────────────────────────────────────────────────────┤     │
│  │ ANOA Custom Contracts                                    │     │
│  │   AnoaTrustlessAgentCore → Trade execution + PnL        │     │
│  │   AnoaCapitalVault       → Delegation + Capital Flow    │     │
│  │                                                          │     │
│  │ Capital Flow:                                            │     │
│  │   User delegates MON ──→ Vault ──→ releaseFundsToAgent  │     │
│  │   ──→ Agent Wallet (trades) ──→ returnFundsFromAgent    │     │
│  │   ──→ Vault (holds fees only) ──→ withdrawCapital       │     │
│  │   ──→ User (principal ± PnL - 20% perf fee)             │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  DeFi Integration (3-Router Architecture)                        │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐        │
│  │ nad.fun  │ LiFi     │ Relay    │ Upshift  │ aPriori  │        │
│  │ Bonding  │ 52 Tokens│ Solver   │ Vault    │ Staking  │        │
│  │ Curve    │ DEX Agg  │ Protocol │ earnAUSD │ aprMON   │        │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

> Full architecture details: [ARCHITECTURE.md](ARCHITECTURE.md) | Technical docs: [TECHNICAL.md](TECHNICAL.md)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.1.6, React 19, TypeScript 5.8, Tailwind CSS 4, Framer Motion 12 |
| **State** | Zustand 5, TanStack Query 5, Recharts 2 |
| **Web3** | wagmi 2, viem 2, Reown AppKit, agent0-sdk |
| **Backend** | Next.js API Routes (23+ endpoints), Prisma 6 (12 models), PostgreSQL |
| **AI** | Cloudflare AI (llama-3.3-70b), GLM-4.7 (z.ai), Vikey (gemma-3-27b/DeepSeekV3) |
| **Trade Memory** | BM25 Okapi scoring (k1=1.5, b=0.75) with recency bias + mistake amplification |
| **Technical Analysis** | SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWMA (pure TypeScript) |
| **Chart Data** | nad.fun API, DexScreener, GeckoTerminal (3-source OHLCV fallback) |
| **Smart Contracts** | Solidity 0.8.30, Foundry, OpenZeppelin 5 |
| **Blockchain** | Monad (Chain 143 mainnet / 10143 testnet) |
| **Trading** | nad.fun (bonding curve), LiFi (52 tokens), Relay Protocol (solver) |
| **Yield** | aPriori (aprMON liquid staking), Upshift (earnAUSD vault) |
| **Protocols** | ERC-8004, A2A (JSON-RPC 2.0), MCP, x402, EIP-712, EIP-2612 |
| **Storage** | Cloudflare R2 (metadata/images), AWS S3 SDK |

---

## Smart Contracts

### Official ERC-8004 Registries (Pre-deployed on Monad)

| Registry | Address | Status |
|----------|---------|--------|
| **Identity** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Live (Mainnet + Testnet) |
| **Reputation** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Live (Mainnet + Testnet) |

### ANOA Custom Contracts (`/contracts/src/`)

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| **AnoaTrustlessAgentCore** | Trade execution via DEX router, EIP-712 signed intents, PnL tracking | `executeBuy()`, `executeSell()`, `setProtocolFee()` |
| **AnoaCapitalVault** | Capital delegation, capital flow to agent wallets, performance fee, fund separation | `delegateCapital()`, `withdrawCapital()`, `releaseFundsToAgent()`, `returnFundsFromAgent()`, `setAgentWallet()`, `withdrawFees()` |
| **AnoaAgentIdentity** | Reference ERC-721 identity implementation (not deployed; official registry used) | `register()`, `setMetadata()`, `setOperator()` |
| **AnoaAgentReputation** | Reference reputation with validator weighting (not deployed; official registry used) | `giveFeedback()`, `getTrustScore()`, `hasMinimumReputation()` |
| **AnoaAgentValidator** | Validation schemes (BASIC/STANDARD/ADVANCED) with stake-secured validators | `validateAgent()`, `registerValidator()`, `slashValidator()` |


### Token Addresses

| Token | Testnet | Mainnet |
|-------|---------|---------|
| **WMON** | `0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd` | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| **USDC** | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |

> Full list of 52 supported tokens in `src/lib/lifi-client.ts` (MONAD_TOKENS)

### x402 Payment Protocol

| Config | Value |
|--------|-------|
| **Facilitator** | `https://x402-facilitator.molandak.org` |
| **Network (Testnet)** | `eip155:10143` |
| **Network (Mainnet)** | `eip155:143` |
| **USDC Mainnet** | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| **Protected Routes** | `POST /api/a2a`, `POST /api/trade` ($0.001 USDC each) |

---

## API Reference

### Agents

```http
GET    /api/agents              # List agents (filters: strategy, status, owner)
POST   /api/agents              # Create agent (requires 100 MON registration fee)
GET    /api/agents/[id]         # Get agent by ID
PUT    /api/agents/[id]         # Update agent
DELETE /api/agents/[id]         # Delete agent
POST   /api/agents/[id]/evaluate # Trigger strategy evaluation
POST   /api/agents/[id]/sync    # Sync on-chain balance to DB
POST   /api/agents/[id]/sweep   # Sweep agent wallet
POST   /api/agents/[id]/close   # Close agent position
```

### Trading & Execution

```http
GET    /api/trade               # Get recent executions
POST   /api/trade               # Execute trade (NAD.FUN → LiFi → Relay auto-routing)
GET    /api/quote               # Get price quote (LENS + LiFi + Relay)
GET    /api/executions          # List executions with filters
```

### Trade Proposals (Human-in-the-Loop)

```http
GET    /api/trade/proposals     # List pending/executed proposals
POST   /api/trade/proposals     # Create trade proposal
PATCH  /api/trade/proposals     # Approve/reject proposal → auto-execute
```

### Scheduler (Autonomous Loop)

```http
GET    /api/scheduler           # Get scheduler status + last run results
POST   /api/scheduler           # Trigger evaluation cycle for all active agents
```

### Capital & Portfolio

```http
GET    /api/delegations         # List delegations
POST   /api/delegations         # Create delegation record
GET    /api/portfolio           # Portfolio overview (holdings + PnL)
GET    /api/portfolio/transactions # Transaction history
```

### Reputation & Validation

```http
GET    /api/feedback            # Get feedback for agent
POST   /api/feedback            # Submit reputation feedback (on-chain)
GET    /api/validations         # Get validation records
POST   /api/validations         # Request/submit validation
GET    /api/leaderboard         # Ranked agents (sort: trust, pnl, tvl, winrate, sharpe)
```

### Yield & DeFi

```http
GET    /api/yield               # Get yield positions (aPriori + Upshift)
POST   /api/yield               # Manage yield positions
POST   /api/yield/deposit       # Execute yield deposit (aprMON or earnAUSD)
```

### Protocols

```http
POST   /api/a2a                 # A2A JSON-RPC 2.0 endpoint (x402 protected)
GET    /api/a2a                 # Agent card discovery
POST   /api/mcp                 # MCP tool execution (5 tools)
GET    /api/mcp                 # MCP tool listing
POST   /api/metadata            # Upload metadata to R2
GET    /api/health              # Health check
```

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with protocol overview |
| `/dashboard` | Agent dashboard with real-time metrics |
| `/agents` | Agent directory and discovery |
| `/agents/create` | 4-step agent creation wizard (ERC-8004 registration) |
| `/trading` | Trading terminal with charts and execution |
| `/portfolio` | Portfolio analytics and delegation management |
| `/leaderboard` | Agent rankings with trust scores and delegation (Podium display) |
| `/yield` | Yield farming (aPriori staking + Upshift vault) |
| `/settings` | User and wallet settings |

---

## Project Structure

```
trust-agent-8004/
├── contracts/                  # Smart contracts (Foundry)
│   ├── src/
│   │   ├── AnoaTrustlessAgentCore.sol   # Risk router + trade execution
│   │   ├── AnoaCapitalVault.sol         # Capital delegation + fees
│   │   ├── AnoaAgentIdentity.sol        # Reference identity (not deployed)
│   │   ├── AnoaAgentReputation.sol      # Reference reputation (not deployed)
│   │   └── AnoaAgentValidator.sol       # Validation schemes
│   ├── test/
│   │   └── AnoaAgent.t.sol             # Tests (identity + reputation + validator + vault)
│   └── script/
│       └── DeployAnoa.s.sol            # Deploy Core + Vault on Monad
│
├── src/
│   ├── app/                             # Next.js App Router
│   │   ├── page.tsx                     # Landing
│   │   ├── dashboard/page.tsx           # Dashboard
│   │   ├── agents/page.tsx              # Agent directory
│   │   ├── agents/create/page.tsx       # Agent creation wizard
│   │   ├── trading/page.tsx             # Trading terminal
│   │   ├── portfolio/page.tsx           # Portfolio
│   │   ├── leaderboard/page.tsx         # Rankings + delegation
│   │   ├── yield/page.tsx               # Yield farming
│   │   ├── settings/page.tsx            # Settings
│   │   └── api/                         # 23+ REST API routes
│   │       ├── agents/route.ts          # Agent CRUD + balance reconciliation
│   │       ├── agents/[id]/route.ts     # Agent by ID
│   │       ├── agents/[id]/evaluate/    # Strategy evaluation
│   │       ├── agents/[id]/sync/        # On-chain balance sync
│   │       ├── agents/[id]/sweep/       # Wallet sweep
│   │       ├── agents/[id]/close/       # Position close
│   │       ├── scheduler/route.ts       # Autonomous trading loop
│   │       ├── trade/route.ts           # Trade execution (3-router)
│   │       ├── trade/proposals/route.ts # Human-in-the-loop proposals
│   │       ├── quote/route.ts           # Price quotes
│   │       ├── delegations/route.ts     # Capital delegation
│   │       ├── executions/route.ts      # Trade executions
│   │       ├── feedback/route.ts        # Reputation feedback
│   │       ├── portfolio/route.ts       # Portfolio data
│   │       ├── portfolio/transactions/  # Transaction history
│   │       ├── yield/route.ts           # Yield operations
│   │       ├── yield/deposit/route.ts   # Yield deposits
│   │       ├── leaderboard/route.ts     # Rankings + balance reconciliation
│   │       ├── metadata/route.ts        # R2 metadata upload
│   │       ├── mcp/route.ts             # MCP protocol (5 tools)
│   │       ├── validations/route.ts     # Validation artifacts
│   │       ├── a2a/route.ts             # A2A protocol
│   │       └── health/route.ts          # Health check
│   │
│   ├── components/                      # UI components
│   ├── config/
│   │   ├── chains.ts                    # Chain config + ERC-8004 registries + contract addresses
│   │   ├── contracts.ts                 # 15+ ABIs (trading, ERC-8004, yield, identity)
│   │   └── wagmi.ts                     # Wagmi configuration
│   ├── hooks/
│   │   ├── useERC8004.ts                # ERC-8004 registry hooks
│   │   ├── useCapitalVault.ts           # Capital vault hooks
│   │   └── useAgents.ts                 # Agent management hooks
│   ├── lib/
│   │   ├── ai-advisor.ts               # 3-tier AI:  → Llama-3.3-70b → GLM-4.7 → Gemma-3-27b/DeepSeekV3
│   │   ├── strategy-engine.ts           # 6 trading strategies (MOMENTUM, YIELD, etc.)
│   │   ├── trade-memory.ts             # BM25 Okapi trade memory (learn from past trades)
│   │   ├── technical-indicators.ts     # SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA
│   │   ├── chart-aggregator.ts         # 3-source OHLCV (nad.fun → DexScreener → GeckoTerminal)
│   │   ├── nadfun-api.ts               # nad.fun REST API (market data, charts, holdings)
│   │   ├── lifi-client.ts              # LiFi DEX aggregator (52 tokens + ERC-20 holdings)
│   │   ├── relay-client.ts             # Relay Protocol solver (quotes + swaps)
│   │   ├── trade-judgement.ts           # OpenClaw judgement pattern
│   │   ├── risk-guard.ts               # Pre-trade risk limit checks
│   │   ├── risk-metrics.ts             # Sharpe ratio, drawdown, win rate
│   │   ├── pnl-tracker.ts              # PnL calculation (CoinGecko + CoinMarketCap)
│   │   ├── token-discovery.ts          # Auto-discover trending tokens from nad.fun events
│   │   ├── erc8004.ts                  # ERC-8004 service (register, feedback, balance)
│   │   ├── agent-wallet.ts             # HD wallet (BIP-32 derivation from master seed)
│   │   ├── vault-operator.ts           # Server-side vault operations (PnL, capital release, fees)
│   │   ├── rpc-client.ts               # RPC with timeout + retry
│   │   ├── anoa-contracts.ts           # ANOA contract service
│   │   ├── agent0-service.ts           # Agent0 SDK (on-chain feedback)
│   │   ├── x402-server.ts              # x402 micropayment config
│   │   ├── prisma.ts                   # Database client
│   │   ├── config.ts                   # Environment config
│   │   └── get-base-url.ts             # Base URL resolver
│   └── stores/                          # Zustand state stores
│
├── prisma/
│   └── schema.prisma                    # 12 models (Agent, User, Execution, Delegation, etc.)
│
├── scripts/
│   ├── seed.ts                          # Seed demo data
│   ├── generate-logos.ts                # Generate agent avatars
│   └── verify-tokens.mjs               # Token verification utility
│
├── flow-anoa/                           # Flow documentation
├── documents/                           # Reference documentation
├── ARCHITECTURE.md                      # Architecture documentation
├── TECHNICAL.md                         # Technical documentation
├── example.nginx.conf                   # Production nginx config
└── README.md                            # This file
```

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd trust-agent-8004
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# Blockchain (Monad)
NEXT_PUBLIC_NETWORK=mainnet              # or "testnet"
NEXT_PUBLIC_RPC_URL_MAINNET=https://rpc3.monad.xyz
NEXT_PUBLIC_RPC_URL_TESTNET=https://testnet-rpc.monad.xyz

# Agent Wallet (HD derivation — recommended)
AGENT_MASTER_SEED="your 12/24 word mnemonic"
# OR single wallet:
AGENT_PRIVATE_KEY=0x...

# AI Providers (3-tier fallback)
CLOUDFLARE_AI_TOKEN=...                  # Primary: llama-3.3-70b
CLOUDFLARE_ACCOUNT_ID=...
GLM_API_KEY=...                          # Secondary: GLM-4.7
VIKEY_API_KEY=...                        # Tertiary: gemma-3-27b/DeepSeekV3

# Wallet Connection
NEXT_PUBLIC_WALLET_CONNECT_ID=...

# x402 Micropayments (optional — disabled if empty)
PAY_TO_ADDRESS=0x...

# Cloudflare R2 (metadata upload)
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_ENDPOINT=...

# Optional
NAD_API_KEY=nadfun_...                   # Higher rate limits (100 req/min vs 10)
RELAY_API_KEY=...                        # Relay Protocol (10 req/sec vs 50/min)
NEXT_PUBLIC_COINGECKO_API_KEY=...        # CoinGecko price data
COINMARKETCAP_API_KEY=...               # CoinMarketCap fallback
```

### 3. Database Setup

```bash
npx prisma generate
npx prisma db push
npx prisma db seed   # Optional: seed demo data
```

### 4. Smart Contract Deployment (Optional)
> Note: Deployment contract is optional if ownable

```diff
+ No. 1 == Install Development Tools ==
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

+ No.2 == Install Development Tools ==
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std

+ No.3 == Compile Contracts ==
cd contracts && forge build

# Deploy to Monad Mainnet
forge script script/DeployAnoa.s.sol:DeployAnoa \
  --rpc-url https://rpc3.monad.xyz \
  --broadcast --verify

# Run tests
forge test -vv
```

### 5. Build and Start

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

---

## Development Commands

```bash
# Application
npm run dev              # Development server (webpack, port 3000)
npm run dev:turbo        # Development server (turbopack, port 3000)
npm run build            # Production build
npm run start            # Production server
npm run prod             # Build + start
npm run lint             # ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed demo data

# Smart Contracts
cd contracts
forge build              # Compile contracts
forge test -vv           # Run all tests
forge script script/DeployAnoa.s.sol:DeployAnoa --rpc-url $RPC --broadcast
```

---

## Agent Lifecycle

```
1. REGISTER                    2. FUND                        3. CAPITAL RELEASE
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ Create Agent │──────────────│ Delegate     │──────────────│ Vault calls  │
│ on ERC-8004  │  Agent NFT   │ Capital to   │  Min 1000    │ releaseFunds │
│ Identity     │  minted      │ Vault        │  MON         │ ToAgent()    │
│              │  100 MON fee │              │              │ → Agent Wallet│
└──────────────┘              └──────────────┘              └──────┬───────┘
                                                                   │
4. TRADE                       5. RETURN                      6. WITHDRAW
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ Execute via  │──────────────│ returnFunds  │──────────────│ Delegator    │
│ 3-Router     │  PnL calc    │ FromAgent()  │  Funds back  │ withdraws    │
│ (nad.fun/    │  per trade   │ to Vault     │  to vault    │ principal ±  │
│  LiFi/Relay) │              │              │              │ PnL - 20% fee│
└──────────────┘              └──────────────┘              └──────┬───────┘
                                                                   │
7. LEARN                       8. FEEDBACK
┌──────────────┐              ┌──────────────┐
│ Trade Memory │◀─────────────│ Clients give │
│ BM25 lessons │  On-chain    │ feedback     │
│ + trust score│  reputation  │ (0-100)      │
└──────────────┘              └──────────────┘
```

---

## ERC-8004 Standard

ANOA implements the [ERC-8004 Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004) standard with three core registries:

| Registry | Purpose | Trust Model |
|----------|---------|-------------|
| **Identity** | Portable agent identifiers (ERC-721 NFT) | Discovery |
| **Reputation** | Client feedback aggregation (0-100 scores) | Reputation-based |
| **Validation** | Independent verification hooks | Crypto-economic (staked validators) |

### Agent Card Schema (IPFS)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "myAgent",
  "description": "Autonomous trading agent",
  "image": "https://r2.example/agent-42.png",
  "endpoints": [
    { "name": "A2A", "endpoint": "https://agent.example/a2a", "version": "0.3.0" },
    { "name": "MCP", "endpoint": "https://agent.example/mcp", "version": "2025-06-18" }
  ],
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

---

## Capital Delegation Flow

ANOA's Capital Vault implements a **flow-through model** — delegated capital is released to agent wallets for active trading, not locked idle in the vault. The vault only retains protocol fees.

```
User Wallet                    AnoaCapitalVault                   Agent Wallet
    │                                │                                │
    │──── delegateCapital(1000 MON) ─→│                                │
    │                                │── releaseFundsToAgent(agentId) ─→│
    │                                │    (operator tx, non-blocking)   │
    │                                │                                │── trades via
    │                                │                                │   3-Router
    │                                │                                │   (nad.fun/
    │                                │                                │    LiFi/Relay)
    │                                │←── returnFundsFromAgent() ─────│
    │                                │    (agent returns capital+PnL)  │
    │←── withdrawCapital() ──────────│                                │
    │    (principal ± PnL            │                                │
    │     - 20% performance fee      │                                │
    │     - withdrawal fee)          │                                │
```

### Fee Structure (On-Chain)

| Fee | Default | Description |
|-----|---------|-------------|
| **Performance Fee** | 20% (2000 bps) | Deducted from profits only at withdrawal. Configurable per-agent. |
| **Withdrawal Fee** | 0.5% (50 bps) | Applied to total withdrawable amount. |
| **Registration Fee** | 100 MON | One-time agent creation fee, goes to treasury. |
| **Trading Fee** | Recorded per-trade | Tracked via `recordTradingFee()` for protocol analytics. |

### Delegation Rules

| Rule | Value | Enforced At |
|------|-------|-------------|
| **Minimum Delegation** | 1,000 MON | Backend API (`POST /api/delegations`) |
| **Max Delegators/Agent** | 5 | Backend API (no contract limit) |
| **On-Chain Limit** | Unlimited | Smart contract has no delegate cap |

---

## A2A Protocol (Agent-to-Agent)

ANOA implements the [A2A Protocol](https://a2a-protocol.org) for inter-agent communication via JSON-RPC 2.0.

```http
POST /api/a2a    # x402-protected ($0.001 USDC per call)
GET  /api/a2a    # Agent card discovery (public)
```

### Supported Methods

| Method | Description |
|--------|-------------|
| `tasks/send` | Send task (market analysis, risk check, trade execution) |
| `tasks/get` | Query task status |
| `tasks/cancel` | Cancel task |
| `agent/authenticatedExtendedCard` | Full agent card with capabilities |

### Agent Card

Each ANOA agent exposes an A2A-compliant agent card with skills, supported content types, and authentication requirements. Agent cards are discoverable via `GET /api/a2a`.

---

## x402 Payment Protocol

ANOA uses [x402](https://www.npmjs.com/package/@x402/core) HTTP 402 micropayments for monetizing agent services. Protected endpoints require USDC payment via Monad facilitator.

| Config | Value |
|--------|-------|
| **Facilitator** | `https://x402-facilitator.molandak.org` |
| **Price per call** | $0.001 USDC |
| **Protected routes** | `POST /api/a2a`, `POST /api/trade` |
| **USDC (Mainnet)** | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| **USDC (Testnet)** | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

---

## References

- [EIP-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [A2A Protocol](https://a2a-protocol.org/latest/specification/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [x402 Payment Protocol](https://www.npmjs.com/package/@x402/core)
- [Monad Network](https://monad.xyz)
- [nad.fun Documentation](https://docs.nad.fun)
- [LiFi Protocol](https://li.fi)
- [Relay Protocol](https://relay.link)

---

*ANOA - Proof-Anchored Intelligence for Autonomous Trading*
