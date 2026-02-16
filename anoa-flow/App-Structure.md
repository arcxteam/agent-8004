# ANOA — Full Application Structure Map

> Line-by-line audit of `src/app/`, `src/app/api/`, `src/hooks/`, `src/components/`, `src/config/`, `src/lib/`
> Verified against codebase — February 2026
> Total: ~32,000+ lines of source code

---

## Table of Contents

1. [File Tree: Frontend Pages](#file-tree-frontend-pages)
2. [Section A: 9 Pages Detail](#section-a-9-pages-detail)
3. [Layout & Providers](#layout--providers)
4. [Section B: 23 API Routes Detail](#section-b-23-api-routes-detail)
5. [Section C: Hooks (12 files)](#section-c-hooks-12-files)
6. [Section D: Components (18 files)](#section-d-components-18-files)
7. [Section E: Config (5 files)](#section-e-config-5-files)
8. [Section F: Lib Files (26 files)](#section-f-lib-files-26-files)
9. [Section G: Prisma Schema (12 Models)](#section-g-prisma-schema-12-models)
10. [Section H: Frontend → API Connections](#section-h-frontend--api-connections)
11. [Summary Table](#summary-table)

---

## File Tree: Frontend Pages

```
src/app/
├── page.tsx              (1,222 lines) → / (Landing — hero, stats, roadmap)
├── layout.tsx            (40 lines)    → Root layout (Inter font, dark theme)
├── providers.tsx         (118 lines)   → WagmiProvider + QueryClient + AppKit
├── globals.css           (388 lines)   → Tailwind + glassmorphism + animations
├── favicon.ico
│
├── dashboard/page.tsx    (713 lines)   → /dashboard
├── agents/page.tsx       (405 lines)   → /agents
├── agents/create/page.tsx (999 lines)  → /agents/create (4-step wizard)
├── leaderboard/page.tsx  (1,678 lines) → /leaderboard
├── portfolio/page.tsx    (1,808 lines) → /portfolio
├── trading/page.tsx      (668 lines)   → /trading (Coming Soon overlay)
├── yield/page.tsx        (381 lines)   → /yield
├── settings/page.tsx     (633 lines)   → /settings
│
└── api/                  → 23 route files (see Section B)
```

**Frontend total: 9 pages + layout + providers + CSS = ~9,053 lines**

---

## Section A: 9 Pages Detail

### 1. Landing Page — `/`

**File:** `src/app/page.tsx` (1,222 lines)

| Aspect | Detail |
|--------|--------|
| Sections | Hero (typewriter), StatsTicker (TVL/Agents/Trades/Trust), ProtocolBadges (marquee), 6 Feature Cards, How It Works (4 steps), Architecture Diagram (4 layers), Roadmap/Timeline, CTA, Top-3 Agent Podium |
| Hooks | `useGlobalStats` |
| API | `/api/leaderboard` (implicit via useGlobalStats) |
| Libraries | framer-motion, lucide-react, useInView |

---

### 2. Dashboard — `/dashboard`

**File:** `src/app/dashboard/page.tsx` (713 lines)

| Aspect | Detail |
|--------|--------|
| Sections | Portfolio Summary (wallet + balance), Performance Chart (1D/1W/1M/3M/ALL), Recent Activity, 6 Agent Cards (or empty state), Quick Actions (Deploy/Leaderboard/Deposit/Analytics) |
| Hooks | `useAccount`, `useBalance`, `useMyAgents`, `usePortfolio`, `useGlobalStats` |
| API | `/api/agents` (via useMyAgents), `/api/portfolio` (via usePortfolio) |
| Wallet | Shows connected wallet address + native MON balance |

---

### 3. Agents List — `/agents`

**File:** `src/app/agents/page.tsx` (405 lines)

| Aspect | Detail |
|--------|--------|
| Sections | Header + "Create Agent" button, Search bar + Sort dropdown, Tabs (All/Active/Paused/Stopped), Agent Grid (3 columns) |
| Per Card | Name, Strategy badge, Status badge, Trust Score progress bar, Stats Grid (PnL %, Win Rate, TVL, Trades), Created timestamp |
| Hooks | `useAccount`, `useAgents` |
| API | `/api/agents` (GET — filtered list) |
| Empty State | "No agents found" + Create Agent CTA |

---

### 4. Create Agent — `/agents/create`

**File:** `src/app/agents/create/page.tsx` (999 lines)

| Step | Content |
|------|---------|
| Step 1: Identity | Name, Description, Avatar selection (200 logos), Trust Models (Reputation/Crypto-Economic/TEE), A2A endpoint (optional) |
| Step 2: Strategy | 6 strategies (MOMENTUM/YIELD/ARBITRAGE/DCA/GRID/HEDGE), Risk Level (low/medium/high), Max Drawdown %, Initial Capital (MON) |
| Step 3: Review | Summary card, Config details, Fee breakdown (registration 100 MON + gas ~0.005 MON), "Mint Agent Identity" button |
| Step 4: Success | Token ID, Explorer link, "View My Agents" button |

| Aspect | Detail |
|--------|--------|
| Hooks | `useAccount`, `useChainId`, `useRegisterAgent`, `useVaultAddress`, `usePayRegistrationFee` |
| API | POST `/api/metadata` (upload JSON to R2), POST `/api/agents` (save to Prisma) |
| On-chain | ERC-8004 `registerAgent()` → mint ERC-721 NFT at Identity Registry (0x8004A169...) |
| Fee | `payFee(100 MON)` via Capital Vault hook — **CURRENTLY SKIPPED** (vault not deployed, `vaultDeployed = false`) |
| Constants | `PLATFORM_FEE_CONFIG = { registrationFee: 100, minCapital: 100, defaultGas: 0.005 }` |

**`handleRegister()` Flow (line ~207-317):**
```
1. Upload metadata JSON to R2 (POST /api/metadata)
2. Call registerAgent() on-chain → mint ERC-721 → tokenId
3. if (vaultDeployed && result?.agentId) → payFee(100 MON) ← SKIP currently
4. POST /api/agents → save to Prisma DB
```

---

### 5. Leaderboard — `/leaderboard`

**File:** `src/app/leaderboard/page.tsx` (1,678 lines)

| Aspect | Detail |
|--------|--------|
| Sections | 4 Global Stats Cards (Total Agents, Total TVL, Avg Trust, 24h Volume), Top-3 Podium (animated), Strategy Filter Pills (All + 6 strategies), Sort Dropdown, Leaderboard Table, Pagination, Trust Hierarchy Cards (5 tiers), Live Metrics (5 cards) |
| Table Columns | Rank, Agent, Trust Score, PnL, Sharpe Ratio, Max Drawdown, TVL, Win Rate, Actions |
| 3 Modals | ViewMyRankModal, ViewAgentModal (contract address), DelegateModal (capital delegation) |
| Hooks | `useAccount`, `useDelegateCapital`, `useVaultAddress` |
| API | `/api/leaderboard` (GET — paginated, sortable, filterable) |
| Sort Options | trustScore (default), pnl, tvl, winrate, sharpe, drawdown |
| Delegation | Via DelegateModal → `useDelegateCapital` hook → **NON-FUNCTIONAL** (vault null) |

---

### 6. Portfolio — `/portfolio`

**File:** `src/app/portfolio/page.tsx` (1,808 lines)

| Aspect | Detail |
|--------|--------|
| Sections | Performance Summary, Asset Allocation Chart (donut), Quick Stats Grid (4 cards), 3 Tabs (Holdings/Transactions/PnL History) |
| Holdings Table | Token, Balance, Price, 24h Change, Allocation %, Trade button |
| Transactions | Fetched via Etherscan API v2 (chain-specific) with in-memory 5-min cache |
| Modals | TransferModal (deposit/withdraw — non-functional, vault null) |
| PnL History | Timeframe selector, chart with cumulative P&L |
| Hooks | `useAccount`, `useBalance`, `useReadContracts` (ERC20 balances), `useTokenPrices`, `usePortfolio` |
| API | `/api/portfolio?address={addr}` (GET), `/api/portfolio/transactions?address={addr}` (GET) |
| On-chain | Direct ERC20 `balanceOf` reads via wagmi `useReadContracts` |

---

### 7. Trading — `/trading` (COMING SOON)

**File:** `src/app/trading/page.tsx` (668 lines)

| Aspect | Detail |
|--------|--------|
| Status | **COMING SOON** — blur overlay, non-interactive |
| Behind overlay | Swap form (from/to token, amounts, flip button), Slippage tolerance (0.1%/0.5%/1%/custom), Exchange rate, Price impact, Order Book (asks/bids), Recent Trades list, Your Positions card |
| Tabs | Swap, Limit Order, Liquidity |
| Hooks | `useAccount`, `usePortfolio`, `useTokenPrices` |
| Note | This is for **manual swap** by user, NOT for agent trading. Agent trading via POST `/api/trade` triggered by scheduler. |

---

### 8. Yield — `/yield`

**File:** `src/app/yield/page.tsx` (381 lines)

| Aspect | Detail |
|--------|--------|
| Sections | Overview Stats (Total Deposited, Annual Est, Avg APY, Auto-compound), Featured Strategies (2 cards), Risk Filter (All/Low/Medium/High), All Strategies Grid, Risk Explained, How Yields Generated |
| 2 Live | **aPriori MON Staking** (APY ~6.8%, TVL ~$45M, 12-18h lock) + **Upshift earnAUSD** (APY ~7.2%, TVL ~$12M, instant/96h) |
| 6 Coming Soon | Momentum Yield, Yield Optimization, Arbitrage Yield, DCA Yield, Grid Yield, Hedge Yield |
| 4 Modals | DepositModal (multi-step: approve + deposit), UserPositionsModal, WithdrawModal (instant 0.2% fee / delayed 96h 0% fee), ClaimRewardsModal |
| Hooks | `useAccount`, `useDepositMon`, `useDepositAusd`, `useApproveAusd`, `useMonBalance`, `useAusdBalance`, `useAprMonBalance`, `useEarnAusdBalance`, `useTokenPrice`, `useInstantRedeemAusd`, `useRequestRedeemAprMon` |
| API | `/api/yield` (GET — live APY, TVL, share prices, 12h cache) |
| On-chain | Direct contract calls: approve, deposit, redeem, withdraw via hooks |

---

### 9. Settings — `/settings`

**File:** `src/app/settings/page.tsx` (633 lines)

| Tab | Content |
|-----|---------|
| General | Theme (light/dark/system), Language, Currency, Wallet connect/disconnect |
| Notifications | Email, Trade alerts, Agent alerts, Price alerts, Weekly report (toggles) |
| Trading | Default slippage, Confirm trades, Gas optimization (toggles) |
| Security | 2FA, Session timeout (15m/30m/1h/Never), API whitelist (toggles) |
| API Keys | List active keys, Create new (name + permissions), Revoke, API docs link |

| Aspect | Detail |
|--------|--------|
| Hooks | `useAccount`, `useDisconnect` |
| API | None (local state only) |
| Modal | CreateApiKeyModal (key generation with permissions) |

---

## Layout & Providers

### Root Layout — `src/app/layout.tsx` (40 lines)

- Font: Inter (Google Fonts)
- Theme: `className="dark"` on HTML
- Wraps children with `<Providers>`
- SEO metadata configuration

### Providers — `src/app/providers.tsx` (118 lines)

```
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary fallback={...}>
      <ClientOnly>
        {children}
        <Toaster /> (sonner)
      </ClientOnly>
    </ErrorBoundary>
  </QueryClientProvider>
</WagmiProvider>
```

- **WagmiProvider**: Blockchain state (wallet, contracts, transactions)
- **QueryClientProvider**: React Query (data fetching, caching, retry)
- **AppKit**: Wallet connection modal (WalletConnect, injected)
- **ErrorBoundary**: Catches React errors
- **ClientOnly**: Prevents SSR hydration issues
- **Toaster**: Toast notifications (sonner)

### Global CSS — `src/app/globals.css` (388 lines)

- Tailwind CSS 4 imports
- Dark theme CSS variables (primary, accent, semantic colors)
- Glassmorphism effects (`.glass`, `.glass-card`)
- Gradient effects (mesh, hero, text, rainbow)
- Glow animations (aurora-drift, gradient-shift, float, pulse-glow, shimmer, spin-slow)
- Grid pattern background
- Custom scrollbar (purple/pink)
- Noise overlay texture

---

## Section B: 23 API Routes Detail

### File Tree

```
src/app/api/
├── health/route.ts                  (73 lines)    GET
├── metadata/route.ts                (111 lines)   POST
├── a2a/route.ts                     (453 lines)   GET, POST    [$0.001 x402]
├── mcp/route.ts                     (306 lines)   GET, POST
├── scheduler/route.ts               (467 lines)   GET, POST
├── quote/route.ts                   (216 lines)   GET, POST
├── trade/
│   ├── route.ts                     (1,119 lines) GET, POST    [$0.001 x402]
│   └── proposals/route.ts           (124 lines)   GET, POST, PATCH
├── agents/
│   ├── route.ts                     (298 lines)   GET, POST
│   └── [id]/
│       ├── route.ts                 (127 lines)   GET, PUT, DELETE
│       ├── evaluate/route.ts        (114 lines)   POST
│       ├── close/route.ts           (130 lines)   POST
│       ├── sweep/route.ts           (236 lines)   POST
│       └── sync/route.ts            (142 lines)   POST
├── delegations/route.ts             (297 lines)   GET, POST, DELETE
├── executions/route.ts              (239 lines)   GET, POST, PATCH
├── feedback/route.ts                (176 lines)   GET, POST
├── leaderboard/route.ts             (282 lines)   GET, POST
├── portfolio/
│   ├── route.ts                     (270 lines)   GET, POST
│   └── transactions/route.ts        (160 lines)   GET
├── validations/route.ts             (206 lines)   GET, POST
├── yield/
│   ├── route.ts                     (504 lines)   GET, POST
│   └── deposit/route.ts             (187 lines)   GET, POST
```

**Total: 23 route files = ~6,237 lines**

### Per-Route Table

| # | Route | Methods | Lines | Prisma Models | External | x402 | Purpose |
|---|-------|---------|-------|---------------|----------|------|---------|
| 1 | `/api/health` | GET | 73 | — | Viem RPC | No | Health check: RPC latency, DB status, chain info, contract addresses |
| 2 | `/api/metadata` | POST | 111 | — | Cloudflare R2 | No | Upload metadata JSON to R2 (3 types: agent-metadata, feedback-proof, validation-artifact) |
| 3 | `/api/a2a` | GET, POST | 453 | — (calls others) | callAI(), agent0-service | **YES** | JSON-RPC 2.0: message/send, tasks/get, tasks/cancel, agent/info, agent/reputation, trading/quote, trading/execute, trading/propose, trading/proposals. GET returns Agent Card (7 skills) |
| 4 | `/api/mcp` | GET, POST | 306 | — (calls others) | Viem, nad.fun API, A2A | No | MCP Server: 5 tools (get_quote, execute_trade, get_agent_reputation, chat, get_market_data). GET returns MCP manifest |
| 5 | `/api/scheduler` | GET, POST | 467 | agent, tradeProposal | strategy-engine, token-discovery, nadfun-api, lifi-client, rpc-client | No | POST: evaluate ALL active agents with token discovery + balance reconciliation (5min cooldown). GET: status + last run results |
| 6 | `/api/quote` | GET, POST | 216 | — | Viem (Lens contract), LiFi REST, Relay | No | Quote via nad.fun Lens `getAmountOut()` + LiFi `getLiFiQuote()` + Relay fallback |
| 7 | `/api/trade` | GET, POST | 1,119 | execution, agent, feedback, validation, tokenHolding | Viem, nad.fun, LiFi, Relay, pnl-tracker, trade-memory | **YES** | 3-router trade execution (nad.fun + LiFi + Relay) + PnL calc + metrics update + reputation feedback + validation artifact + trade memory recording |
| 8 | `/api/trade/proposals` | GET, POST, PATCH | 124 | tradeProposal | trade-judgement | No | OpenClaw: create proposal, list proposals, approve/reject (PATCH) |
| 9 | `/api/agents` | GET, POST | 298 | agent, user, feePayment | agent-wallet, erc8004 | No | GET: list agents (filter: strategy, status, owner, paginated) + balance reconciliation. POST: create new agent (HD wallet derivation, ERC-8004 fields, trustScore=50, status=ACTIVE) |
| 10 | `/api/agents/[id]` | GET, PUT, DELETE | 127 | agent + all relations | — | No | GET: single agent + last 10 execs + 5 validations + 10 feedbacks + counts. PUT: update properties. DELETE: remove agent |
| 11 | `/api/agents/[id]/evaluate` | POST | 114 | agent | strategy-engine | No | Evaluate specific agent, optional `autoPropose` flag, optional `tokens` list |
| 12 | `/api/agents/[id]/close` | POST | 130 | agent, execution | — | No | Stop agent: verify ownership, set status=STOPPED, calculate final PnL from all executions |
| 13 | `/api/agents/[id]/sweep` | POST | 236 | agent, tokenHolding | Viem, trade API, agent-wallet | No | Auto-sell ALL token holdings via `/api/trade`, then transfer remaining MON to owner wallet |
| 14 | `/api/agents/[id]/sync` | POST | 142 | agent | Viem, nadfun-api, lifi-client, pnl-tracker | No | Reconcile on-chain balance → DB: query wallet + nad.fun holdings + ERC-20 holdings, update totalCapital |
| 15 | `/api/delegations` | GET, POST, DELETE | 297 | delegation, user, agent | Viem (txHash verify) | No | GET: list delegations + stats. POST: create (verifies txHash on-chain). DELETE: revoke (marks WITHDRAWN) |
| 16 | `/api/executions` | GET, POST, PATCH | 239 | execution, agent | — | No | GET: list executions (filter: agent/user/status/type). POST: create record. PATCH: update status + PnL |
| 17 | `/api/feedback` | GET, POST | 176 | feedback, agent | — | No | GET: paginated feedback + stats (avg score, distribution). POST: create/update + recalculate trust score |
| 18 | `/api/leaderboard` | GET, POST | 282 | agent | nadfun-api, lifi-client, rpc-client | No | GET: paginated rankings (sort: trustScore/pnl/tvl/winrate/sharpe/drawdown) + balance reconciliation. POST: top-3 agents |
| 19 | `/api/portfolio` | GET, POST | 270 | user, agent, delegation, execution, tokenHolding | Viem RPC (balance) | No | GET: on-chain MON balance + token holdings + PnL history (grouped by day) + agent stats. POST: sync token holdings |
| 20 | `/api/portfolio/transactions` | GET | 160 | — | Etherscan API v2 | No | GET: wallet transaction history from Etherscan (Monad chain 143/10143), 5-min cache |
| 21 | `/api/validations` | GET, POST | 206 | validation, execution | Viem (keccak256), R2 (optional) | No | GET: list validations per agent. POST: create validation artifact (keccak256 hash, score 80/50, optional R2 upload) |
| 22 | `/api/yield` | GET, POST | 504 | — | aPriori API, Upshift API | No | GET: live yield data (12h cache) — aPriori + Upshift + 6 coming soon. POST: clear cache |
| 23 | `/api/yield/deposit` | GET, POST | 187 | yieldDeposit | — | No | GET: deposit history (last 50). POST: log deposit (wallet/tx/protocol validation) |

### HTTP Method Summary

| Method | Count |
|--------|-------|
| GET | 16 endpoints |
| POST | 19 endpoints |
| PUT | 1 (agents/[id]) |
| PATCH | 2 (proposals, executions) |
| DELETE | 2 (agents/[id], delegations) |
| **x402 Protected** | **2** (`/api/trade` $0.001, `/api/a2a` $0.001) |

### Prisma Model Usage per Route

| Prisma Model | Used By Routes |
|-------------|----------------|
| Agent | agents, agents/[id], evaluate, close, sweep, sync, scheduler, trade, delegations, executions, feedback, leaderboard, portfolio |
| User | agents, delegations, portfolio |
| Execution | trade, executions, agents/[id], close, validations, portfolio |
| Delegation | delegations, portfolio |
| Feedback | trade, feedback, agents/[id] |
| Validation | trade, validations, agents/[id] |
| TradeProposal | proposals, scheduler |
| TokenHolding | trade, sweep, portfolio |
| YieldDeposit | yield/deposit |
| FeePayment | agents (POST — registration fee) |
| ApiKey | (settings page, local) |
| YieldWithdrawal | (yield page, via hooks) |

---

## Section C: Hooks (12 files)

**Directory:** `src/hooks/` — 3,562 lines total

| # | Hook | Lines | Purpose | Used By |
|---|------|-------|---------|---------|
| 1 | `useAgents` | 240 | Agent CRUD + list (filter, sort, paginate) | /agents, /dashboard |
| 2 | `useWeb3` | 270 | Wallet connection + viem publicClient/walletClient | Multiple pages |
| 3 | `useTransactions` | 180 | Transaction status tracking + toast notifications | /agents/create, /yield |
| 4 | `useTokenPrices` | 377 | Real-time token prices (nad.fun + CoinGecko) | /portfolio, /trading |
| 5 | `useGlobalStats` | 112 | Platform-wide stats (total agents, TVL, avg trust, volume) | /, /dashboard |
| 6 | `useCapitalVault` | 520 | Vault hooks: delegateCapital, withdrawCapital, payRegistrationFee, getAgentBalance | /agents/create, /leaderboard |
| 7 | `useERC8004` | 498 | registerAgent, setMetadata, getReputation, giveFeedback | /agents/create |
| 8 | `usePortfolio` | 285 | Holdings + PnL summary (from /api/portfolio) | /dashboard, /trading |
| 9 | `useSettings` | 203 | User preferences (local storage) | /settings |
| 10 | `useMonadTokenList` | 305 | Available token list for Monad chain | /trading, /portfolio |
| 11 | `useYield` | 561 | Yield strategy data (from /api/yield) + deposit/withdraw hooks | /yield |
| 12 | `index.ts` | 11 | Re-exports all hooks | — |

### Key Hook Details

**`useCapitalVault`** (520 lines):
- `useVaultAddress()`: returns `{ address, isDeployed }` — **isDeployed = false** currently (ENV null)
- `useDelegateCapital()`: `vault.delegateCapital(agentId, {value: amount})`
- `useWithdrawCapital()`: `vault.withdrawCapital(delegationId, recipient)`
- `usePayRegistrationFee()`: `vault.payRegistrationFee(agentId, {value: fee})`
- `useGetAgentBalance()`: `vault.getAgentBalance(agentId)`

**`useERC8004`** (498 lines):
- `useRegisterAgent()`: calls `registerAgent()` from `@/lib/erc8004` → mint ERC-721
- `useSetAgentMetadata()`: set key-value metadata on-chain
- `useGetReputation()`: query reputation summary
- `useGiveFeedback()`: submit feedback to Reputation Registry

---

## Section D: Components (18 files)

**Directory:** `src/components/` — 2,763 lines total

### Layout Components

| Component | Lines | Purpose |
|-----------|-------|---------|
| `layout/header.tsx` | 254 | Top navigation bar, wallet connect button, network indicator |
| `layout/sidebar.tsx` | 326 | Side navigation (Dashboard, Agents, Leaderboard, Portfolio, Trading, Yield, Settings) |
| `layout/footer.tsx` | 156 | Footer links, social icons, version info |
| `layout/dashboard-layout.tsx` | 78 | Wrapper with sidebar + header for inner pages |
| `layout/roadmap.tsx` | 257 | Phase timeline on landing page (3 phases, each with items + done status) |

### UI Components

| Component | Lines | Purpose |
|-----------|-------|---------|
| `ui/modal.tsx` | 149 | Reusable modal dialog (backdrop, close, title, content) |
| `ui/tabs.tsx` | 117 | Tab navigation (horizontal pills/underline) |
| `ui/button.tsx` | 88 | Styled button variants (primary, secondary, ghost, danger) |
| `ui/input.tsx` | 48 | Form input with labels and validation |
| `ui/select.tsx` | 150 | Dropdown select with options |
| `ui/badge.tsx` | 58 | Status badges (active, paused, stopped, live, coming soon) |
| `ui/card.tsx` | 90 | Content card with glass morphism |
| `ui/skeleton.tsx` | 79 | Loading skeleton shimmer |
| `ui/tooltip.tsx` | 78 | Hover tooltip |
| `ui/agent-avatar.tsx` | 515 | Agent logo display (from 200 PNGs or placeholder SVG) + random cycling |
| `ui/avatar.tsx` | 120 | Generic avatar component |

### Utility Components

| Component | Lines | Purpose |
|-----------|-------|---------|
| `loading-fallback.tsx` | 112 | Suspense fallback (loading spinner) |
| `error-boundary.tsx` | 88 | React error boundary wrapper |

---

## Section E: Config (5 files)

**Directory:** `src/config/` — 2,250 lines total

### `chains.ts` (158 lines)

```typescript
// Monad chain definitions
monadTestnet: { id: 10143, name: 'Monad Testnet', nativeCurrency: { name: 'MON', decimals: 18 } }
monadMainnet: { id: 143, name: 'Monad', nativeCurrency: { name: 'MON', decimals: 18 } }

// Contract addresses per network (CONTRACTS object)
DEX_ROUTER, BONDING_CURVE_ROUTER, LENS, CURVE, WMON, V3_FACTORY, CREATOR_TREASURY

// ERC-8004 Registries (same on both networks)
IDENTITY_REGISTRY:  0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
REPUTATION_REGISTRY: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

// Capital Vault (from ENV — currently null, not deployed)
CAPITAL_VAULT: process.env.NEXT_PUBLIC_CAPITAL_VAULT_MAINNET || null

// x402 Config
USDC addresses per network, facilitator URL, decimals
```

### `contracts.ts` (1,907 lines)

**13+ ABIs exported:**

| Category | ABIs |
|----------|------|
| nad.fun DEX | `lensAbi`, `curveAbi`, `routerAbi`, `bondingCurveRouterAbi`, `dexRouterAbi`, `erc20Abi` |
| ERC-8004 | `identityRegistryAbi`, `reputationRegistryAbi` |
| Yield | `aprMonAbi` (aPriori liquid staking), `upshiftVaultAbi` (Upshift real yield) |
| ANOA Custom | `anoaAgentIdentityAbi`, `anoaAgentReputationAbi`, `capitalVaultAbi` |

**Token/Contract Addresses:**
```
YIELD_CONTRACTS = {
  APRMON:          0x0c65A0BC65a5D819235B71F554D210D3F80E0852
  UPSHIFT_VAULT:   0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA
  EARNAUSD:        0x103222f020e98Bba0AD9809A011FDF8e6F067496
  AUSD:            0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a
  USDC:            0x754704Bc059F8C67012fEd69BC8A327a5aafb603
  LIFI_ROUTER:     0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37
}

Decimals: MON/aprMON (18), aUSD/USDC/earnAUSD (6)
```

### `wagmi.ts` (94 lines)

- Wagmi config with Monad chains (mainnet + testnet)
- AppKit (WalletConnect) project ID
- Transport: HTTP with custom RPC URLs
- Connectors: injected (MetaMask) + WalletConnect

### `rpc.ts` (86 lines)

- RPC URL selection per network
- Fallback RPC endpoints
- Timeout configuration

### `index.ts` (5 lines)

- Re-exports from chains.ts and contracts.ts

---

## Section F: Lib Files (26 files)

**Directory:** `src/lib/` — 8,387 lines total

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `strategy-engine.ts` | 1,012 | 6 trading strategies (MOMENTUM/YIELD/ARBITRAGE/DCA/GRID/HEDGE) + main evaluator + market data fetcher + investment plan context |
| 2 | `ai-advisor.ts` | 1,024 | Multi-agent AI: Market Analyst (bull/bear debate + 5 tools) + Risk Manager (risk override), 3-tier fallback (Cloudflare → GLM-4.7 → Vikey), `callAI()` shared function |
| 3 | `trade-memory.ts` | 623 | BM25 Okapi trade memory retrieval (k1=1.5, b=0.75) + AI-powered reflection + rule-based lesson extraction |
| 4 | `erc8004.ts` | 649 | ERC-8004: 8 identity functions + 8 reputation functions + metadata helpers |
| 5 | `technical-indicators.ts` | 495 | 7 indicators (SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA), pure TypeScript, auto-generated signals |
| 6 | `anoa-contracts.ts` | 480 | ANOA custom contracts: identity, reputation, vault (40+ functions, NOT deployed) |
| 7 | `lifi-client.ts` | 471 | LiFi DEX aggregator: quote, swap, status, 52 MONAD_TOKENS, `getERC20Holdings()` via multicall |
| 8 | `nadfun-api.ts` | 397 | nad.fun REST API with throttle queue: market data, metrics, swaps, chart, holdings, token info (rate limit: 10/min free, 100/min with key) |
| 9 | `trade-judgement.ts` | 381 | OpenClaw proposals + EIP-712 signing/verification + nonce management |
| 10 | `chart-aggregator.ts` | 374 | 3-source OHLCV fallback: nad.fun → DexScreener → GeckoTerminal, 3-min cache TTL |
| 11 | `token-discovery.ts` | 358 | Discover trending tokens from nad.fun on-chain events (CurveBuy/Sell/Create), enrich top 8 with market data |
| 12 | `relay-client.ts` | 287 | Relay Protocol: solver-based quotes + swaps, Monad chain support |
| 13 | `agent0-service.ts` | 241 | agent0-sdk wrapper: read-only (search, get) + write (register, feedback) |
| 14 | `r2-storage.ts` | 205 | Cloudflare R2: upload metadata/feedback/validation, download, existence check |
| 15 | `config.ts` | 201 | Environment vars, network selection, RPC/explorer/API URLs, validation |
| 16 | `risk-guard.ts` | 161 | 6 pre-trade checks: gas reserve, max position, daily loss, daily trades, max drawdown, min capital |
| 17 | `agent-logos.ts` | 149 | 200 agent logos (512x512 PNG), deterministic selection, placeholder SVG |
| 18 | `agent-wallet.ts` | 146 | HD wallet BIP-32 derivation: `deriveWalletAddress()`, `getAgentWallet()`, `getAgentAccount()` |
| 19 | `pnl-tracker.ts` | 142 | MON/USD price feed: CoinGecko → CoinMarketCap → stale cache, 60s TTL |
| 20 | `utils.ts` | 127 | Formatting (address, number, currency, %), token math, time utils, cn() |
| 21 | `vault-operator.ts` | 124 | AnoaCapitalVault operator: deposit, withdraw, fee management (for future deployment) |
| 22 | `x402-server.ts` | 113 | x402 payment protocol: USDC on Monad, facilitator config, route protection |
| 23 | `risk-metrics.ts` | 91 | Sharpe ratio (annualized), max drawdown calc, win rate |
| 24 | `rpc-client.ts` | 88 | Viem publicClient with timeout (10s default), retry (2 attempts), `withTimeout()`, `safeRpcCall()` |
| 25 | `get-base-url.ts` | 33 | Resolves base URL for internal API calls (localhost in dev, VERCEL_URL in prod) |
| 26 | `prisma.ts` | 15 | Singleton Prisma client (global instance, dev logging) |

### Key Library Categories

**Trading Engine:**
- `strategy-engine.ts` — Strategy evaluation (6 strategies)
- `ai-advisor.ts` — Multi-agent AI enhancement
- `trade-memory.ts` — BM25 learning from past trades
- `technical-indicators.ts` — 7 indicator calculations
- `chart-aggregator.ts` — OHLCV data from 3 sources
- `token-discovery.ts` — Trending token discovery
- `risk-guard.ts` — Pre-trade risk checks

**Trade Execution:**
- `nadfun-api.ts` — nad.fun bonding curve API
- `lifi-client.ts` — LiFi DEX aggregator (52 tokens)
- `relay-client.ts` — Relay Protocol solver
- `pnl-tracker.ts` — MON/USD price + PnL
- `risk-metrics.ts` — Sharpe, drawdown, win rate

**Blockchain:**
- `agent-wallet.ts` — HD wallet derivation (BIP-32)
- `erc8004.ts` — ERC-8004 identity + reputation
- `rpc-client.ts` — Timeout-wrapped RPC client
- `anoa-contracts.ts` — ANOA custom contracts
- `vault-operator.ts` — Capital vault operations

**Infrastructure:**
- `config.ts` — Environment + network config
- `r2-storage.ts` — Cloudflare R2 storage
- `x402-server.ts` — Micropayment protocol
- `trade-judgement.ts` — Human-in-the-loop proposals
- `agent0-service.ts` — Agent0 SDK integration

---

## Section G: Prisma Schema (12 Models)

| Model | Key Fields | Relations |
|-------|-----------|----------|
| **User** | address (unique), createdAt | → agents[], delegations[] |
| **Agent** | name, strategy (Enum 6), riskParams (JSON), trustScore, totalPnl, totalCapital, sharpeRatio, maxDrawdown, winRate, totalTrades, erc8004AgentId, metadataUri, walletAddr, walletIndex, status (Enum 4), autoExecute, dailyLossLimit, maxDailyTrades | → executions[], delegations[], validations[], feedbacks[], proposals[] |
| **Execution** | agentId, type (Enum 10), params (JSON), result (JSON), pnlUsd, amountUsd, txHash, status (4 states), gasUsed | → agent |
| **Delegation** | userId, agentId, amount, txHash, status (ACTIVE/WITHDRAWN), lockupEnd | → user, agent |
| **Validation** | agentId, executionId, validatorAddr, schemeId, artifactHash, artifactUri, score, metadata | → agent |
| **Feedback** | agentId, clientAddr, value (BigInt), valueDecimals, score, tag1, tag2, endpoint, txHash | → agent |
| **TradeProposal** | agentId, tokenAddress, tokenSymbol, amount, action, slippageBps, confidence, status (5 states), proposedBy, approvedBy, quoteData, expiresAt | → agent |
| **TokenHolding** | walletAddress, tokenAddress, symbol, balance, avgCostBasis, totalInvested, currentValue, pnl | — |
| **ApiKey** | userId, name, key, permissions, lastUsed | → user |
| **YieldDeposit** | walletAddr, strategyId, protocol (APRIORI/UPSHIFT), action, tokenIn/Out, amountIn, sharesOut, txHash, status, chainId | — |
| **YieldWithdrawal** | walletAddr, strategyId, protocol, requestId, shares, expectedAssets, claimedAssets, requestTxHash, claimTxHash, status (4 states), unlockAt | — |
| **FeePayment** | agentId, feeType (REGISTRATION), amount, currency, txHash, status | → agent |

### Enums (11)

```prisma
enum Strategy          { MOMENTUM, YIELD, ARBITRAGE, DCA, GRID, HEDGE }
enum AgentStatus       { PENDING, ACTIVE, PAUSED, STOPPED }
enum ExecutionType     { BUY, SELL, PROVIDE_LIQUIDITY, REMOVE_LIQUIDITY, LEND, BORROW, REPAY, STAKE, UNSTAKE, CLAIM_REWARDS }
enum ExecutionStatus   { PENDING, EXECUTING, SUCCESS, FAILED }
enum DelegationStatus  { ACTIVE, WITHDRAWN }
enum FeeType           { REGISTRATION }
enum TradeProposalStatus { PENDING, APPROVED, REJECTED, EXPIRED, EXECUTED }
enum YieldProtocol     { APRIORI, UPSHIFT }
enum YieldAction       { DEPOSIT, WITHDRAW_INSTANT, WITHDRAW_DELAYED }
enum YieldTxStatus     { PENDING, CONFIRMED, FAILED }
enum WithdrawalStatus  { PENDING, CLAIMABLE, CLAIMED, FAILED }
```

---

## Section H: Frontend → API Connections

```
Page               → API Routes Called
────────────────────────────────────────────
/ (Landing)       → GET /api/leaderboard (via useGlobalStats)
/dashboard        → GET /api/agents, GET /api/portfolio
/agents           → GET /api/agents
/agents/create    → POST /api/metadata, POST /api/agents, ERC-8004 on-chain
/leaderboard      → GET /api/leaderboard, Capital Vault hooks (non-functional)
/portfolio        → GET /api/portfolio, GET /api/portfolio/transactions, on-chain ERC20 balanceOf reads
/trading          → (COMING SOON — no API calls)
/yield            → GET /api/yield, on-chain contract calls (deposit/withdraw)
/settings         → (local state — no API calls)
```

### Server-Side Triggers (No Frontend)

```
POST /api/scheduler         → triggered by auto-loop or manual cron
POST /api/agents/[id]/sync  → triggered by admin or scheduler
POST /api/agents/[id]/close → triggered by agent owner
POST /api/agents/[id]/sweep → triggered by agent owner after close
POST /api/trade             → triggered by scheduler (auto-execute) or proposal approval
```

### External API Dependencies

| External Service | Library File | Purpose |
|-----------------|-------------|---------|
| nad.fun API | `nadfun-api.ts` | Market data, metrics, token info, chart, holdings |
| LiFi REST API | `lifi-client.ts` | DEX aggregation quotes + swap execution (52 tokens) |
| Relay Protocol | `relay-client.ts` | Solver-based quotes + swap execution |
| aPriori API | `yield/route.ts` | APY, TVL, staker data for MON staking |
| Upshift API | `yield/route.ts` | APY, TVL, share prices for earnAUSD vault |
| CoinGecko API | `pnl-tracker.ts` | MON/USD price (primary) |
| CoinMarketCap API | `pnl-tracker.ts` | MON/USD price (fallback) |
| DexScreener API | `chart-aggregator.ts` | OHLCV chart data (fallback 2) |
| GeckoTerminal API | `chart-aggregator.ts` | OHLCV chart data (fallback 3) |
| Etherscan API v2 | `portfolio/transactions/route.ts` | Wallet transaction history |
| Cloudflare R2 | `r2-storage.ts` | Metadata, proofs, artifacts storage |
| Cloudflare AI | `ai-advisor.ts` | AI analysis (tier 1 — llama-3.3-70b) |
| GLM-4.7 (z.ai) | `ai-advisor.ts` | AI analysis (tier 2 fallback) |
| Vikey.ai | `ai-advisor.ts` | AI analysis (tier 3 fallback) |
| Monad RPC | `rpc-client.ts` | On-chain reads/writes (balance, tx, contracts) |
| ERC-8004 Registry | `erc8004.ts` | Identity registration, reputation feedback |

---

## Summary Table

| Category | Files | Lines |
|----------|-------|-------|
| Frontend Pages (9 pages + layout/providers/CSS) | 12 | ~9,053 |
| API Routes | 23 | ~6,237 |
| Library Files | 26 | ~8,387 |
| Custom Hooks | 12 | ~3,562 |
| Components | 18 | ~2,763 |
| Config | 5 | ~2,250 |
| **Total `src/`** | **96** | **~32,252** |

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS 4 + glassmorphism |
| Blockchain | viem + wagmi + AppKit (WalletConnect) |
| Database | PostgreSQL + Prisma 6 (12 models, 11 enums) |
| AI | Cloudflare AI + GLM-4.7 + Vikey.ai (3-tier fallback) |
| Storage | Cloudflare R2 |
| Payments | x402 Protocol (USDC micropayments) |
| Protocols | A2A (JSON-RPC 2.0) + MCP (5 tools) |
| Chain | Monad (mainnet: 143, testnet: 10143) |

---

*Last Updated: February 2026*
