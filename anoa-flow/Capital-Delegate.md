# ANOA Capital Delegation — Complete System

## Table of Contents
1. [Capital Flow Architecture](#1-capital-flow-architecture)
2. [On-Chain (Smart Contract)](#2-on-chain-smart-contract)
3. [Off-Chain (Backend API)](#3-off-chain-backend-api)
4. [Delegator PnL — Per-Entry Calculation](#4-delegator-pnl--per-entry-calculation)
5. [Simulation: Top 1 Agent + 3 Delegators (A, B, C)](#5-simulation-top-1-agent--3-delegators-a-b-c)
6. [Performance Fee & Withdrawal](#6-performance-fee--withdrawal)
7. [A2A Protocol in Capital Delegation](#7-a2a-protocol-in-capital-delegation)
8. [x402 Micropayment](#8-x402-micropayment)
9. [Codebase File Reference](#9-codebase-file-reference)

---

## 1. Capital Flow Architecture

```
User Wallet                  AnoaCapitalVault                 Agent HD Wallet
    |                              |                               |
    |-- delegateCapital(1000 MON)->|                               |
    |   (on-chain tx)              |                               |
    |                              |--- setAgentWallet(agentId) -->|
    |                              |   (operator, idempotent)      |
    |                              |                               |
    |                              |-- releaseFundsToAgent(1000) ->|
    |                              |   (operator tx)               |
    |                              |   releasedCapital[agent] += 1000
    |                              |                               |
    |                              |                               |-- Trading via 3-Router
    |                              |                               |   (nad.fun / LiFi / Relay)
    |                              |                               |   every 5 minutes via scheduler
    |                              |                               |
    |                              |                               |-- Trade completed, PnL calculated
    |                              |                               |
    |                              |<-- returnFundsFromAgent() ----|
    |                              |   (agent wallet tx)           |
    |                              |   releasedCapital[agent] -= amount
    |                              |                               |
    |<-- withdrawCapital() --------|                               |
    |   principal +/- PnL          |                               |
    |   - 20% performance fee      |                               |
    |   - 0.5% withdrawal fee      |                               |
```

### Core Principles
- **Vault does NOT hold large balances** — only fees (registration, performance, withdrawal)
- **1000 MON delegation -> goes directly to agent wallet** via `releaseFundsToAgent()`
- **TVL is still tracked normally** in vault (via `agentCapital[agentId]`)
- **Agent wallet balance = own capital + all delegator capital** for trading

---

## 2. On-Chain (Smart Contract)

**File**: `contracts/src/AnoaCapitalVault.sol`

### Related State Variables

```solidity
// Capital per-agent (total of all active delegations)
mapping(uint256 => uint256) public agentCapital;

// Trading wallet per-agent (HD wallet address)
mapping(uint256 => address) public agentWallets;

// Capital already released to agent wallet
mapping(uint256 => uint256) public releasedCapital;

// Fee configuration
uint256 public defaultPerformanceFeeBps = 2000; // 20%

// Individual delegation records
mapping(uint256 => Delegation) public delegations;
```

### Delegation Struct

```solidity
struct Delegation {
    address delegator;      // User wallet that delegated
    uint256 agentId;        // Agent ID (ERC-8004)
    uint256 amount;         // Principal amount (1000 MON)
    uint256 depositedAt;    // Delegation timestamp
    uint256 lockupEndsAt;   // Lockup period end
    bool isActive;          // Active status
    int256 accumulatedPnl;  // On-chain PnL (from recordDelegationPnl)
}
```

### Core Functions

| Function | Caller | Description |
|----------|--------|-------------|
| `delegateCapital(agentId)` | User | Delegate MON to agent. `msg.value` = amount |
| `setAgentWallet(agentId, wallet)` | Owner/Operator | Set HD wallet address for agent |
| `releaseFundsToAgent(agentId, amount)` | Operator | Send MON from vault to agent wallet |
| `returnFundsFromAgent(agentId)` | Agent Wallet | Return MON from agent to vault |
| `batchRecordPnl(ids[], amounts[])` | Operator | Record PnL per-delegation on-chain |
| `withdrawCapital(delegationId)` | Delegator | Withdraw principal +/- PnL - fees |
| `withdrawFees()` | Owner | Withdraw accumulated platform fees |

### withdrawCapital Formula

```solidity
if (pnl > 0) {
    performanceFee = (profit * performanceFeeBps) / 10000;
    totalWithdrawable = principal + profit - performanceFee;
} else if (pnl < 0) {
    totalWithdrawable = principal - loss; // can be 0 if total loss
} else {
    totalWithdrawable = principal;
}

withdrawalFee = (totalWithdrawable * 50) / 10000; // 0.5%
amountAfterFee = totalWithdrawable - withdrawalFee;

// performanceFee + withdrawalFee -> accumulatedFees (for owner)
// amountAfterFee -> transfer to user
```

---

## 3. Off-Chain (Backend API)

### POST /api/delegations — Delegation Flow

**File**: `src/app/api/delegations/route.ts`

```
1. User sends delegateCapital() tx on-chain (from frontend)
2. Frontend POSTs to /api/delegations with txHash
3. Backend:
   a. Validate: min 1000 MON, agent active, max 5 delegators
   b. Verify txHash on-chain (getTransactionReceipt)
   c. Parse CapitalDelegated event -> get onChainDelegationId
   d. Save Delegation record in DB (accumulatedPnl = 0)
   e. Update agent.totalCapital += amount
   f. NON-BLOCKING: setAgentWallet -> releaseFundsToAgent
      (capital goes directly to agent wallet)
```

### Rules

| Rule | Value | Enforced At |
|------|-------|-------------|
| Minimum delegation | 1,000 MON | Backend API |
| Max delegators/agent | 5 | Backend API (`activeDelegationCount >= 5`) |
| On-chain limit | Unlimited | Contract (NO hardcoded limit) |

**IMPORTANT**: The limit of 5 is backend-only. In the future it can be increased to 10+ without changing the contract.

---

## 4. Delegator PnL — Per-Entry Calculation

### Mechanism (CRITICAL)

**File**: `src/app/api/trade/route.ts` — function `distributePnlToDelegators()` (line 803)

Delegator PnL is calculated **PER-ENTRY POINT**, not from when the agent started trading.

```
Timeline:
---[Agent starts trading week 1]---[Trade 1: +50 MON]---[Trade 2: -20 MON]---
                                                                                 |
                     User A delegates (1000 MON) <- accumulatedPnl = 0 <--------+
                                                                                 |
---[Trade 3: +30 MON]---[Trade 4: -10 MON]---[Trade 5: +40 MON]---
        ^ User A gets share      ^ User A takes loss    ^ User A gets share
```

**User A ONLY receives PnL from Trade 3, 4, 5 onwards. NOT from Trade 1, 2.**

### How It Works in Code

```typescript
// Called AFTER every trade (line 641 trade/route.ts)
distributePnlToDelegators(agentId, pnlUsd);

async function distributePnlToDelegators(agentId, tradePnl) {
  // 1. Get agent's current totalCapital
  const totalCapital = agent.totalCapital; // e.g. 5000 MON

  // 2. Get ALL active delegations
  const activeDelegations = findMany({ agentId, status: 'ACTIVE' });

  // 3. Calculate share per delegator (pro-rata)
  for (const delegation of activeDelegations) {
    const share = (delegation.amount / totalCapital) * tradePnl;

    // 4. Performance fee ONLY from profit (not loss)
    const netShare = share > 0
      ? share * (1 - 0.20)  // deduct 20% performance fee
      : share;               // loss without deduction

    // 5. Increment accumulatedPnl (starts at 0 when delegated)
    delegation.accumulatedPnl += netShare;
  }

  // 6. Also record on-chain via batchRecordPnl
  await recordPnlOnChain(delegationIds, pnlAmounts);
}
```

### Why Per-Entry?

Because:
1. `Delegation.accumulatedPnl` is set to **0** when the record is created
2. `distributePnlToDelegators()` is only called after **NEW** trades
3. The function `increments` PnL, not sets it absolutely
4. Historical trades (before user delegated) are already completed, their PnL is not replayed

---

## 5. Simulation: Top 1 Agent + 3 Delegators (A, B, C)

### Setup

```
Agent: "Alpha Trader" (ERC-8004 ID: 164)
+-- Owner wallet: 0x656d... (created agent, paid 100 MON registration)
+-- Agent HD wallet: 0x87e6... (walletIndex: 0, from AGENT_MASTER_SEED)
+-- Strategy: MOMENTUM
+-- Owner's initial capital: 500 MON (manually transferred to agent wallet)
+-- Has been trading for 2 weeks, profit +200 MON
+-- Agent wallet balance: 700 MON
+-- totalCapital (DB): 700 MON
```

### Week 3: User A Delegates

```
T1: User A delegates 1000 MON
+-- on-chain: delegateCapital(agentId=164) value=1000 MON
+-- vault: agentCapital[164] += 1000
+-- backend: Delegation { userId: A, amount: 1000, accumulatedPnl: 0 }
+-- backend: agent.totalCapital = 700 + 1000 = 1700
+-- operator: releaseFundsToAgent(164, 1000 MON) -> agent wallet
+-- Agent wallet balance: 700 + 1000 = 1700 MON
```

### Week 3 Day 2: User B Delegates

```
T2: User B delegates 1000 MON
+-- Delegation { userId: B, amount: 1000, accumulatedPnl: 0 }
+-- agent.totalCapital = 1700 + 1000 = 2700
+-- releaseFundsToAgent -> agent wallet
+-- Agent wallet balance: 1700 + 1000 = 2700 MON
```

### Week 4: User C Delegates

```
T3: User C delegates 1000 MON
+-- Delegation { userId: C, amount: 1000, accumulatedPnl: 0 }
+-- agent.totalCapital = 2700 + 1000 = 3700
+-- releaseFundsToAgent -> agent wallet
+-- Agent wallet balance: 2700 + 1000 = 3700 MON
```

### Trades After All Delegations

**Trade 1: BUY 100 MON worth of nad.fun token, SELL for profit +50 MON**

```
tradePnl = +50 MON
totalCapital = 3700 MON

PnL Distribution:
+-- Owner share: (700/3700) * 50 = +9.46 MON (not a delegator, NOT included in distribution)
|   NOTE: Owner is NOT a delegator. Owner PnL is automatic because wallet balance increases.
|
+-- User A share: (1000/3700) * 50 = +13.51 MON
|   Performance fee (20%): 13.51 * 0.20 = 2.70 MON
|   Net share: 13.51 - 2.70 = +10.81 MON
|   A.accumulatedPnl = 0 + 10.81 = +10.81 MON
|
+-- User B share: (1000/3700) * 50 = +13.51 MON
|   Net share: 13.51 * 0.80 = +10.81 MON
|   B.accumulatedPnl = 0 + 10.81 = +10.81 MON
|
+-- User C share: (1000/3700) * 50 = +13.51 MON
    Net share: 13.51 * 0.80 = +10.81 MON
    C.accumulatedPnl = 0 + 10.81 = +10.81 MON

Total performance fee: 2.70 * 3 = 8.10 MON (for platform/agent owner)
Agent wallet: 3700 + 50 = 3750 MON
```

**Trade 2: LOSS -30 MON**

```
tradePnl = -30 MON
totalCapital = 3750 MON (increased from trade 1 profit)

Distribution:
+-- User A share: (1000/3750) * (-30) = -8.00 MON
|   Loss: NO performance fee
|   A.accumulatedPnl = 10.81 + (-8.00) = +2.81 MON
|
+-- User B share: (1000/3750) * (-30) = -8.00 MON
|   B.accumulatedPnl = 10.81 + (-8.00) = +2.81 MON
|
+-- User C share: (1000/3750) * (-30) = -8.00 MON
    C.accumulatedPnl = 10.81 + (-8.00) = +2.81 MON

Agent wallet: 3750 - 30 = 3720 MON
```

**Trade 3: PROFIT +80 MON**

```
tradePnl = +80 MON
totalCapital = 3720 MON

Distribution:
+-- User A share: (1000/3720) * 80 = +21.51 MON
|   Net (after 20%): 21.51 * 0.80 = +17.20 MON
|   A.accumulatedPnl = 2.81 + 17.20 = +20.01 MON
|
+-- User B share: +17.20 MON (net)
|   B.accumulatedPnl = 2.81 + 17.20 = +20.01 MON
|
+-- User C share: +17.20 MON (net)
    C.accumulatedPnl = 2.81 + 17.20 = +20.01 MON

Agent wallet: 3720 + 80 = 3800 MON
```

### Withdrawal: User A Exits

```
User A calls withdrawCapital(delegationId_A)

On-chain calculation:
+-- principal = 1000 MON
+-- accumulatedPnl = +20.01 MON (on-chain via batchRecordPnl)
+-- totalWithdrawable = 1000 + 20.01 = 1020.01 MON
|   (performance fee already deducted per-trade in backend,
|    but on-chain also deducts from positive PnL in contract)
|
|   NOTE: Performance fee calculated TWO ways (complementary):
|   - Backend: per-trade, netShare already reduced by 20%
|   - On-chain: withdrawCapital() also deducts 20% from positive accumulatedPnl
|   The ON-CHAIN calculation is authoritative (it determines the actual transfer)
|
+-- On-chain performance fee: 20.01 * 20% = 4.00 MON
+-- On-chain withdrawable: 1000 + 20.01 - 4.00 = 1016.01 MON
+-- Withdrawal fee (0.5%): 1016.01 * 0.005 = 5.08 MON
+-- FINAL transfer to User A: 1016.01 - 5.08 = 1010.93 MON
+-- Fees to platform: 4.00 + 5.08 = 9.08 MON

Post-withdrawal:
+-- agent.totalCapital -= 1000 (principal returned)
+-- Agent wallet needs to top-up vault for withdrawal via returnFundsFromAgent
+-- User A delegation status = WITHDRAWN
```

### Meanwhile: User B Continues

```
User B remains ACTIVE, still receives distribution from subsequent trades.
Agent now: totalCapital = 3800 - 1000 = 2800 MON
User B and C continue to receive pro-rata shares from future trades.
```

---

## 6. Performance Fee & Withdrawal

### Performance Fee (20%)

```
ONLY deducted from PROFIT, not from LOSS.

Examples:
- Delegator profit +100 MON -> fee 20 MON -> net +80 MON
- Delegator loss -50 MON   -> fee 0 MON  -> net -50 MON (full loss)
```

### Fee Configuration

| Fee | Default | Configurable? | By Whom |
|-----|---------|---------------|---------|
| Performance Fee | 2000 bps (20%) | Yes, per-agent | Owner (`setAgentPerformanceFee`) |
| Default Performance Fee | 2000 bps (20%) | Yes, global | Owner (`setDefaultPerformanceFeeBps`) |
| Withdrawal Fee | 50 bps (0.5%) | Yes | Owner (`updateFeeConfig`) |
| Registration Fee | 100 MON | Yes | Owner (`updateFeeConfig`) |
| Max Fee Cap | 5000 bps (50%) | No | Hardcoded |

### Where Do Fees Go?

```
All fees -> accumulatedFees (state variable in vault)
           -> Owner withdraws via withdrawFees()
           -> Goes to owner wallet (0x656d...)
```

---

## 7. A2A Protocol in Capital Delegation

### What Is A2A?

A2A (Agent-to-Agent) is a JSON-RPC 2.0 communication protocol that enables agents to communicate with each other. In ANOA, it is used for:

**File**: `src/app/api/a2a/route.ts`

### A2A + Capital Delegation Flow

```
External Agent (e.g. Risk Manager Agent)
    |
    |-- POST /api/a2a (JSON-RPC 2.0) -----> ANOA Agent
    |   { method: "trading/execute",         |
    |     params: {                          |
    |       tokenAddress: "0x...",           |
    |       amount: "10",                    |
    |       action: "buy",                   |
    |       agentId: "cmlmbaruk..."          |
    |     }                                  |
    |   }                                    |
    |   Header: X-402-Payment: <proof>       |
    |                                        |
    |   [$0.001 USDC micropayment via x402]  |
    |                                        |
    |                                        v
    |                              ANOA processes trade:
    |                              1. Validate x402 payment
    |                              2. Execute via 3-Router
    |                              3. Calculate PnL
    |                              4. distributePnlToDelegators()
    |                              5. Record on-chain
    |                                        |
    |<-- Response (txHash, pnl) -------------|
```

### A2A Methods Relevant to Capital

| Method | Description |
|--------|-------------|
| `trading/execute` | Execute trade (PnL distributed to delegators) |
| `trading/quote` | Get price quote (does not affect capital) |
| `trading/propose` | Create trade proposal for approval |
| `message/send` | Send message (market analysis, risk check) |
| `agent/info` | Agent info including capabilities |
| `agent/reputation` | Query on-chain trust score (ERC-8004) |

### Who Pays for A2A?

```
- If Agent A calls Agent B via A2A:
  Agent A wallet pays $0.001 USDC to Agent B wallet
  (via x402 facilitator, Monad USDC)

- If a regular User calls via A2A:
  User wallet pays $0.001 USDC

- A2A fee is SEPARATE from capital delegation fees
- A2A fee = agent revenue (not platform fee)
```

### Agent Card Discovery

```
GET /api/a2a -> Agent Card (public, free)

{
  "name": "ANOA Trading Agent",
  "capabilities": ["trading", "yield", "risk-management", "portfolio", "a2a", "mcp", "x402"],
  "authentication": { "schemes": ["x402"] },
  "skills": [
    { "id": "trading", "description": "Execute trades on Monad DEXes" },
    { "id": "judgement", "description": "Human-in-the-loop trade approval" }
  ],
  "protocols": {
    "a2a": { "endpoint": "/api/a2a", "version": "1.0.0" },
    "x402": { "enabled": true, "price": "$0.001" }
  }
}
```

---

## 8. x402 Micropayment

### What Is x402?

x402 is an HTTP 402 micropayment protocol. When an endpoint is x402-protected, the client must pay USDC before the request is processed.

**File**: `src/lib/x402-server.ts`

### Configuration

```typescript
// Mainnet
{
  network: 'eip155:143',
  usdc: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
  facilitator: 'https://x402-facilitator.molandak.org'
}

// Testnet
{
  network: 'eip155:10143',
  usdc: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
  facilitator: 'https://x402-facilitator.molandak.org'
}
```

### x402 Flow

```
1. Client POSTs to /api/a2a (or /api/trade)
2. Server checks x402 payment proof in header
3. If not yet paid:
   -> HTTP 402 Payment Required
   -> Response contains: payTo address, price, network, scheme
4. Client signs EIP-712 USDC transfer authorization
5. Facilitator verifies signature + settles payment (covers gas)
6. Client retries request with payment proof
7. Server processes request
```

### x402-Protected Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `POST /api/a2a` | $0.001 USDC | A2A JSON-RPC calls |
| `POST /api/trade` | $0.001 USDC | Trade execution |
| `GET /api/a2a` | FREE | Agent card discovery |
| `GET/POST /api/delegations` | FREE | Delegation management |
| `GET /api/leaderboard` | FREE | Leaderboard |

### x402 Revenue

```
x402 payment -> PAY_TO_ADDRESS (agent owner wallet / platform wallet)
This is SEPARATE from:
- Platform fees (registration, trading fee, withdrawal fee)
- Performance fee (20% of delegator profit)

x402 = revenue from A2A/trade services, paid per-call
```

---

## 9. Codebase File Reference

| File | Description | Key Lines |
|------|-------------|-----------|
| `contracts/src/AnoaCapitalVault.sol` | Smart contract vault | `delegateCapital`, `releaseFundsToAgent`, `returnFundsFromAgent`, `withdrawCapital` |
| `src/app/api/delegations/route.ts` | Delegation API | POST: create delegation + auto release capital |
| `src/app/api/trade/route.ts` | Trade execution | Line 641: `distributePnlToDelegators`, Line 803: PnL function |
| `src/lib/vault-operator.ts` | Server-side vault ops | `recordPnlOnChain`, `releaseFundsToAgentOnChain`, `returnFundsToVault`, `setAgentWalletOnVault` |
| `src/config/contracts.ts` | ABI for all functions | `capitalVaultAbi` with all events + functions |
| `src/lib/x402-server.ts` | x402 micropayment config | `createX402Server`, `getRouteConfig` |
| `src/app/api/a2a/route.ts` | A2A JSON-RPC endpoint | `message/send`, `trading/execute`, `agent/info` |
| `src/lib/agent-wallet.ts` | HD wallet derivation | `m/44'/60'/0'/0/{walletIndex}` per agent |
| `prisma/schema.prisma` | Database schema | `Delegation { amount, accumulatedPnl, onChainDelegationId }` |
| `contracts/test/AnoaAgent.t.sol` | Solidity tests | 55 vault tests + 13 capital flow tests |

---

## Summary Diagram: All Revenue Streams

```
                        ANOA Platform Revenue
                               |
          +--------------------+--------------------+
          |                    |                     |
    Platform Fees          x402 Revenue       Agent Performance
    (on-chain vault)       (per API call)     (from delegator profit)
          |                    |                     |
    +-----+-----+        $0.001 USDC          20% of profit
    |     |     |         per call             per withdrawal
    |     |     |              |                     |
  Reg   Trade  WD fee    -> PAY_TO_ADDRESS     -> accumulatedFees
  100   bps    0.5%      (agent/platform)      -> owner withdrawFees()
  MON   on vol              wallet
    |     |     |
    v     v     v
  accumulatedFees (vault) -> owner withdrawFees() -> 0x656d...
```

---

## Tests Passing (78 total)

### Capital Flow Tests (13 tests)

| Test | Description |
|------|-------------|
| `test_setAgentWallet` | Set wallet address for agent |
| `test_setAgentWallet_notAuthorized` | Only owner/operator allowed |
| `test_setAgentWallet_zeroAddress` | Reverts if address is 0 |
| `test_releaseFundsToAgent` | Release funds to agent wallet |
| `test_releaseFundsToAgent_noWalletSet` | Reverts if wallet not yet set |
| `test_releaseFundsToAgent_exceedsAvailable` | Reverts if exceeds available balance |
| `test_returnFundsFromAgent` | Return funds from agent to vault |
| `test_capitalFlowFullCycle` | Full cycle: delegate -> release -> trade -> return -> withdraw |
| `test_getAgentCapitalStatus` | View function for capital status |
| `test_setDefaultPerformanceFeeBps` | Set default performance fee |
| `test_setDefaultPerformanceFeeBps_tooHigh` | Reverts if > 50% |
| `test_withdrawWithProfit` | Withdraw with performance fee deduction |
| `test_withdrawWithProfitAndFee` | Withdraw with performance + withdrawal fee |

### Vault Core Tests (42 tests)

Includes: delegation, withdrawal, fee, emergency, batch PnL, fund separation, multi-operator, etc.
