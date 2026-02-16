# ANOA: Agent Wallet Architecture

> Complete explanation of the per-agent HD Wallet system: setup, derivation, security, and integration.
> Last updated: February 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Setup AGENT_MASTER_SEED](#setup-agent_master_seed)
3. [BIP-32 Derivation Path](#bip-32-derivation-path)
4. [Flow: Agent Creation](#flow-agent-creation)
5. [Flow: Agent Trade Execution](#flow-agent-trade-execution)
6. [All Functions in agent-wallet.ts](#all-functions-in-agent-walletsts)
7. [Legacy Compatibility (AGENT_PRIVATE_KEY)](#legacy-compatibility-agent_private_key)
8. [Security Model](#security-model)
9. [Funding Agent Wallets](#funding-agent-wallets)
10. [Agent Lifecycle: Close & Sweep](#agent-lifecycle-close--sweep)
11. [DISCONNECT: agent0-service.ts](#disconnect-agent0-servicets)
12. [Vault Operator Wallet](#vault-operator-wallet)
13. [ENV Variables](#env-variables)
14. [Prisma Schema](#prisma-schema)
15. [GAP Analysis](#gap-analysis)

---

## Overview

Every agent on ANOA has its **own dedicated wallet** derived from a single master seed using the BIP-32 (Hierarchical Deterministic Wallet) standard. This ensures:

- **Capital isolation**: Agent A cannot access Agent B's funds
- **Auditability**: Every transaction is clearly attributable to a specific agent
- **Scalability**: Thousands of agents, 1 master seed
- **Security**: Master seed stays on the server, never reaches the browser

```
1 MASTER SEED (BIP-39 Mnemonic)
    |
    +-- m/44'/60'/0'/0/0  --> Agent #1 wallet (0xAAA...)
    +-- m/44'/60'/0'/0/1  --> Agent #2 wallet (0xBBB...)
    +-- m/44'/60'/0'/0/2  --> Agent #3 wallet (0xCCC...)
    +-- m/44'/60'/0'/0/3  --> Agent #4 wallet (0xDDD...)
    +-- ...               --> Agent #N wallet
```

### Wallet Types in the System

| Wallet | Source | Used For |
|--------|--------|----------|
| **Agent HD Wallet** | `AGENT_MASTER_SEED` + walletIndex | Trade execution, fund sweep, profit deposits |
| **Legacy System Wallet** | `AGENT_PRIVATE_KEY` | Fallback for agents without walletIndex |
| **Vault Operator Wallet** | `VAULT_OPERATOR_PRIVATE_KEY` | Recording PnL and trading fees on-chain |

**Primary file:** `src/lib/agent-wallet.ts` (146 lines)

---

## Setup AGENT_MASTER_SEED

### How to Generate a Mnemonic

**Option 1: Via Node.js (recommended for production)**

```bash
# Install bip39 if not already installed
npm install bip39

# Generate 24-word mnemonic (256 bits entropy)
node -e "const bip39 = require('bip39'); console.log(bip39.generateMnemonic(256))"

# Example output:
# abandon ability able about above absent absorb abstract absurd abuse access accident ...
```

**Option 2: Via viem (already in project dependencies)**

```javascript
const { generateMnemonic } = require('viem/accounts');
console.log(generateMnemonic());
```

**Option 3: Via OpenSSL**

```bash
# Generate 32 bytes of randomness, convert to mnemonic manually
openssl rand -hex 32
# Then convert the hex to BIP-39 words using a standard tool
```

### Store in .env

```env
# .env (DO NOT COMMIT THIS FILE!)
AGENT_MASTER_SEED="word1 word2 word3 ... word24"
```

**IMPORTANT:**
- Use **24 words** (256 bit) for maximum security
- **12 words** (128 bit) is also supported but less secure
- DO NOT store in git; DO NOT share via chat
- Keep a backup in offline storage (cold storage / paper wallet)
- If the master seed is compromised, ALL agent wallets are exposed

---

## BIP-32 Derivation Path

```
m / 44' / 60' / 0' / 0 / {walletIndex}
|    |     |     |    |    |
|    |     |     |    |    +-- Agent index (0, 1, 2, ...)
|    |     |     |    +------- External chain (standard)
|    |     |     +------------ Account 0 (standard)
|    |     +------------------ Ethereum (coin type 60)
|    +------------------------ BIP-44 purpose
+----------------------------- Master key
```

- **Standard**: BIP-44 for Ethereum
- **Library**: `viem` -> `mnemonicToAccount(mnemonic, { addressIndex: walletIndex })`
- **Deterministic**: Same seed + same index = ALWAYS the same address
- **Collision-free**: Every index produces a unique address

---

## Flow: Agent Creation

```
+---------------------------------------------------------------------+
| User clicks "Create Agent" at /agents/create                          |
|                                                                       |
| 1. User fills form (Steps 1-3): name, strategy, risk level           |
|                                                                       |
| 2. Client sends POST /api/agents                                     |
|    { name, description, strategy, riskLevel, ... }                   |
|    NOTE: Client does NOT send walletAddr                             |
|                                                                       |
| 3. Server (api/agents/route.ts):                                     |
|    +------------------------------------------+                      |
|    | if (isHDWalletConfigured()) {            |                      |
|    |   walletIndex = generateNextIndex()      | <-- MAX(walletIndex)+1|
|    |   walletAddr = deriveAddress(index)      | <-- BIP-32 derivation |
|    | }                                        |                      |
|    +------------------------------------------+                      |
|                                                                       |
| 4. Server saves to DB:                                               |
|    agent.walletIndex = 5      (example)                              |
|    agent.walletAddr = "0xABC123..."                                  |
|                                                                       |
| 5. Server registers on-chain via agent0-sdk:                         |
|    registerAgentWithR2({ name, metadataUrl, ... })                   |
|    --> ERC-8004 Identity Registry (0x8004A169...)                    |
|    --> Returns: erc8004AgentId (token ID)                            |
|                                                                       |
| 6. Server returns to client:                                         |
|    { id, name, agentWallet: "0xABC123...", erc8004AgentId }         |
|                                                                       |
| 7. Client displays in Step 4:                                        |
|    +------------------------------------------+                      |
|    | Agent Created!                           |                      |
|    |                                          |                      |
|    | Agent Wallet: 0xABC123...  [Copy]        |                      |
|    |                                          |                      |
|    | Send MON to this address to fund         |                      |
|    | your agent's trading activities.          |                      |
|    +------------------------------------------+                      |
+---------------------------------------------------------------------+
```

---

## Flow: Agent Trade Execution

```
+---------------------------------------------------------------------+
| POST /api/trade { agentId: "abc", tokenAddress, amount, action }     |
|                                                                       |
| 1. getAgentAccountForTrade("abc")                                    |
|    +-> getAgentAccount("abc")         (agent-wallet.ts:98)           |
|        +-> Query DB: agent.walletIndex = 5                           |
|        +-> getAgentWallet(5)          (agent-wallet.ts:47)           |
|        |   +-> Check cache (walletCache Map)                         |
|        |   +-> getMnemonic()          (agent-wallet.ts:31)           |
|        |   |   +-> process.env.AGENT_MASTER_SEED                     |
|        |   +-> mnemonicToAccount(mnemonic, { addressIndex: 5 })      |
|        |   +-> Cache result                                          |
|        |   +-> Return: { account, address }                          |
|        +-> Return: HDAccount (LocalAccount)                          |
|                                                                       |
| 2. createWalletClient({ chain, transport, account })                 |
|    --> WalletClient specific to THIS agent                           |
|                                                                       |
| 3. Router selection (3-Router Architecture):                         |
|    +-> nad.fun: Lens.getAmountOut() -> Router.buy/sell()             |
|    +-> LiFi: getLiFiQuote() -> executeLiFiSwap()                     |
|    +-> Relay: getRelayQuote() -> executeRelaySwap()                  |
|                                                                       |
| 4. walletClient.sendTransaction(txData)                              |
|    --> Transaction SIGNED by this agent's HD wallet                  |
|    --> Gas paid from this agent's wallet balance                     |
|    --> NOT from AGENT_PRIVATE_KEY                                    |
|                                                                       |
| 5. Wait for receipt                                                  |
| 6. Calculate PnL (CoinGecko/CoinMarketCap price)                    |
| 7. Update metrics (totalPnl, winRate, maxDrawdown, sharpeRatio)      |
| 8. Submit reputation feedback to ERC-8004 Reputation Registry        |
| 9. Record trade memory for BM25 retrieval                            |
| 10. Distribute PnL to delegators (if any)                            |
+---------------------------------------------------------------------+
```

### EIP-2612 Permit Signing (Gas Optimization)

For sell operations on nad.fun, the agent wallet signs EIP-2612 permit signatures to avoid a separate `approve()` transaction:

```
1. account.signTypedData({
     domain: { name, version, chainId, verifyingContract },
     types: { Permit: [owner, spender, value, nonce, deadline] },
     primaryType: 'Permit',
     message: { owner: agentAddress, spender: routerAddress, ... }
   })
2. Permit signature included in sell transaction calldata
3. Saves ~50% gas compared to approve + sell (2 tx -> 1 tx)
```

---

## All Functions in agent-wallet.ts

**File:** `src/lib/agent-wallet.ts` (146 lines)

| Function | Lines | Parameters | Returns | Description |
|----------|-------|------------|---------|-------------|
| `getMnemonic()` | 31-39 | - | string | Retrieve `AGENT_MASTER_SEED` from ENV |
| `getAgentWallet(walletIndex)` | 47-63 | number | `{account, address}` | Derive wallet at specific index, cached in memory |
| `getLegacySystemAccount()` | 71-87 | - | Account | Fallback: `AGENT_PRIVATE_KEY` or index 0 from master seed |
| `getAgentAccount(agentId)` | 98-112 | string? | LocalAccount | Get wallet for agent by DB lookup of walletIndex |
| `generateNextWalletIndex()` | 118-124 | - | number | `MAX(walletIndex) + 1` from Prisma DB |
| `deriveWalletAddress(walletIndex)` | 130-132 | number | string | Preview address without creating agent |
| `isHDWalletConfigured()` | 137-139 | - | boolean | Check if `AGENT_MASTER_SEED` is available |
| `isAnyWalletConfigured()` | 144-146 | - | boolean | Check if HD or legacy wallet is available |

### Cache Mechanism (line 25):

```typescript
const walletCache = new Map<number, { account: HDAccount; address: string }>();
```

- In-memory cache per wallet index
- Prevents re-derivation (BIP-32 derivation is CPU-intensive)
- Resets on server restart
- Thread-safe (Node.js single-threaded)

### Fallback Logic in `getAgentAccount()`:

```typescript
async function getAgentAccount(agentId?: string) {
  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (agent?.walletIndex != null) {
      // Agent has HD wallet --> use it
      return getAgentWallet(agent.walletIndex).account;
    }
  }
  // Fallback: use legacy system account or index 0
  return getLegacySystemAccount();
}
```

---

## Legacy Compatibility (AGENT_PRIVATE_KEY)

### When AGENT_PRIVATE_KEY Is Used:

| Situation | Wallet Used | Notes |
|-----------|-------------|-------|
| Agent WITHOUT `walletIndex` (old) | `AGENT_PRIVATE_KEY` | Agent created before HD wallet system |
| `AGENT_MASTER_SEED` not set | `AGENT_PRIVATE_KEY` | ENV not configured for HD wallet |
| `agent0-service.ts` (registration + feedback) | `AGENT_PRIVATE_KEY` or HD wallet | HD wallet used if agent DB ID provided |

### Migration Path:

1. Old agents without `walletIndex` -> continue using `AGENT_PRIVATE_KEY`
2. New agents -> automatically get HD wallet at creation
3. Migrating old agents: set `walletIndex` manually, then transfer funds

### ENV Priority:

```
1. AGENT_MASTER_SEED (BIP-39)  --> HD wallet per-agent (RECOMMENDED)
2. AGENT_PRIVATE_KEY            --> 1 wallet shared by all (LEGACY)
3. DEPLOYER_PRIVATE_KEY         --> Last resort (only for agent0-service)
```

---

## Security Model

### Secure Aspects:

| Aspect | Status |
|--------|--------|
| Master seed server-side only | `process.env`, never reaches browser |
| Per-agent isolation | Each agent has a unique HD wallet address |
| Private keys not logged | No `console.log(key)` in codebase |
| Cache in memory only | Not persisted to disk |
| Server-side signing | Via `createWalletClient()` in API routes |
| Deterministic recovery | Same seed + index = same wallet (always recoverable) |

### Areas Requiring Attention:

| Aspect | Status | Notes |
|--------|--------|-------|
| Master seed backup | Responsibility of admin | Store in cold storage |
| Master seed rotation | No mechanism | If compromised: generate new seed + migrate funds |
| Agent key export | Not supported | By design: users fund via transfer, not key import |
| Multi-sig | Not available | All agents controlled by 1 master seed |
| Per-agent rate limiting | Not implemented | All agents can trade without per-agent rate limits |

### If AGENT_MASTER_SEED Is Compromised:

1. **IMMEDIATELY** generate a new mnemonic
2. Redeploy with the new seed
3. Transfer all funds from old wallets to new wallets
4. Update `walletAddr` in the DB for all agents
5. Reset `walletIndex` counter

---

## Funding Agent Wallets

### Before an Agent Can Trade:

Every agent wallet needs **MON for gas** and **MON for trading capital**. There are 2 methods:

### Method 1: Direct Transfer (No Vault)

```
1. Create agent at /agents/create
2. Copy the agent wallet address displayed in Step 4
3. Open your wallet (MetaMask, etc.)
4. Send MON to the agent wallet address
5. Agent now has balance for trading
```

**This is the currently working method** since the Capital Vault is not yet deployed.

### Method 2: Via Capital Vault (Not Yet Deployed)

```
1. Go to /portfolio -> Deposit
2. Select agent from dropdown
3. Input MON amount
4. Sign transaction -> MON goes to AnoaCapitalVault
5. Vault records delegation: User A -> Agent 5 -> 100 MON
```

**Vault not deployed** -- UI hooks are ready, buttons show disabled state.

### Minimum Balance Requirements:

| Token | Minimum | Purpose |
|-------|---------|---------|
| MON | ~0.1 MON | Gas fees (several transactions) |
| MON | Variable | Trading capital (depends on strategy + risk level) |

### Gas Reserve by Risk Level:

| Risk Level | Gas Reserve (MON) | Available for Trading |
|------------|-------------------|----------------------|
| LOW | 5.0 | totalCapital - 5.0 |
| MEDIUM | 3.0 | totalCapital - 3.0 |
| HIGH | 1.0 | totalCapital - 1.0 |

---

## Agent Lifecycle: Close & Sweep

### Close Agent: `POST /api/agents/[id]/close` (130 lines)

```
Close Agent Flow:
+-- 1. Verify ownership (userAddress matches agent.user.address)
+-- 2. Calculate final PnL from all Execution records
+-- 3. Update agent: status -> STOPPED, isActive -> false
+-- 4. Settle all ACTIVE delegations -> WITHDRAWN
+-- 5. Return final stats (totalPnl, totalCapital, totalTrades)
NOTE: Close does NOT transfer funds. Use sweep for that.
```

### Sweep Funds: `POST /api/agents/[id]/sweep` (236 lines)

```
Sweep Fund Flow:
+-- 1. Verify ownership (userAddress matches agent.user.address)
+-- 2. Get agent's HD wallet via getAgentAccount(agentId)
|
+-- 3. Auto-sell ALL token holdings:
|   +-- Query TokenHolding records for agent
|   +-- For each holding with balance > 0:
|       +-- Verify on-chain balance via publicClient.readContract(balanceOf)
|       +-- POST /api/trade { action: 'sell', slippageBps: 200 }
|       +-- Track success/failure per token
|
+-- 4. Transfer remaining MON to owner:
|   +-- Get balance: publicClient.getBalance(agent.walletAddr)
|   +-- Calculate: sweepAmount = balance - gasCost - safetyMargin
|   +-- walletClient.sendTransaction({
|       to: recipient || userAddress,
|       value: sweepAmount,
|       gas: 21000
|   })
|
+-- 5. Return: { amountSwept, txHash, tokensSold[] }
```

### Typical Lifecycle:

```
Create -> Fund -> Trade (auto/manual) -> Close -> Sweep -> Done
```

---

## DISCONNECT: agent0-service.ts

### Issue:

`agent0-service.ts` (241 lines) is the module for interacting with the ERC-8004 registry on-chain. It has been **partially updated** to use HD wallets:

```
+---------------------------------------------------------------+
| agent0-service.ts                                               |
|                                                                 |
| createWriteSDK(privateKey?)                                     |
|   const key = privateKey                                        |
|     || process.env.AGENT_PRIVATE_KEY    <-- DEFAULT FALLBACK    |
|     || process.env.DEPLOYER_PRIVATE_KEY                         |
|                                                                 |
| submitFeedback() -- PARTIALLY FIXED:                            |
|   if (agentDbId) {                                              |
|     account = await getAgentAccount(agentDbId)                  |
|     sdk = createWriteSDK(account.privateKey)  <-- HD wallet     |
|   } else {                                                      |
|     sdk = createWriteSDK()  <-- Falls back to AGENT_PRIVATE_KEY |
|   }                                                             |
|                                                                 |
| registerAgentWithR2() -- USES AGENT_PRIVATE_KEY:                |
|   sdk = createWriteSDK()  <-- Always AGENT_PRIVATE_KEY          |
|                                                                 |
| IMPACT:                                                         |
|   - Registration: all agents registered from same address       |
|   - Feedback: Uses HD wallet when agentDbId provided            |
|   - Trading is NOT affected (uses HD wallet correctly)          |
|                                                                 |
| SEVERITY: LOW                                                   |
|   - Feedback records the correct agentId parameter on-chain     |
|   - Only the "sender" address differs (AGENT_PRIVATE_KEY vs HD) |
|   - Trading pipeline uses HD wallet correctly                   |
+---------------------------------------------------------------+
```

### Is this blocking?

**NO** -- trading correctly uses HD wallets. The `submitFeedback()` function now uses HD wallets when agentDbId is provided. Only `registerAgentWithR2()` still uses `AGENT_PRIVATE_KEY` for all registrations. This is acceptable because registration is a one-time operation.

---

## Vault Operator Wallet

**File:** `src/lib/vault-operator.ts` (124 lines)

A separate wallet (`VAULT_OPERATOR_PRIVATE_KEY`) is used for vault administrative operations:

| Function | Wallet Used | Purpose |
|----------|-------------|---------|
| `recordPnlOnChain()` | Vault Operator | Record delegation PnL after trades |
| `depositProfitsOnChain()` | **Agent HD Wallet** | Deposit agent profits into vault |
| `recordTradingFeeOnChain()` | Vault Operator | Record trading fee for platform revenue |

```
Post-Trade Vault Integration (trade/route.ts):
+-- 1. Calculate pro-rata PnL per delegator
+-- 2. Deduct 20% performance fee (on profits only)
+-- 3. Batch update delegations (Prisma $transaction)
+-- 4. recordPnlOnChain(delegationIds, pnlAmounts) -- vault-operator.ts
+-- 5. depositProfitsOnChain(agentId, totalProfit, agentAccount) -- if profitable

Currently: vault address NULL --> on-chain calls silently skip
After deployment: set CAPITAL_VAULT + VAULT_OPERATOR_PRIVATE_KEY --> activates
```

---

## ENV Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_MASTER_SEED` | Production | - | BIP-39 mnemonic (12/24 words) |
| `AGENT_PRIVATE_KEY` | Legacy | - | Fallback for agents without walletIndex |
| `DEPLOYER_PRIVATE_KEY` | Optional | - | Last resort for agent0-service |
| `VAULT_OPERATOR_PRIVATE_KEY` | Optional | - | For vault PnL recording (post-deployment) |

### Production Validation (`config.ts`):

```typescript
const required = [
  'NEXTAUTH_URL',
  'DATABASE_URL',
  'AGENT_MASTER_SEED',  // Required in production
];
```

---

## Prisma Schema

```prisma
model Agent {
  // ... other fields ...

  // HD Wallet Derivation (per-agent wallet isolation)
  walletIndex  Int?    @unique  // BIP-32 derivation index (m/44'/60'/0'/0/{index})
  walletAddr   String?          // Agent's derived HD wallet address

  // If walletIndex = null --> legacy agent, uses AGENT_PRIVATE_KEY fallback
  // If walletIndex = N    --> derive wallet from AGENT_MASTER_SEED + index N
}
```

---

## GAP Analysis

| Issue | Status | Priority |
|-------|--------|----------|
| HD wallet per-agent for trading | WORKING | - |
| HD wallet per-agent for EIP-712 signing | WORKING | - |
| EIP-2612 permit signing (gas optimization) | WORKING | - |
| Wallet address displayed in UI (create + dashboard) | WORKING | - |
| Agent wallet balance check (on-chain) | WORKING (publicClient.getBalance) | - |
| Balance reconciliation (on-chain -> DB sync) | WORKING (drift > 0.1 MON) | - |
| Legacy `AGENT_PRIVATE_KEY` fallback | WORKING | - |
| Fund sweep on agent close | WORKING (POST /api/agents/[id]/sweep) | - |
| `submitFeedback()` uses HD wallet | WORKING (when agentDbId provided) | - |
| `registerAgentWithR2()` uses HD wallet | NOT YET (uses AGENT_PRIVATE_KEY) | LOW |
| Master seed rotation mechanism | NOT IMPLEMENTED | LOW |
| Per-agent rate limiting | NOT IMPLEMENTED | LOW |
| Wallet export/import | By design -- not supported | - |

---

## File References

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/agent-wallet.ts` | 146 | HD wallet derivation module (8 functions) |
| `src/lib/erc8004.ts` | 649 | Server-side ERC-8004 operations (18+ functions) |
| `src/lib/agent0-service.ts` | 241 | ERC-8004 via agent0-sdk (8 functions) |
| `src/lib/vault-operator.ts` | 124 | Vault operations requiring operator/agent wallet |
| `src/lib/trade-judgement.ts` | 381 | EIP-712 signing with HD wallet |
| `src/app/api/agents/route.ts` | 298 | Server-side wallet assignment at agent creation |
| `src/app/api/trade/route.ts` | 1,119 | 3-router trade execution with agent wallet |
| `src/app/api/agents/[id]/close/route.ts` | 130 | Agent close (status change, no fund transfer) |
| `src/app/api/agents/[id]/sweep/route.ts` | 236 | Fund sweep (auto-sell + MON transfer to owner) |
| `src/app/api/agents/[id]/sync/route.ts` | 142 | Balance reconciliation (on-chain -> DB) |
| `prisma/schema.prisma` | - | walletIndex + walletAddr fields |

---

*Last Updated: February 2026*
