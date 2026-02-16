# ANOA: Smart Contracts & Prisma Schema Architecture

> Complete mapping between Solidity smart contracts, Prisma schema, and application code.
> Last updated: February 2026

---

## Table of Contents

1. [Contract Overview](#contract-overview)
2. [AnoaCapitalVault.sol — Integration Status](#anoacapitalvaultsol--integration-status)
3. [AnoaTrustlessAgentCore.sol — Integration Status](#anoatrustlessagentcoresol--integration-status)
4. [ERC-8004 Registry](#erc-8004-registry)
5. [Prisma Schema vs Contract Mapping](#prisma-schema-vs-contract-mapping)
6. [Agent ID System](#agent-id-system)
7. [Architecture Decisions](#architecture-decisions)
8. [GAP Analysis](#gap-analysis)

---

## Contract Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    ANOA Smart Contracts                        │
│                                                                │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ AnoaCapitalVault.sol │    │ AnoaTrustlessAgentCore.sol  │  │
│  │                     │    │                             │  │
│  │ - MON delegation    │    │ - EIP-712 trade intents     │  │
│  │ - ERC20 delegation  │    │ - Risk management           │  │
│  │ - Fee collection    │    │ - Position tracking         │  │
│  │ - Lockup periods    │    │ - On-chain trade execution  │  │
│  │ - Withdrawal        │    │ - PnL tracking              │  │
│  │ - Emergency exit    │    │ - Fee collection            │  │
│  └─────────┬───────────┘    └──────────────┬──────────────┘  │
│            │ PARTIALLY USED               │ NOT USED          │
│            │ (hooks + vault-operator)     │ (0% integrated)   │
│            ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                ERC-8004 Registries (Official Monad)      │  │
│  │  Identity:   0x8004A169...  (agent registration)  ✅     │  │
│  │  Reputation: 0x8004BAa1...  (feedback tracking)   ✅     │  │
│  │  Validation: -              (not integrated)      ❌     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            DeFi Router Contracts (Mainnet)                │  │
│  │  nad.fun Bonding Curve: 0x6F6B8F1a... (buy/sell)   ✅   │  │
│  │  nad.fun DEX Router:    0x0B79d71A... (graduated)  ✅   │  │
│  │  nad.fun LENS:          0x7e78A8DE... (quotes)     ✅   │  │
│  │  LiFi Router:           0x026F2520... (52 tokens)  ✅   │  │
│  │  Relay Router:          0x3eC130B6... (solver)     ✅   │  │
│  │  Relay Approval Proxy:  0x58cC3e0a... (ERC20)      ✅   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │             Yield Protocol Contracts (Mainnet)            │  │
│  │  aPriori (aprMON):      0x0c65A0BC... (staking)    ✅   │  │
│  │  Upshift (earnAUSD):    0x36eDbF0C... (vault)      ✅   │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Contract source files:**
- `contracts/src/AnoaCapitalVault.sol`
- `contracts/src/AnoaTrustlessAgentCore.sol`

---

## AnoaCapitalVault.sol — Integration Status

### Struct: Delegation

```solidity
struct Delegation {
    address delegator;     // Who delegated
    uint256 agentId;       // Agent token ID (uint256)
    uint256 amount;        // Amount in MON
    uint256 depositedAt;   // Deposit timestamp
    uint256 lockupEndsAt;  // When withdrawal is allowed
    bool isActive;         // Still active?
}
```

### Struct: FeeConfig

```solidity
struct FeeConfig {
    uint256 registrationFee;   // Registration fee (default: 100 MON)
    uint256 tradingFeeBps;     // Trading fee (basis points, 100 = 1%)
    uint256 withdrawalFeeBps;  // Withdrawal fee (basis points)
    uint256 minCapital;        // Minimum capital for delegation
}
```

### Functions — Integration Status:

| Function | Signature | Frontend Hook | Status |
|----------|-----------|--------------|--------|
| **DELEGATION** | | | |
| `delegateCapital` | `(uint256 agentId) payable` | `useDelegateCapital()` | Connected, vault NULL |
| `delegateCapitalWithLockup` | `(uint256 agentId, uint256 lockupDays) payable` | None | Custom lockup |
| `delegateToken` | `(address token, uint256 agentId, uint256 amount)` | None | ERC20 delegation |
| **WITHDRAWAL** | | | |
| `withdrawCapital` | `(uint256 delegationId, address recipient)` | `useWithdrawCapital()` | Connected, vault NULL |
| `withdrawToken` | `(uint256 delegationId, address token, address recipient)` | None | ERC20 withdrawal |
| `emergencyWithdraw` | `(uint256 delegationId)` | None | 7-day emergency |
| **FEES** | | | |
| `payRegistrationFee` | `(uint256 agentId) payable` | In create flow | Connected |
| `recordTradingFee` | `(uint256 agentId, address token, uint256 amount)` | None | Operator-only |
| `withdrawFees` | `()` | None | Owner-only |
| `withdrawTokenFees` | `(address token)` | None | Owner-only |
| `withdrawFeesToRecipient` | `(address recipient)` | None | Owner-only |
| **READ** | | | |
| `feeConfig` | `() view` | `useVaultInfo()` | Connected |
| `agentCapital` | `(uint256) view` | Available | Connected |
| `totalDelegatedCapital` | `() view` | Available | Connected |
| `defaultLockupPeriod` | `() view` | Available | Connected |
| `delegations` | `(uint256) view` | Available | Connected |
| `getDelegatorDelegations` | `(address) view` | `useDelegatorDelegations()` | Connected |
| `calculateWithdrawalFee` | `(uint256) view` | Available | Connected |
| **ADMIN** | | | |
| `setOperator` | `(address, bool)` | None | |
| `setTokenWhitelist` | `(address, bool)` | None | |
| `updateFeeConfig` | `(FeeConfig)` | None | |
| `updateDefaultLockupPeriod` | `(uint256)` | None | |
| `updateFeeRecipient` | `(address)` | None | |
| `updateTreasury` | `(address)` | None | |
| `pause` / `unpause` | `()` | None | |

**Summary**: 10/25 functions integrated (40%). Core functions (delegate/withdraw) are connected to frontend hooks. Server-side integration via `vault-operator.ts` is ready (recordPnlOnChain, depositProfitsOnChain). Vault NOT yet deployed — set ENV after deployment to activate.

### Server-Side Vault Integration:

**File:** `src/lib/vault-operator.ts` + `src/app/api/trade/route.ts`

```
Post-Trade Vault Integration (trade/route.ts: distributePnlToDelegators):
├── 1. Calculate pro-rata PnL per delegator
├── 2. Deduct 20% performance fee (on profits only)
├── 3. Batch update delegations (Prisma $transaction)
├── 4. recordPnlOnChain(delegationIds, pnlAmounts) — vault-operator.ts
└── 5. depositProfitsOnChain(agentId, totalProfit, agentAccount) — if profitable

Currently: vault address NULL → on-chain calls silently skip
After deployment: set CAPITAL_VAULT + VAULT_OPERATOR_PRIVATE_KEY → everything activates
```

### Agent Lifecycle Integration:

```
Close Agent: POST /api/agents/[id]/close
├── Verify ownership via userAddress
├── Stop agent (status → STOPPED)
├── Calculate final PnL from all executions
└── Return agent wallet address for fund sweep

Fund Sweep: POST /api/agents/[id]/sweep
├── Step 1: Auto-sell ALL token holdings
│   ├── Query ERC20 balances on-chain (via agent wallet)
│   ├── Per token: POST /api/trade { action: sell, amount: balance }
│   └── Log each sell result (success/failed)
├── Step 2: Transfer remaining MON to owner wallet
│   ├── sweepAmount = walletBalance - gas reserve
│   └── walletClient.sendTransaction(to: recipient, value: sweepAmount)
└── Ownership verification via userAddress

Registration Fee: POST /api/agents
├── 100 MON fee collected during agent creation
├── On-chain: payRegistrationFee(agentId) to vault (if deployed)
├── DB: FeePayment record created (amount, currency, txHash)
└── Frontend: usePayRegistrationFee() hook ready
```

---

## AnoaTrustlessAgentCore.sol — Integration Status

### Struct: AgentPosition

```solidity
struct AgentPosition {
    uint256 totalCapital;    // Total capital
    uint256 usedCapital;     // Capital in use
    int256 unrealizedPnL;    // Unrealized P&L
    int256 realizedPnL;      // Realized P&L
    uint256 todayLoss;       // Daily loss tracking
    uint256 lastResetDay;    // Day counter
    uint256 tradesCount;     // Total trades
    uint256 lastTradeAt;     // Last trade timestamp
}
```

### Struct: TradeIntent (EIP-712)

```solidity
struct TradeIntent {
    uint256 agentId;         // Agent token ID
    address token;           // Token to trade
    uint256 amount;          // Amount
    bool isBuy;              // Buy or sell
    uint256 minAmountOut;    // Slippage protection
    uint256 deadline;        // Expiry timestamp
    uint256 nonce;           // Replay protection
}
```

### Functions — Integration Status:

| Function | Status | Reason Not Used |
|----------|--------|----------------|
| **TRADING** | | |
| `executeBuy(TradeIntent, bytes sig)` | Not used | Server trades directly to nad.fun/LiFi/Relay |
| `executeSell(TradeIntent, bytes sig)` | Not used | Server trades directly to nad.fun/LiFi/Relay |
| **DELEGATION** | | |
| `delegateCapital(uint256 agentId, uint256 days, RiskParams)` | Not used | Using AnoaCapitalVault |
| `withdrawCapital(uint256 agentId, uint256 index)` | Not used | Using AnoaCapitalVault |
| **FEES** | | |
| `recordTradingFee(uint256 agentId, address token, uint256)` | Not used | No fee tracking yet |
| `withdrawFees()` | Not used | |
| **VIEW** | | |
| `getPosition(uint256 agentId)` | Not used | Metrics from Prisma DB |
| `getDelegations(uint256 agentId)` | Not used | Via AnoaCapitalVault |
| `getTradeHistory(uint256 agentId)` | Not used | Via Prisma DB |
| **ADMIN** | | |
| `setAllowedToken(address, bool)` | Not used | Token list in config.ts |
| `setProtocolFee(uint256)` | Not used | |
| `setDefaultRiskParams(RiskParameters)` | Not used | Risk params in Prisma JSON |
| `setDexRouter(address)` | Not used | Router addresses in contracts.ts |
| `setStablecoin(address)` | Not used | Hardcoded |
| `setTreasury(address)` | Not used | |

**Summary**: 0/15 functions integrated (0%). This contract is ENTIRELY unused.

### Why It's Not Used:

Server-side trade execution (`/api/trade`) interacts directly with:
1. **nad.fun bonding curve contracts** (Lens + Router) for nad.fun tokens
2. **LiFi DEX aggregator API** for 52 MONAD_TOKENS (ERC20 standards)
3. **Relay Protocol** for solver-based routing

Trades do NOT go through AnoaTrustlessAgentCore because:
- Contract is not deployed to Monad
- Server-side execution is more flexible (logic changes without redeployment)
- No extra gas cost for intermediary contract
- EIP-712 signing is already implemented in `trade-judgement.ts`

---

## ERC-8004 Registry

### Addresses (Deterministic, same on all EVM chains):

```
Identity Registry:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

### Integration Status:

| Registry | Function | File | Status |
|----------|----------|------|--------|
| **Identity** | `register()` | agent0-service.ts, erc8004.ts | Agent creation (mint ERC-721) |
| | `ownerOf()` | useERC8004.ts, erc8004.ts | Ownership verification |
| | `setAgentURI()` | agent0-service.ts | Metadata update |
| | `tokenURI()` | agent0-service.ts, erc8004.ts | Metadata read |
| | `setMetadata()` | agent0-service.ts, erc8004.ts | Extended key-value metadata |
| **Reputation** | `giveFeedback()` | agent0-service.ts, trade/route.ts | Auto-submitted post-trade |
| | `getSummary()` | agent0-service.ts, erc8004.ts | Reputation query |
| | `readAllFeedback()` | agent0-service.ts | Feedback list |
| | `getTrustScore()` | agent0-service.ts | Trust score calculation |
| | `revokeFeedback()` | — | Not used |
| | `appendResponse()` | — | Not used |
| **Validation** | `validationRequest()` | — | Not used |
| | `validationResponse()` | — | Not used |

**Note**: Write operations to ERC-8004 registries go through `AGENT_PRIVATE_KEY` or the agent's HD wallet. See [Wallet-Architecture.md](./Wallet-Architecture.md) for details.

---

## Prisma Schema vs Contract Mapping

### Agent Model

| Prisma Field | Type | Contract Equivalent | Synced? |
|-------------|------|-------------------|---------|
| `id` | String (CUID) | — | Off-chain only |
| `erc8004AgentId` | BigInt? | ERC-721 tokenId (Identity Registry) | At creation |
| `anoaAgentId` | BigInt? | ERC-721 tokenId (ANOA contract) | Not populated |
| `onChainId` | String? | `"eip155:{chainId}:{registry}#{tokenId}"` | At creation |
| `walletIndex` | Int? | — | Off-chain only |
| `walletAddr` | String? | — | Off-chain only |
| `totalCapital` | Decimal | `AgentPosition.totalCapital` (TrustlessCore) | Not synced (reconciled via on-chain balance) |
| `totalPnl` | Decimal | `AgentPosition.realizedPnL` (TrustlessCore) | Not synced (tracked in DB) |
| `totalTrades` | Int | `AgentPosition.tradesCount` (TrustlessCore) | Not synced (tracked in DB) |
| `winRate` | Float | — (not in contract) | Off-chain only |
| `sharpeRatio` | Float | — (not in contract) | Off-chain only |
| `maxDrawdown` | Float | — (not in contract) | Off-chain only |
| `trustScore` | Int | Reputation Registry `getTrustScore()` | Not synced |
| `riskParams` | JSON | `RiskParameters` struct (TrustlessCore) | Not synced |
| `autoExecute` | Boolean | — | Off-chain only |
| `dailyLossLimit` | Float? | — | Off-chain only |
| `maxDailyTrades` | Int? | — | Off-chain only |

**Balance Reconciliation**: `totalCapital` is synced to on-chain reality via balance reconciliation (drift > 0.1 MON triggers DB update). This runs at `/api/agents`, `/api/leaderboard`, `/api/scheduler`, and `/api/agents/[id]/sync`.

### Delegation Model

| Prisma Field | Type | Contract Equivalent | Synced? |
|-------------|------|-------------------|---------|
| `id` | String (CUID) | `delegationId` (uint256) | Different ID systems |
| `userId` | String (FK) | `delegation.delegator` (address) | Semantic match |
| `agentId` | String (FK) | `delegation.agentId` (uint256) | Type mismatch (CUID vs uint256) |
| `amount` | Decimal | `delegation.amount` (uint256) | At creation |
| `txHash` | String | — | Off-chain tracking |
| `status` | Enum (ACTIVE/WITHDRAWN) | `delegation.isActive` (bool) | Semantic match |
| **`lockupEnd`** | DateTime? | `delegation.lockupEndsAt` (uint256) | Available in schema |
| `createdAt` | DateTime | `delegation.depositedAt` (uint256) | Implicit match |

### Feedback Model

| Prisma Field | Contract Equivalent | Synced? |
|-------------|-------------------|---------|
| `feedbackIndex` (BigInt?) | Return from `giveFeedback()` (uint64) | Nullable |
| `value` (BigInt) | `int128 value` | Match |
| `valueDecimals` (Int) | `uint8 valueDecimals` | Match |
| `tag1` (String?) | `bytes32 tag1` | Type conversion required |
| `tag2` (String?) | `bytes32 tag2` | Type conversion required |
| `txHash` (String?) | Transaction hash from giveFeedback | At submission |

### FeePayment Model

| Prisma Field | Contract Equivalent | Synced? |
|-------------|-------------------|---------|
| `agentId` (String FK) | payRegistrationFee(agentId) | Semantic match |
| `feeType` (REGISTRATION) | Registration fee type | Match |
| `amount` (Decimal) | 100 MON | Match |
| `currency` (String) | "MON" | — |
| `txHash` (String?) | Transaction hash | At payment |
| `status` (String) | — | Off-chain tracking |

---

## Agent ID System

### 3 IDs for 1 Agent:

```
┌─────────────────────────────────────────────────────────────┐
│ Agent in database:                                            │
│                                                               │
│ id = "clx1abc123..."              ← CUID (Prisma primary key)│
│ erc8004AgentId = 42               ← Token ID at 0x8004A169.. │
│ anoaAgentId = null                ← Token ID at ANOA contract │
│ onChainId = "eip155:143:0x8004..#42" ← Combined identifier  │
│                                                               │
│ Which ID to use when:                                         │
│                                                               │
│ id             → All internal operations (DB queries, API)    │
│ erc8004AgentId → ERC-8004 SDK calls (registration, feedback) │
│ anoaAgentId    → AnoaTrustlessAgentCore (NOT USED YET)       │
│ onChainId      → API responses (formatted string)            │
└─────────────────────────────────────────────────────────────┘
```

### When to use `erc8004AgentId` vs `anoaAgentId`:

| Field | Registry | When Populated | Used For |
|-------|----------|---------------|----------|
| `erc8004AgentId` | 0x8004A169... (official ERC-8004) | During `registerAgent()` | Feedback, search, reputation |
| `anoaAgentId` | ANOA custom contract | **NEVER** populated | TrustlessCore (not used) |

**Recommendation**: `anoaAgentId` can be removed if AnoaTrustlessAgentCore will not be deployed. Or populate it when the ANOA contract is deployed.

---

## Architecture Decisions

### Why Trade Execution Bypasses AnoaTrustlessAgentCore

**Current architecture**: Server-side execution directly to nad.fun/LiFi/Relay

```
CURRENT ARCHITECTURE (3-Router):
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│ Scheduler │────>│ POST /api/   │────>│ nad.fun Bonding   │
│ (auto-    │     │ trade        │     │ Curve (buy/sell)  │
│  execute) │     │              │────>│ LiFi DEX Agg      │
│           │     │ (wallet:     │     │ (52 MONAD_TOKENS) │
│ Dashboard │────>│  HD per-     │────>│ Relay Protocol    │
│ (approve) │     │  agent)      │     │ (solver-based)    │
└──────────┘     └──────────────┘     └──────────────────┘

IF USING TRUSTLESS CORE:
┌──────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────┐
│ Scheduler │────>│ POST /api/   │────>│ AnoaTrustless    │────>│ nad.fun │
│           │     │ trade        │     │ AgentCore.sol    │     │ / LiFi  │
│ Dashboard │────>│              │     │                  │────>│ / Relay │
│ (approve) │     │ (wallet:     │     │ - Risk checks    │     │         │
│           │     │  HD per-     │     │ - Position track │     │(ON-CHAIN)│
│           │     │  agent)      │     │ - Fee collection │     │         │
└──────────┘     └──────────────┘     └──────────────────┘     └─────────┘
```

### Pro/Con Comparison:

| Aspect | Server-Side (current) | Via TrustlessCore |
|--------|----------------------|-------------------|
| **Gas cost** | Low (1 tx) | High (2+ tx) |
| **Flexibility** | High (change logic without redeploy) | Low (needs proxy upgrade) |
| **Trustless** | No — server controls execution | Yes — on-chain enforced |
| **Transparency** | No — logic is off-chain | Yes — verifiable on explorer |
| **Speed** | Fast | Slower (contract overhead) |
| **Risk management** | Off-chain (JSON in Prisma) | On-chain (struct) |
| **Fee tracking** | Via Prisma records | Built-in contract logic |
| **Router support** | 3 routers (nad.fun + LiFi + Relay) | Would need contract updates |

### Decision:

**Keep server-side execution** — already proven and running. Deploy vault & TrustlessCore as post-production priority. The 3-router architecture (nad.fun bonding curve + LiFi DEX aggregator + Relay solver) works well with server-side flexibility.

---

## GAP Analysis

### Critical (Blocking Revenue):

| Issue | Impact | Status |
|-------|--------|--------|
| Registration fee | Platform collects 100 MON per agent | DONE — FeePayment record + vault hook |
| Trading fee per-trade | Platform collects fee per transaction | NOT DONE — needs vault deployed + `recordTradingFee()` |
| Vault not deployed | Delegation non-functional | NOT DONE — deploy vault, set ENV `CAPITAL_VAULT` |

### High (Data Integrity):

| Issue | Impact | Fix |
|-------|--------|-----|
| Trust score not synced from on-chain | DB can be stale | Background sync job |
| Metrics divergence | DB vs contract can drift | Balance reconciliation (implemented for totalCapital) |

### Medium (Missing Features):

| Issue | Impact | Fix |
|-------|--------|-----|
| ERC20 delegation (delegateToken) | Only MON, not stablecoins | Add hook + UI |
| Emergency withdrawal | Users can't access emergency funds | Add hook + UI |
| Operator authorization | Can't assign operator | Admin UI |
| Token whitelist | Can't whitelist tokens | Admin UI |
| AnoaTrustlessAgentCore 100% unused | Contract is redundant | Decide: use or remove |

### Low (Nice to Have):

| Issue | Impact | Fix |
|-------|--------|-----|
| Validation Registry unused | No validation flow | Implement if needed |
| `anoaAgentId` field never populated | Confusing | Remove or populate |
| pause/unpause has no UI | Can't emergency stop | Admin UI |

---

## Contract ABIs Reference

**File:** `src/config/contracts.ts` (1,907 lines)

| Category | ABI | Functions |
|----------|-----|----------|
| nad.fun | `lensAbi` | `getQuote`, `getCurveData`, `getAmountOut` |
| nad.fun | `curveAbi` | `getProgress`, `isGraduated` |
| nad.fun | `routerAbi` | `buy`, `sell` |
| nad.fun | `bondingCurveRouterAbi` | `createAndBuy`, `buy`, `sell` |
| nad.fun | `dexRouterAbi` | `exactInputSingle` |
| Standard | `erc20Abi` | `balanceOf`, `approve`, `transfer`, `allowance` |
| ERC-8004 | `identityRegistryAbi` | `register`, `setMetadata`, `tokenURI`, `ownerOf` |
| ERC-8004 | `reputationRegistryAbi` | `giveFeedback`, `getSummary` |
| Yield | `aprMonAbi` | `deposit`, `requestWithdrawal`, `claimWithdrawal` |
| Yield | `upshiftVaultAbi` | `deposit`, `redeem`, `requestRedeem` |
| ANOA | `anoaAgentIdentityAbi` | `register`, `setHandle`, `setCapabilities` |
| ANOA | `anoaAgentReputationAbi` | `recordScore`, `getScore` |
| ANOA | `capitalVaultAbi` | `delegateCapital`, `withdrawCapital`, `payRegistrationFee` |

---

## File References

| File | Purpose |
|------|---------|
| `contracts/src/AnoaCapitalVault.sol` | Capital vault contract (ready to deploy) |
| `contracts/src/AnoaTrustlessAgentCore.sol` | Trustless trading contract (post-production) |
| `src/hooks/useCapitalVault.ts` (520 lines) | Frontend hooks for vault operations |
| `src/hooks/useERC8004.ts` (498 lines) | Frontend hooks for ERC-8004 |
| `src/lib/erc8004.ts` (649 lines) | Server-side ERC-8004: 8 identity + 8 reputation functions |
| `src/lib/agent0-service.ts` (241 lines) | Server-side ERC-8004 via agent0-sdk |
| `src/lib/vault-operator.ts` (124 lines) | Server-side vault operations (recordPnl, depositProfits) |
| `src/lib/anoa-contracts.ts` (480 lines) | ANOA custom contracts (40+ functions, NOT deployed) |
| `src/app/api/agents/[id]/close/route.ts` (130 lines) | Agent close endpoint |
| `src/app/api/agents/[id]/sweep/route.ts` (236 lines) | Fund sweep endpoint (auto-sell + MON transfer) |
| `src/app/api/agents/[id]/sync/route.ts` (142 lines) | Balance reconciliation endpoint |
| `src/app/api/agents/route.ts` (298 lines) | Agent creation (registration fee collection) |
| `src/app/api/trade/route.ts` (1,119 lines) | 3-router trade execution + PnL + memory + reputation |
| `src/config/contracts.ts` (1,907 lines) | All ABI definitions |
| `src/config/chains.ts` (158 lines) | Chain definitions + contract addresses |
| `prisma/schema.prisma` | 12 models including FeePayment, TokenHolding |

---

*Last Updated: February 2026*
