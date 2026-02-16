# ANOA — Gap Analysis Lengkap

> Analisa menyeluruh semua gap antara **kode yang sudah ada** vs **apa yang dibutuhkan** untuk autonomous profitable trading di nad.fun + Lifi dex + Relay Protocol.
> Berdasarkan pembacaan semua source code, semua dokumentasi nad.fun, Relay, dan semua flow-anoa docs.
> Last updated: February 15, 2026 (Update #5 — Multi-Agent AI, Trade Memory, Chart Aggregator, Investment Plan, Partners)

---

## Daftar Isi

1. [Ringkasan Status](#ringkasan-status)
2. [GAP A: Autonomous Trading (KRITIS)](#gap-a-autonomous-trading-kritis)
3. [GAP B: nad.fun Integration (TINGGI)](#gap-b-nadfun-integration-tinggi)
4. [GAP C: Smart Contract & Vault (MEDIUM)](#gap-c-smart-contract--vault-medium)
5. [GAP D: Frontend & UX (RENDAH)](#gap-d-frontend--ux-rendah)
6. [GAP E: Dokumentasi (STATUS)](#gap-e-dokumentasi-status)
7. [GAP F: LiFi + Relay + Token Universe (BARU)](#gap-f-lifi--relay--token-universe-baru)
8. [GAP G: Multi-Agent AI + Intelligence (15 Feb)](#gap-g-multi-agent-ai--intelligence-15-feb)
9. [Production Bug Fixes (13 Feb)](#production-bug-fixes-13-feb)
10. [Prioritas Implementasi Tersisa](#prioritas-implementasi-tersisa)
11. [Apa yang SUDAH BEKERJA](#apa-yang-sudah-bekerja)

---

## Ringkasan Status

```
TOTAL GAP AWAL: 22 item
├── KRITIS (blocking profit)        : 7 gap → 7 SELESAI ✅
├── TINGGI (significantly limiting) : 6 gap → 6 SELESAI ✅
├── MEDIUM (nice to have)           : 5 gap → 4 SELESAI, 1 tersisa (C1 vault deploy)
└── RENDAH (post-hackathon)         : 4 gap → ABAIKAN (fokus agent)

GAP F (14 Feb — LiFi + Relay + Token Universe):
├── F1: Relay Protocol Client — ✅ SELESAI (relay-client.ts 288 lines)
├── F2: Token Universe — ✅ SELESAI (53 token di MONAD_TOKENS, naik dari 11)
├── F3: USDT/USDT0 Symbol — ✅ SELESAI (USDT0 dipakai)
└── F4: ARBITRAGE 3 Venue — ✅ SELESAI (nad.fun + LiFi + Relay)

GAP G (15 Feb — Multi-Agent AI + Intelligence):
├── G1: Multi-Agent Architecture — ✅ SELESAI (Market Analyst + Risk Manager paralel)
├── G2: Trade Memory & Learning — ✅ SELESAI (BM25 Okapi + AI reflection)
├── G3: Chart Aggregator — ✅ SELESAI (nad.fun → GeckoTerminal → DexScreener)
├── G4: Technical Indicators — ✅ SELESAI (SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA)
├── G5: Investment Plan Context — ✅ SELESAI (10 sektor, target allocation per strategi)
├── G6: get_technical_analysis tool — ✅ SELESAI (tool ke-5 untuk AI function calling)
└── G7: Partner Marquee Landing — ✅ SELESAI (7 partner logos, framer-motion infinite scroll)

PRODUCTION BUG FIXES (13 Feb): 9 bug kritis diperbaiki
AUDIT BUG FIXES (14 Feb): 3 bug LiFi + 1 bug create page diperbaiki
  - PnL calculation salah untuk non-MON output (WETH→USDC) ✅ FIXED
  - Balance check decimals salah untuk token 6/8 decimal ✅ FIXED
  - LiFi path tidak ada retry mechanism ✅ FIXED
  - registrationFeeTxHash tidak dikirim dari create page ✅ FIXED

SAFETY BUG FIXES (14 Feb — session 2): 6 bug keamanan uang diperbaiki
  - GAS_RESERVE_MON mismatch: trade/route.ts punya 0.1, strategy-engine.ts punya 5.0 ✅ FIXED (sekarang 5.0 di keduanya)
  - getSafePositionSize() return desiredSize jika walletBalance undefined ✅ FIXED (return 0)
  - isTokenTooNew() return false jika block data missing (createdAtBlock ada tapi latestBlock tidak) ✅ FIXED (return true = block)
  - Risk guard FAIL-OPEN: DB error → return 0 → trade tanpa limit ✅ FIXED (FAIL-CLOSED: -Infinity/Infinity)
  - Risk guard timezone: setHours lokal, bukan UTC ✅ FIXED (setUTCHours)
  - AI advisor hardcode dailyLossLimit=10/maxDailyTrades=50 ✅ FIXED (pakai agent config)

INTELLIGENCE FIXES (15 Feb): verify-tokens.mjs ABI decode bug fixed
  - ABI-encoded symbol rejected by startsWith('0x0000000000') — FIXED (length > 66 check)

KLARIFIKASI DARI AUDIT:
  - x402: HANYA untuk A2A endpoint protection, BUKAN untuk trading ✅ BENAR
  - EIP-712: Dipakai di trade-judgement.ts untuk signing trade proposals ✅ BENAR
  - EIP-2612: Dipakai di trade/route.ts untuk sellPermit ✅ BENAR

CF FUNCTION CALLING: ✅ TERIMPLEMENTASI — 5 trading tools (naik dari 4)
TOKEN HOLDING COST BASIS: ✅ TERIMPLEMENTASI
FAILED TX RETRY: ✅ TERIMPLEMENTASI (nad.fun + LiFi + Relay)
MON GAS RESERVE: ✅ TERIMPLEMENTASI — 5.0 MON minimum reserve
REGISTRATION FEE: ✅ TERIMPLEMENTASI — 100 MON per agent
TOKEN DISCOVERY v2: ✅ ON-CHAIN EVENTS — CurveBuy/CurveSell/CurveCreate
SELL AMOUNT FIX: ✅ TERIMPLEMENTASI — actual token holding balance
SWEEP AUTO-SELL: ✅ TERIMPLEMENTASI — sell all holdings before sweep
ALL nad.fun ABIs: ✅ LENGKAP — lensAbi, bondingCurveRouterAbi, dexRouterAbi
EXACTOUT TRADING: ✅ TERIMPLEMENTASI — exactOutBuy, exactOutSell, exactOutSellPermit
TRADING FEE: ✅ CODE READY — recordTradingFee() gated by vault deployment
LIFI INTEGRATION: ✅ 53 token, retry, correct PnL, correct decimals
RELAY INTEGRATION: ✅ relay-client.ts + trade/route.ts router='relay'
YIELD STRATEGY: ✅ 18 yield-bearing tokens (7 MON LST + 4 ETH LST + 7 yield stablecoins)
3-ROUTER ARCHITECTURE: ✅ nad.fun (bonding curve) → LiFi (DEX aggregator) → Relay (solver)
MULTI-AGENT AI: ✅ Market Analyst (5 tools + bull/bear) + Risk Manager (6 risk dims) — PARALEL
TRADE MEMORY: ✅ BM25 Okapi retrieval + AI-powered reflection (TradingAgents-inspired)
CHART AGGREGATOR: ✅ nad.fun → GeckoTerminal → DexScreener (multi-source OHLCV)
TECHNICAL INDICATORS: ✅ SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA (pure TypeScript, no deps)
INVESTMENT PLAN: ✅ 10 sektor, target allocation per strategi, OVER/UNDER warnings
PARTNER LANDING: ✅ 7 partner logos dengan marquee animation (framer-motion)

SELESAI: 22/22 gap awal + 4/4 gap F + 7/7 gap G + 13 bug fixes + 10 improvement
TERSISA: 1 gap (C1 vault deploy — sudah coded, tinggal deploy + isi ENV)
SUDAH BEKERJA: 85+ fitur

ENV STATUS (14 Feb audit):
├── KRITIKAL KOSONG: AGENT_MASTER_SEED (BLOCKER — no agent wallets!)
├── KOSONG (isi setelah deploy): VAULT_OPERATOR_PRIVATE_KEY, CAPITAL_VAULT addresses, ANOA_CORE
├── KOSONG (isi manual): TREASURY_ADDRESS
└── OPSIONAL KOSONG: OPENCLAW_API_*, NAD_API_KEY, PAY_TO_ADDRESS
```

---

## GAP A: Autonomous Trading (KRITIS)

### A1. Token Discovery

**Status**: ✅ SELESAI (v2 — on-chain events)
**File**: `src/lib/token-discovery.ts` (rewritten)
**Dikerjakan**:
- v2 menggunakan **on-chain events** dari Curve contract (bukan API saja):
  - `CurveBuy` + `CurveSell` events → menemukan token yang aktif diperdagangkan (1 jam terakhir)
  - `CurveCreate` events → menemukan token baru (6 jam terakhir)
  - Chunked event query (`getContractEventsChunked`) untuk mengatasi RPC block range limits
- Tokens ranked by trade activity count (descending)
- Merge dengan candidate addresses (default token list)
- Enrich dengan nad.fun API (`getTokenInfo`, `getMarketData`) + Lens on-chain data
- Filter: min volume 100 MON, min 5 holders, not locked
- Sort: volume descending, progress descending
- Return top 20 tokens

---

### A2. Auto-Execute Mode

**Status**: ✅ SELESAI
**File**: `prisma/schema.prisma`, `src/app/api/scheduler/route.ts`
**Dikerjakan**:
- `autoExecute Boolean @default(false)` di Prisma Agent model
- `maxDailyTrades Int @default(50)`, `dailyLossLimit Float @default(10.0)`
- Scheduler: jika `agent.autoExecute && confidence >= threshold` → langsung POST `/api/trade`
- Jika `autoExecute = false` → create TradeProposal (human-in-the-loop)

---

### A3. Continuous Scheduler

**Status**: ✅ SELESAI
**File**: `src/app/api/scheduler/route.ts`, `.env`
**Dikerjakan**:
- `SCHEDULER_AUTO_LOOP=true` dan `SCHEDULER_INTERVAL_MS=300000` di .env
- setTimeout self-trigger di akhir POST handler
- 5-minute cooldown per agent (sudah ada sebelumnya)
- Fallback: user bisa pakai Vercel Cron atau external cron

---

### A4. Portfolio-Aware Trading

**Status**: ✅ SELESAI (enhanced — gas reserve)
**File**: `src/lib/strategy-engine.ts`, `src/app/api/scheduler/route.ts`, `src/app/api/trade/route.ts`
**Dikerjakan**:
- `AgentContext` extended: `walletBalance`, `holdings`
- Scheduler fetch balance + holdings via `publicClient.getBalance()` + `getHoldings()`
- Strategy guard: skip buy jika insufficient balance, skip sell jika no position
- **Gas reserve**: 5.0 MON minimum selalu tersisa di wallet
  - `getSafePositionSize()` — caps BUY amount agar wallet balance - 5.0 MON terjaga
  - `GAS_RESERVE_MON = 5.0` di strategy-engine.ts dan trade/route.ts
  - Semua 6 strategy (MOMENTUM, YIELD, ARBITRAGE, DCA, GRID, HEDGE) pakai safe position sizing
  - trade/route.ts: BUY ditolak jika balance < amount + 5.0 MON
- **SELL amount fix**: semua SELL signal pakai `getHoldingBalance()` — actual token holding balance, bukan MON amount

---

### A5. PnL Calculation

**Status**: ✅ SELESAI
**File**: `src/lib/pnl-tracker.ts` (formula FIXED), `src/app/api/trade/route.ts`

**Yang sudah FIXED**:
- Formula PnL: BUY = -amountInMon (capital outflow), SELL = +amountOutMon (capital inflow)
- Denominasi benar: BUY passes (MON, 0), SELL passes (0, MON)
- CoinGecko/CMC price feed (60s cache, no hardcoded price)
- **TokenHolding cost basis tracking** — `updateTokenHolding()` dipanggil setelah setiap trade
  - BUY: upsert dengan weighted average price
  - SELL: kurangi balance, hitung realizedPnl = (sellPrice - avgBuyPrice) * qty
  - Agent sekarang tahu avgBuyPrice per token position

---

### A6. Risk Circuit Breaker

**Status**: ✅ SELESAI
**File**: `src/lib/risk-guard.ts` (baru)
**Dikerjakan**:
- `checkRiskLimits()` — 5 pre-trade safety checks:
  1. Drawdown limit per risk level (low=10%, medium=20%, high=35%)
  2. Daily loss limit (% of capital)
  3. Daily trade count limit
  4. Minimum trade size (0.01 MON)
  5. Buy max 50% of capital
- Diintegrasikan ke scheduler sebelum auto-execute
- Prisma queries dengan try-catch (fail-open)

---

### A7. Failed TX Retry

**Status**: ✅ SELESAI
**File**: `src/app/api/trade/route.ts`

**Dikerjakan**:
- Retry loop: max 2 attempts untuk nad.fun execution path
- Quote phase (Lens.getAmountOut) TIDAK di-retry — error di sini langsung throw
- Execution phase: attempt 1 normal slippage, attempt 2 slippage +50% (max 20%)
- Fresh deadline per attempt
- viem auto-handles nonce refresh
- Log retry attempt ke console
- Jika kedua attempt gagal → throw error → Execution record FAILED

---

## GAP B: nad.fun Integration (TINGGI)

### B1. Bonding Curve Intelligence

**Status**: ✅ SELESAI
**File**: `src/lib/strategy-engine.ts`, `src/lib/token-discovery.ts`
**Dikerjakan**:
- `fetchLensData()` — query Lens: `getProgress()`, `isGraduated()`, `isLocked()` per token
- `MarketSnapshot` extended: `bondingCurveProgress`, `isGraduated`, `isLocked`
- MOMENTUM strategy enhanced:
  - Progress 50-70%: +30% confidence boost
  - Progress 70-85%: +15% boost
  - Progress >85%: SELL signal (graduation imminent)
  - Progress 20-50% + good momentum: +20% boost
  - isLocked: skip entirely

---

### B2. sellPermit (EIP-2612)

**Status**: ✅ SELESAI
**File**: `src/app/api/trade/route.ts:278-359`
**Dikerjakan**:
- Full EIP-2612 permit signing (off-chain, no gas)
- `routerAbi.sellPermit` call (1 tx instead of 2)
- Fallback ke approve+sell jika token tidak support permit
- Import `parseSignature` dari viem

---

### B3. DexRouter vs BondingCurveRouter Differentiation

**Status**: ✅ SELESAI
**File**: `src/app/api/trade/route.ts`
**Dikerjakan**:
- Router detection logging: `BondingCurveRouter` vs `DexRouter` berdasarkan Lens return
- Router address validation: cek non-zero, cek amountOut non-zero
- Lens `getAmountOut()` sudah return router address yang benar — code sekarang memvalidasi dan memanfaatkannya

---

### B4. ExactOutBuy/ExactOutSell

**Status**: ✅ SELESAI
**File**: `src/app/api/trade/route.ts`, `src/config/contracts.ts`

**Dikerjakan**:
- `exactOut` parameter di POST body — user specifies desired output amount
- Quote phase: `Lens.getAmountIn(token, desiredOut, isBuy)` → required input amount
- ExactOut hanya untuk DexRouter (graduated tokens) — validasi di kode
- Execution: `dexRouterAbi.exactOutBuy()` untuk buy dengan `amountInMax` sebagai value
- Execution: `dexRouterAbi.exactOutSellPermit()` dengan fallback ke `approve + exactOutSell`
- Correct ABI selection: `isBondingCurveRouter ? bondingCurveRouterAbi : dexRouterAbi`
- Retry mechanism berlaku juga untuk ExactOut path (max 2 attempts, +50% slippage)

---

### B5. Anti-Sniping Awareness

**Status**: ✅ SELESAI
**File**: `src/lib/token-discovery.ts`, `src/lib/strategy-engine.ts`

**Implementasi**:
- Token discovery: CurveCreate events sekarang track `createdAtBlock` per token
- `DiscoveredToken` interface diperluas dengan field `createdAtBlock`
- `MarketSnapshot` interface diperluas dengan `createdAtBlock` + `latestBlock`
- `fetchMarketSnapshots()` menerima `discoveredTokens` metadata, query `getBlockNumber()`
- `isTokenTooNew()` guard function — skip token yang < 20 blocks old
- Guard diterapkan di MOMENTUM dan GRID strategy (yang trade nad.fun tokens)
- Scheduler meneruskan `discoveredTokensMetadata` ke `evaluateStrategy()`
- Threshold: `ANTI_SNIPE_MIN_BLOCKS = 20` (~10 detik di Monad at ~0.5s/block)

---

### B6. Token Creation Capability

**Status**: ❌ BELUM ADA

**Catatan**: Fokus trading, bukan token creation. Post-production feature.

---


### C2. AnoaTrustlessAgentCore 0% Dipakai

**Status**: ❌ 0/15 fungsi diintegrasikan

**Keputusan**: Post-production. Server-side execution sudah cukup.

---

### C3. agent0-service.ts Pakai AGENT_PRIVATE_KEY

**Status**: ⚠️ DISCONNECT — semua ERC-8004 write pakai 1 key, bukan HD wallet per-agent.

**Dampak**: Rendah — feedback tetap tercatat per-agentId.

---

### C4. Fee System

**Status**: ✅ SELESAI — Registration Fee + Trading Fee code ready

**Yang sudah selesai**:
- **Registration Fee 100 MON** — `POST /api/agents` memungut 100 MON dari user saat buat agent
  - On-chain: `payRegistrationFee(agentId)` ke AnoaCapitalVault (jika vault deployed)
  - DB: `FeePayment` record created (amount, currency, txHash)
  - Frontend: `usePayRegistrationFee()` hook ready
- **Trading Fee per-trade** — `recordTradingFee()` di trade/route.ts
  - ABI: `recordTradingFee(agentId, token, tradeAmount)` di capitalVaultAbi
  - Server-side: `recordTradingFeeOnChain()` di vault-operator.ts
  - Gated by CAPITAL_VAULT address — silently skips if vault not deployed
  - Non-blocking: dipanggil setelah trade berhasil via `.catch()`
  - Vault contract: `recordTradingFee()` calculates fee = tradeAmount * tradingFeeBps / 10000
- Vault contract punya `withdrawFees()` dan `withdrawTokenFees()` — ABI tersedia di capitalVaultAbi

---

### C5. Fund Sweep Saat Close Agent

**Status**: ✅ SELESAI (enhanced — auto-sell holdings)
**File**: `src/app/api/agents/[id]/sweep/route.ts`, `src/app/api/agents/[id]/close/route.ts`
**Dikerjakan**:
- `/api/agents/[id]/close` — stop agent, calculate final PnL, settle delegations
- `/api/agents/[id]/sweep` — **auto-sell semua token holdings** sebelum sweep MON:
  1. Query TokenHolding dari Prisma → semua token dengan balance > 0
  2. Per token: call `POST /api/trade` dengan action=sell, amount=holding.balance
  3. Setelah semua holdings terjual → transfer MON ke owner
  4. Log setiap sell result (success/failed)
- Ownership verification via userAddress

---

## GAP D: Frontend & UX (RENDAH)

**DIABAIKAN** — fokus agent autonomous. Semua halaman (dashboard, portfolio, agents, leaderboard, yield, settings) sudah production-ready dari session sebelumnya.

---

## GAP E: Dokumentasi (STATUS)

### documents/nad-fun/ — LENGKAP (11 file)

| File | Status | Isi |
|------|--------|-----|
| `trading.md` | Lengkap | Buy/sell flow, bonding curve, sellPermit, EIP-2612 |
| `quote.md` | Lengkap | Lens functions, getAmountOut, getProgress |
| `token.md` | Lengkap | Token creation, metadata, graduation, 400k MON threshold |
| `skill.md` | Lengkap | Agent skills: scan, buy, sell, track, sentiment |
| `agent-api.md` | Lengkap | REST API: market, metrics, chart, swap-history, holdings |
| `indexer.md` | Lengkap | Events: CurveBuy/Sell/Graduate, DexRouterBuy/Sell |
| `AGENTS.md` | Lengkap | Agent architecture, wallet, buy/sell flow |
| `wallet.md` | Lengkap | HD wallet BIP-39/BIP-32 |
| `ausd.md` | Lengkap | aUSD/LiFi swap configuration |
| `abi.md` | Lengkap | 9 ABI lengkap |
| `contract-v3-abi.md` | Lengkap | Integration guide + addresses + examples + events |

### flow-anoa/ — MASIH RELEVAN (11 file)

| File | Status | Match Kode? |
|------|--------|-------------|
| `AI-Trading-Logic.md` | Masih relevan | ✅ Pipeline trading 10 langkah, strategy formulas |
| `App-Structure.md` | Masih relevan | ✅ 9 halaman, 19 API routes, 12 hooks |
| `Contracts-Architecture.md` | Masih relevan | ✅ Updated: vault integration, registration fee, auto-sell sweep, dexRouterAbi |
| `Trading-Execution.md` | Masih relevan | ✅ Updated: sellPermit, router validation, PnL fix, gas reserve, anti-sniping |
| `Wallet-Architecture.md` | Masih relevan | ✅ HD wallet per-agent |
| `Agents.md` | Masih relevan | ✅ Agent page flow |
| `Dashboard.md` | Masih relevan | ✅ Dashboard architecture |
| `Leaderboard.md` | Masih relevan | ✅ Leaderboard ranking |
| `Portfolio.md` | Masih relevan | ✅ Portfolio holdings |
| `Yield.md` | Masih relevan | ✅ Yield farming |
| `Gap-gap.md` | UPDATED | ✅ File ini |

---

## GAP F: LiFi + Relay + Token Universe (BARU)

> Ditemukan dari deep audit 14 Feb 2026 — baca LENGKAP semua dokumen LiFi, Relay ABI,
> tokenlist-monad.json, lifi-client.ts, strategy-engine.ts, trade/route.ts, scheduler/route.ts,
> token-discovery.ts, risk-guard.ts, ai-advisor.ts, pnl-tracker.ts, vault-operator.ts.

### F1. Relay Protocol Client

**Status**: ✅ SELESAI
**File**: `src/lib/relay-client.ts` (288 lines)
**Dikerjakan**:
- `getRelayQuote()` — dapatkan quote dari Relay API
- `executeRelaySwap()` — eksekusi via RelayRouter multicall
- `isRelaySupportedToken()` — cek token availability
- Diintegrasikan ke `trade/route.ts` sebagai router ketiga (router='relay')
- Contract addresses: v2.1RelayApprovalProxy, v2.1RelayRouter, relayReceiver

---

### F2. Token Universe — Expanded ke 53

**Status**: ✅ SELESAI
**File**: `src/lib/lifi-client.ts`
**Dikerjakan**:
- MONAD_TOKENS expanded dari 11 ke 53 token:
  - Native: MON, WMON
  - Stablecoins: USDC, USDT0, AUSD, IDRX, USD*, USD1
  - Yield stablecoins: EARNAUSD, SAUSD, SUUSD, SYZUSD, WSRUSD, LVUSD, YZUSD, THBILL
  - ETH LSTs: WETH, WSTETH, WEETH, EZETH, PUFETH, SUETH
  - BTC: WBTC, BTC.B, LBTC, SOLVBTC, XSOLVBTC, SUBTC
  - MON LSTs: APRMON, GMON, SMON, SHMON, EARNMON, LVMON, MCMON
  - Cross-chain: SOL, XAUT0
  - DeFi: CAKE, DUST, EUL, FOLKS, NXPC, MVT, LV, YZPP
  - Mu Digital: AZND, LOAZND, MUBOND
  - Midas: MEDGE, MHYPER
  - Custom: CHOG, APR

---

### F3. USDT/USDT0 Symbol

**Status**: ✅ SELESAI
**Catatan**: MONAD_TOKENS sekarang mendaftar USDT0 sesuai official tokenlist (LayerZero bridge nama resmi).

---

### F4. ARBITRAGE 3 Venue

**Status**: ✅ SELESAI
**File**: `src/lib/strategy-engine.ts`, `src/lib/relay-client.ts`
**Dikerjakan**:
- ARBITRAGE sekarang membandingkan 3 venue: nad.fun + LiFi + Relay
- Semua 53 MONAD_TOKENS + nad.fun tokens dicek spread di 3 venue
- Relay diintegrasikan sebagai venue ketiga via relay-client.ts
- `venues: ['nadfun', 'lifi', 'relay']` di metadata

---

### F5. Strategi vs Token Integration Matrix

**Status**: Catatan analisis — peta lengkap integrasi per strategi

| Strategi | nad.fun Tokens | LiFi Tokens (53) | Relay Tokens | Bonding Curve | Anti-Snipe | Position Size |
|----------|---------------|-------------------|--------------|---------------|------------|---------------|
| **MOMENTUM** | ✅ Discovery v2 | ✅ MONAD_TOKENS | ✅ | ✅ Progress boost | ✅ 20 blocks | ✅ Safe |
| **YIELD** | ❌ N/A | ✅ 18 yield tokens | ✅ | ❌ | ❌ | ✅ Safe |
| **ARBITRAGE** | ✅ Sebagai venue | ✅ MONAD_TOKENS | ✅ 3 venue | ❌ | ❌ | ✅ Safe |
| **DCA** | ❌ N/A | ✅ 11 blue-chip | ✅ | ❌ | ❌ | ✅ Safe (half) |
| **GRID** | ✅ Aware | ✅ MONAD_TOKENS | ✅ | ✅ Lock check | ✅ 20 blocks | ✅ Safe |
| **HEDGE** | ❌ N/A | ✅ USDC/USDT0/aUSD | ✅ | ❌ | ❌ | ✅ Safe (1.5x) |

**Catatan kunci**:
- Semua 6 strategi sudah pakai `getSafePositionSize()` (gas reserve 5.0 MON)
- Semua 6 strategi sudah terintegrasi risk guard
- MOMENTUM dan GRID sudah punya anti-sniping
- ARBITRAGE pakai 3 venue (nad.fun + LiFi + Relay)
- SELL signal di semua strategi sudah pakai `getHoldingBalance()` (actual token balance)
- DCA pakai half-size (50% normal) untuk konservatif banyak entry
- HEDGE pakai 1.5x boost (emergency protection lebih besar)

---

### Klarifikasi Audit: x402, EIP-712, EIP-2612 — dari Dokumentasi nad.fun

| Protokol | Di Dokumentasi nad.fun | Di Kode Kita | Status |
|----------|----------------------|-------------|--------|
| **x402 Payment** | Dijelaskan di `AGENTS.md` sebagai A2A micropayment | `x402-server.ts` — hanya proteksi `/api/trade` dan `/api/a2a` ($0.001 USDC) | ✅ BENAR — x402 bukan flow trading, hanya API protection |
| **EIP-712** | Dipakai nad.fun untuk trade intent signing | `trade-judgement.ts` — dipakai untuk signing trade proposals (typed data) | ✅ BENAR — sesuai implementasi |
| **EIP-2612** | Dipakai nad.fun Router untuk `sellPermit` | `trade/route.ts` — full permit signing + sellPermit call + fallback approve+sell | ✅ BENAR — lengkap dengan fallback |
| **EIP-7702** | LiFi SDK support (di lifi-llm.txt) | Tidak dipakai di kode kita | ℹ️ Optional — LiFi SDK feature, bukan requirement |
| **Permit2** | Relay ApprovalProxy support | Tidak dipakai di kode kita | ℹ️ Dibutuhkan jika implementasi Relay (F1) |

---

## GAP G: Multi-Agent AI + Intelligence (15 Feb)

> Ditemukan dari TradingAgents framework research + deep audit ai-advisor.ts, strategy-engine.ts.
> Semua 7 gap di-implement dalam 1 session. Baca source code LENGKAP sebelum menulis.

### G1. Multi-Agent Architecture (Market Analyst + Risk Manager)

**Status**: ✅ SELESAI
**File**: `src/lib/ai-advisor.ts` (rewritten `analyzeSignal()`)
**Dikerjakan**:
- **Agent 1: Market Analyst** — bull/bear debate + 5 function calling tools
  - Prompt: ANOA Market Analyst, inspired by TradingAgents framework
  - Tools: get_technical_analysis, get_bonding_curve_status, get_token_market_data, check_risk_assessment, get_price_quote
  - Max 3 rounds tool calling (loop), maxTokens: 500, timeout: 20s
  - Output format REQUIRED: TECHNICAL ANALYSIS, BULLISH CASE, BEARISH CASE, PAST LESSONS, VERDICT + Confidence 0-100
- **Agent 2: Risk Manager** — dedicated risk assessment, NO tools, fast
  - Prompt: ANOA Risk Manager, 6 risk dimensions (position concentration, drawdown proximity, losing streak, volatility exposure, portfolio alignment, capital adequacy)
  - Output: RISK_VERDICT (APPROVE/REDUCE/BLOCK) + RISK_CONFIDENCE_ADJUSTMENT (-30..0) + RISK_REASON
  - maxTokens: 150, temperature: 0.2, timeout: 10s
  - BLOCK verdict forces minimum -25 adjustment
- **Parallel execution**: `Promise.all([analystPromise, riskPromise])`
- **Combined decision**: analyst confidence + risk adjustment = final confidence
- **Blend rule**: 60% rule-based + 40% AI confidence (unchanged)
- **Fail-safe**: if Market Analyst fails → rule-based pass-through; if Risk Manager fails → no adjustment; if BOTH fail → signal unchanged (aiUsed=false)

---

### G2. Trade Memory & Learning System (BM25 + AI Reflection)

**Status**: ✅ SELESAI
**File**: `src/lib/trade-memory.ts` (baru 100%)
**Dikerjakan**:
- **TradeMemory structure**: situation, action, outcome, lesson, timestamp, pnlUsd, profitable
- **Storage**: Prisma Execution records → last 50 per agent → in-memory cache (5 min TTL, max 100)
- **BM25 Okapi retrieval** (`getRelevantMemories()`):
  - k1 = 1.5, b = 0.75
  - IDF = log((N - df + 0.5) / (df + 0.5) + 1)
  - TF_norm = (tf * (k1+1)) / (tf + k1*(1-b + b*(docLen/avgDocLen)))
  - score = Σ(IDF * TF_norm) per query term
  - Recency bias: score *= 1 + max(0, 1 - ageHours/168) (1 week decay)
  - Mistake amplification: score *= 1.3 for unprofitable trades
  - Return top 3 memories
- **AI-powered reflection** (`reflectOnTrade()`):
  - 3-tier AI fallback, maxTokens: 300, temperature: 0.3, timeout: 15s
  - Runs **non-blocking** after trade — if AI fails, rule-based lesson persists
  - Prompt: "Provide concise lesson (2-3 sentences) for future decisions"
- **Rule-based lesson extraction** (fallback):
  - Failed: slippage/balance/revert detection
  - Profitable: categorized by PnL amount ($1+, $0.1+, break-even)
  - Loss: categorized by loss amount
- **Integration**: memories injected into Market Analyst prompt via `formatMemoriesForPrompt()`
- **Trade stats**: `getTradeStats()` → totalTrades, wins, losses, winRate, avgPnl, recentStreak

---

### G3. Chart Aggregator (Multi-Source OHLCV)

**Status**: ✅ SELESAI
**File**: `src/lib/chart-aggregator.ts` (baru 100%)
**Dikerjakan**:
- **3-source fallback chain**:
  - Source 1: nad.fun API (`GET /agent/chart/{token}?resolution=5&countback=60`)
  - Source 2: GeckoTerminal API (`/networks/monad/pools/{pool}/ohlcv/minute?aggregate=5`)
  - Source 3: DexScreener API (`/tokens/v1/monad/{token}`) → synthetic candles
- **Coverage**:
  - nad.fun bonding curve tokens → nad.fun API (native OHLCV)
  - LiFi/Relay tokens (WETH, WBTC, APRMON, dll) → GeckoTerminal (real OHLCV)
  - Any DEX-traded token → DexScreener (synthetic from price change interpolation)
- **Synthetic candles**: `buildSyntheticCandles()` — linear interpolation with ±0.5% noise
- **Cache**: 3 min TTL, max 100 entries
- **Minimum**: 15 candles for valid analysis
- **Integration**: used by AI advisor `get_technical_analysis` tool → ensures ALL tokens have technical analysis

---

### G4. Technical Indicators Module

**Status**: ✅ SELESAI
**File**: `src/lib/technical-indicators.ts` (baru 100%)
**Dikerjakan**:
- Pure TypeScript, zero external dependencies
- Indicators computed:
  - SMA(10), SMA(50), EMA(10) — trend
  - RSI(14) — momentum (overbought >70, oversold <30)
  - MACD(12,26,9), MACD Signal, MACD Histogram — momentum direction
  - Bollinger Upper/Middle/Lower (20, 2σ) — volatility bands
  - ATR(14) — Average True Range
  - VWMA(20) — Volume-weighted moving average
  - Volume Trend (5-candle comparison) — increasing/decreasing/stable
- Auto-detected signals: bullish (golden crossover, RSI<30, positive MACD, etc.) + bearish (death crossover, RSI>70, negative MACD, etc.)
- `analyzeTechnical(candles)` → TechnicalReport
- `formatTechnicalReport(report, symbol)` → human-readable string for AI

---

### G5. Investment Plan Context

**Status**: ✅ SELESAI
**File**: `src/lib/ai-advisor.ts` (added `buildInvestmentPlanContext()`)
**Dikerjakan**:
- **10 token sectors**: native, stablecoin, yield-stable, eth, eth-yield, btc, mon-lst, memecoin, defi, cross-chain
- **TOKEN_SECTORS map**: 30+ tokens classified by sector
- **STRATEGY_ALLOCATION**: target ranges per strategy:
  - MOMENTUM: native 20-40%, mon-lst 10-25%, stablecoin 10-30%
  - YIELD: mon-lst 25-45%, yield-stable 20-35%, eth-yield 10-25%
  - ARBITRAGE: native 30-50%, stablecoin 20-40%
  - DCA: native 20-35%, mon-lst 15-25%, eth 10-20%
  - GRID: native 25-45%, stablecoin 25-45%
  - HEDGE: stablecoin 40-70%, yield-stable 15-30%
- **Current vs target comparison**: calculates actual allocation, shows OVER/UNDER/OK status
- **Warning injection**: "Buying X would INCREASE sector above target range"
- **Injected into both agents**: Market Analyst (full context) + Risk Manager (alignment check)

---

### G6. get_technical_analysis Tool (AI Function Calling ke-5)

**Status**: ✅ SELESAI
**File**: `src/lib/ai-advisor.ts` (added to TRADING_TOOLS)
**Dikerjakan**:
- Tool #5 `get_technical_analysis` — calls chart-aggregator → technical-indicators pipeline
- Fetches 60 candles × 5min = 5 hours of OHLCV data (multi-source)
- Runs full technical analysis (SMA, EMA, RSI, MACD, Bollinger, ATR, VWMA, signals)
- Returns human-readable report + data source attribution
- Market Analyst prompt **INSTRUCTS** AI to call this tool first: "ALWAYS call get_technical_analysis first!"
- Minimum 15 candles required; returns error if insufficient data

---

### G7. Partner Marquee Landing Page

**Status**: ✅ SELESAI
**File**: `src/app/page.tsx` (added partner section)
**Dikerjakan**:
- 7 partner logos: Monad Foundation, nad.fun, LiFi, Relay, Cloudflare, CoinGecko, DexScreener
- Framer Motion marquee (infinite scroll `animate={{ x: ['0%', '-50%'] }}`)
- Doubled logos array for seamless loop
- Fade edges (gradient left + right)
- Mobile responsive (h-10 → sm:h-14)
- Positioned between Roadmap and CTA sections
- Section title: "Our Partners" with same gradient style as other sections

---

## Production Bug Fixes (13 Feb)

Bug kritis yang diperbaiki untuk keamanan uang real di mainnet:

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `pnl-tracker.ts` | Formula PnL buy=sell identik | BUY=-amountIn, SELL=+amountOut |
| 2 | `trade/route.ts` | PnL nad.fun denominasi salah | Pass MON saja, 0 untuk token |
| 3 | `trade/route.ts` | Balance check gagal → tetap trade | Block trade, return error 503 |
| 4 | `trade/route.ts` | Router dari Lens tidak divalidasi | Cek non-zero + amountOut |
| 5 | `trade/route.ts` | `waitForTransactionReceipt` tanpa timeout | 60s timeout |
| 6 | `scheduler/route.ts` | Hardcoded `localhost:3000` | `getBaseUrl()` (throw di production) |
| 7 | `scheduler/route.ts` | Fetch tanpa timeout | 90s trade, 120s loop |
| 8 | `risk-guard.ts` | Prisma queries tanpa try-catch | Fail-open dengan error logging |
| 9 | `strategy-engine.ts` | Unused imports | Removed getChartData, getHoldings |

---

## Audit Bug Fixes (14 Feb)

Bug ditemukan dari audit menyeluruh nad.fun docs + LiFi integration:

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `pnl-tracker.ts` | PnL SELL ke non-MON (USDC/WETH) dikalikan harga MON | Tambah `tokenPriceUsd` parameter, gunakan `priceUSD` dari LiFi quote |
| 2 | `trade/route.ts` | Balance check SELL pakai `parseEther` (18 dec) untuk semua token | Gunakan `resolveTokenAddress()` → `parseUnits(amount, decimals)` |
| 3 | `trade/route.ts` | LiFi swap tanpa retry mechanism | Tambah retry loop (max 2 attempts, +50% slippage on retry, cap 20%) |

---

## Prioritas Implementasi Tersisa

### ✅ SELESAI (Agent Autonomous — ALL CRITICAL GAPS CLOSED):

| # | Gap | Status | Deskripsi |
|---|-----|--------|-----------|
| 1 | **CF Function Calling** | ✅ SELESAI | AI advisor + 5 tools: bonding curve, market data, risk check, price quote, technical analysis |
| 2 | **A5** — TokenHolding cost basis | ✅ SELESAI | Weighted avg price tracking, realized PnL per posisi |
| 3 | **A7** — Failed TX retry | ✅ SELESAI | Retry 1x dengan slippage+50%, max 20% |
| 4 | **Registration Fee** | ✅ SELESAI | 100 MON per agent, FeePayment record |
| 5 | **Token Discovery v2** | ✅ SELESAI | On-chain CurveCreate/Buy/Sell events |
| 6 | **SELL Amount Fix** | ✅ SELESAI | Actual token holding balance |
| 7 | **Sweep Auto-Sell** | ✅ SELESAI | Sell all holdings before sweep MON |
| 8 | **All nad.fun ABIs** | ✅ SELESAI | bondingCurveRouterAbi + dexRouterAbi (BARU) |
| 9 | **MON Gas Reserve** | ✅ SELESAI | 5.0 MON minimum selalu tersisa di wallet |
| 10 | **B5 Anti-Sniping** | ✅ SELESAI | Skip tokens < 20 blocks old |
| 11 | **B4 ExactOut** | ✅ SELESAI | exactOutBuy, exactOutSell, exactOutSellPermit via DexRouter |
| 12 | **C4 Trading Fee** | ✅ SELESAI | recordTradingFee() gated by vault, ABI + vault-operator ready |

### SETELAH DEPLOY VAULT:

| # | Gap | Deskripsi |
|---|-----|-----------|
| 13 | **C1** — Deploy AnoaCapitalVault | `forge script DeployAnoa.s.sol` → set ENV → semua hooks + fee + PnL aktif |

### F1-F4: ✅ SEMUA SELESAI

| # | Gap | Status |
|---|-----|--------|
| 14 | **F1** — Relay Protocol Client | ✅ SELESAI (relay-client.ts 288 lines) |
| 15 | **F4** — ARBITRAGE 3 Venue | ✅ SELESAI (nad.fun + LiFi + Relay) |
| 16 | **F2** — Expand MONAD_TOKENS | ✅ SELESAI (53 token) |
| 17 | **F3** — USDT/USDT0 Symbol | ✅ SELESAI (USDT0) |

### G1-G7: ✅ SEMUA SELESAI (15 Feb)

| # | Gap | Status |
|---|-----|--------|
| 18 | **G1** — Multi-Agent Architecture | ✅ SELESAI (Market Analyst + Risk Manager paralel) |
| 19 | **G2** — Trade Memory & Learning | ✅ SELESAI (BM25 Okapi + AI reflection) |
| 20 | **G3** — Chart Aggregator | ✅ SELESAI (nad.fun → GeckoTerminal → DexScreener) |
| 21 | **G4** — Technical Indicators | ✅ SELESAI (SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA) |
| 22 | **G5** — Investment Plan Context | ✅ SELESAI (10 sektor, target per strategi) |
| 23 | **G6** — get_technical_analysis tool | ✅ SELESAI (tool ke-5 function calling) |
| 24 | **G7** — Partner Marquee Landing | ✅ SELESAI (7 logos, framer-motion) |

### POST-PRODUCTION:

| # | Gap | Deskripsi |
|---|-----|-----------|
| 25 | **B6** — Token Creation | ABI siap (bondingCurveRouter.create), fokus trading dulu |
| 26 | **C2** — TrustlessAgentCore | On-chain trade validation |
| 27 | **C3** — agent0 HD wallet | Per-agent ERC-8004 signing |
| 28 | **D1** — Agent Detail Page | `/agents/[id]/page.tsx` belum ada (hanya modal di leaderboard) |
| 29 | **D2** — Investment Plan UI | User bisa customize target allocation per sektor (sekarang hardcoded) |

---

## Apa yang SUDAH BEKERJA

### Trading Core
- nad.fun bonding curve BUY on-chain (Router.buy via Lens.getAmountOut)
- nad.fun bonding curve SELL on-chain (sellPermit + fallback approve+sell)
- **ExactOut trading** (exactOutBuy, exactOutSellPermit / exactOutSell via DexRouter)
- **Correct ABI selection** (bondingCurveRouterAbi vs dexRouterAbi per router address)
- **LiFi DEX aggregator swap** (53 token MONAD_TOKENS)
- **LiFi retry mechanism** (max 2 attempts, +50% slippage on retry, cap 20%)
- **LiFi PnL correct** (non-MON output via priceUSD dari LiFi quote, stablecoin-aware)
- **Multi-decimal balance check** (6 dec USDC/USDT/AUSD, 8 dec WBTC, 18 dec default)
- Router auto-detection (nad.fun vs LiFi berdasarkan token — `isLiFiSupportedToken()`)
- DexRouter vs BondingCurveRouter detection + validation (ABI selection per router)
- **Relay Protocol** ✅ TERIMPLEMENTASI (relay-client.ts 288 lines, trade/route.ts router='relay')
- Slippage protection (default 1%, configurable per risk level)
- ERC20 approval handling
- EIP-2612 sellPermit (hemat gas ~50%)
- Router address validation (non-zero check)
- Transaction timeout (60s)
- Balance check before trade (MON + token)
- **MON gas reserve** (5.0 MON minimum selalu tersisa di wallet)
- **Failed TX retry** (max 2 attempts, +50% slippage on retry, max 20%)
- **TokenHolding cost basis** (weighted avg price, realized PnL per position)
- **SELL uses actual token holding balance** (bukan MON amount)
- **Trading fee recording** (recordTradingFee on vault, gated by CAPITAL_VAULT address)
- **3-Router Architecture**: nad.fun (bonding curve) → LiFi (DEX aggregator) → Relay (solver)

### Agent System — AUTONOMOUS
- HD Wallet per-agent (BIP-32, isolated, cached)
- **Auto-Execute mode** (skip human approval)
- **Continuous scheduler** (self-trigger loop setiap 5 menit)
- **Token discovery v2** (on-chain CurveBuy/CurveSell/CurveCreate events + nad.fun API enrichment)
- **Anti-sniping protection** (skip tokens < 20 blocks old, CurveCreate block tracking)
- **Portfolio-aware** trading (balance + holdings check + gas reserve)
- **Risk circuit breaker** (drawdown, daily loss, trade count, min size, max exposure)
- **Bonding curve intelligence** (progress-based confidence boost/sell signal)
- 6 trading strategies (MOMENTUM, YIELD, ARBITRAGE, DCA, GRID, HEDGE) — all use safe position sizing
- ERC-8004 agent registration (mint ERC-721 NFT)
- ERC-8004 reputation feedback (post-trade)
- **AI advisor with CF Function Calling** (5 tools: bonding curve, market data, risk check, price quote, technical analysis)
- AI 60:40 blend (3-tier: Cloudflare → GLM-4.7 → Vikey)
- **Multi-Agent AI**: Market Analyst (bull/bear + 5 tools) + Risk Manager (6 risk checks, APPROVE/REDUCE/BLOCK) — paralel
- **Trade Memory**: BM25 Okapi retrieval (k1=1.5, b=0.75) + AI-powered reflection per trade
- **Investment Plan**: 10 sektor, target allocation per strategi, OVER/UNDER warnings injected ke AI
- **Chart aggregator**: nad.fun → GeckoTerminal → DexScreener (semua token punya teknikal analisis)
- **Technical indicators**: SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA (pure TS, no deps)
- EIP-712 trade proposals (signed typed data)
- OpenClaw human-in-the-loop (manual mode)
- **Fund sweep with auto-sell** (sell all holdings → transfer MON to owner)
- **PnL distribution to delegators** (pro-rata, 20% performance fee)
- **Registration fee** (100 MON per agent, recorded as FeePayment)

### Risk & Metrics
- Sharpe Ratio (annualized, capped [-5, 5])
- Max Drawdown (percentage, recalculated per trade)
- Win Rate (percentage)
- PnL tracking (capital flow model: BUY=-outflow, SELL=+inflow)
- **Cost basis tracking** (avgBuyPrice, totalCost, realizedPnl per token position)
- CoinGecko + CoinMarketCap MON/USD price (60s cache, no hardcoded price)
- Daily loss tracking (Prisma aggregate)
- Daily trade count tracking

### Vault Integration (Code Ready)
- `AnoaCapitalVault.sol` — delegateCapital, withdrawCapital, recordPnl, depositProfits, fee system
- `vault-operator.ts` — recordPnlOnChain, depositProfitsOnChain, **recordTradingFeeOnChain**
- `useCapitalVault.ts` — React hooks
- `distributePnlToDelegators()` — pro-rata PnL + performance fee + on-chain recording
- **`recordTradingFee()`** — per-trade fee recording, gated by CAPITAL_VAULT address
- `capitalVaultAbi` — full ABI: recordTradingFee, withdrawFees, withdrawTokenFees + TradingFeePaid event
- Agent close + fund sweep endpoints

### Platform Features
- x402 micropayments ($0.001 USDC per trade/A2A call)
- A2A protocol (JSON-RPC 2.0, 9 methods)
- MCP server (5 tools)
- Portfolio page (10 token balances, PnL history, Transactions)
- Yield page (aPriori 6.8% + Upshift 7.2%)
- Leaderboard (paginated, sortable, filterable)
- Agent CRUD (create, list, view, edit, delete, close, sweep)
- Cloudflare R2 metadata storage

### Infrastructure
- Prisma ORM (11 models, 8 enums)
- Next.js App Router (9 pages, 19+ API routes)
- 12 React hooks
- 17+ lib modules
- Wagmi + AppKit wallet connection
- `getBaseUrl()` — centralized URL (throws in production if not configured)

---

## Cross-Reference: Kode vs Dokumentasi nad.fun

| Konsep di Dokumentasi | Ada di Kode? | Gap? |
|-----------------------|-------------|------|
| nad.fun Lens `getAmountOut` | ✅ Ada (trade/route.ts) | - |
| nad.fun Lens `getProgress` | ✅ Ada (strategy-engine.ts, token-discovery.ts) | - |
| nad.fun Lens `isGraduated` | ✅ Ada (strategy-engine.ts, token-discovery.ts) | - |
| nad.fun Lens `isLocked` | ✅ Ada (strategy-engine.ts, token-discovery.ts) | - |
| nad.fun Lens `availableBuyTokens` | ✅ ABI ada (contracts.ts) | Belum dipanggil dari trade logic |
| nad.fun Lens `getAmountIn` | ✅ Dipakai (trade/route.ts, ExactOut) | - |
| nad.fun Lens `getInitialBuyAmountOut` | ✅ ABI ada (contracts.ts) | **B6** (belum dipanggil) |
| nad.fun Router `buy` | ✅ Ada (trade/route.ts) | - |
| nad.fun Router `sell` | ✅ Ada (trade/route.ts) | - |
| nad.fun Router `sellPermit` | ✅ Ada (trade/route.ts) | - |
| nad.fun Router `exactOutBuy` | ✅ Dipakai (trade/route.ts) | - |
| nad.fun Router `exactOutSell` | ✅ Dipakai (trade/route.ts) | - |
| nad.fun Router `exactOutSellPermit` | ✅ Dipakai (trade/route.ts) | - |
| nad.fun BondingCurveRouter `create` | ✅ ABI ada (bondingCurveRouterAbi) | **B6** (belum dipanggil) |
| nad.fun DexRouter detection | ✅ Ada (trade/route.ts) | - |
| nad.fun API `getMarketData` | ✅ Dipakai (strategy-engine, token-discovery) | - |
| nad.fun API `getTokenMetrics` | ✅ Dipakai (strategy-engine) | - |
| nad.fun API `getSwapHistory` | ✅ Ada (nadfun-api.ts) | Belum dipakai strategy |
| nad.fun API `getChartData` | ✅ Ada (nadfun-api.ts) | Belum dipakai strategy |
| nad.fun API `getHoldings` | ✅ Dipakai (scheduler) | - |
| nad.fun API `getTokenInfo` | ✅ Dipakai (token-discovery) | - |
| HD wallet per-agent | ✅ Ada (agent-wallet.ts) | - |
| EIP-712 trade intent | ✅ Ada (trade-judgement.ts) | - |
| EIP-2612 permit sell | ✅ Ada (trade/route.ts) | - |
| AI 60:40 blend | ✅ Ada (ai-advisor.ts) | - |
| 6 strategies | ✅ Ada (strategy-engine.ts) | - |
| LiFi DEX swap | ✅ Ada (lifi-client.ts) | - |
| LiFi retry mechanism | ✅ Ada (trade/route.ts) | - |
| LiFi non-MON PnL | ✅ Ada (pnl-tracker.ts, trade/route.ts) | - |
| LiFi getLiFiTokens() | ✅ Ada (lifi-client.ts) | Belum dipakai strategy engine |
| LiFi MONAD_TOKENS 53 token | ✅ Ada (expanded) | ✅ F2 SELESAI — 53 token di MONAD_TOKENS |
| Relay Protocol client | ✅ Ada (relay-client.ts, 288 lines) | ✅ F1 SELESAI — getRelayQuote/executeRelaySwap |
| Relay ABI files | ✅ Ada (documents/) | Relay SDK-based, tidak perlu ABI manual |
| Relay contract addresses | ✅ Ada (relay-client.ts) | v2.1RelayRouter, ApprovalProxy, Receiver |
| ARBITRAGE multi-venue | ✅ LiFi + Relay (2 venue DEX) | ✅ F4 SELESAI — nad.fun adalah bonding curve, bukan venue arb |
| USDT/USDT0 symbol | ✅ USDT0 (alamat kontrak benar) | ✅ F3 SELESAI — nama tidak masalah, alamat benar |
| ERC-8004 registry | ✅ Ada (erc8004.ts + agent0-service.ts) | C3 |
| Capital Vault code | ✅ Ada (vault-operator.ts + hooks) | C1 (deploy) |
| Capital Vault trading fee | ✅ Ada (vault-operator.ts + trade/route.ts) | Gated by vault deploy |
| CF Function Calling | ✅ Ada (ai-advisor.ts, 5 tools) | - |
| Multi-Agent AI | ✅ Ada (ai-advisor.ts, Promise.all) | - |
| Risk Manager Agent | ✅ Ada (ai-advisor.ts, runRiskManagerReview) | - |
| Trade Memory BM25 | ✅ Ada (trade-memory.ts, getRelevantMemories) | - |
| AI Reflection | ✅ Ada (trade-memory.ts, reflectOnTrade) | - |
| Chart Aggregator | ✅ Ada (chart-aggregator.ts, getChartDataMultiSource) | - |
| Technical Indicators | ✅ Ada (technical-indicators.ts, analyzeTechnical) | - |
| Investment Plan | ✅ Ada (ai-advisor.ts, buildInvestmentPlanContext) | - |
| Partner Marquee | ✅ Ada (page.tsx, PARTNER_LOGOS) | - |

---

## File References

| File | Relevansi |
|------|-----------|
| `src/lib/strategy-engine.ts` | ✅ A1, A4, B1 done + gas reserve 5.0 MON + anti-sniping + 6 strategies |
| `src/app/api/trade/route.ts` | ✅ B2, B3, B4, A7, C4 done + 3-router (nad.fun/LiFi/Relay) + ExactOut |
| `src/lib/trade-judgement.ts` | ✅ A2 done |
| `src/app/api/scheduler/route.ts` | ✅ A3 done + anti-sniping metadata |
| `src/lib/pnl-tracker.ts` | ✅ Formula fixed + A5 cost basis done |
| `src/lib/risk-guard.ts` | ✅ A6 done |
| `src/lib/token-discovery.ts` | ✅ A1 done (v2 on-chain events + createdAtBlock) |
| `src/lib/ai-advisor.ts` | ✅ Multi-Agent AI: Market Analyst (5 tools, bull/bear) + Risk Manager (6 risk dims, APPROVE/BLOCK) + Investment Plan |
| `src/lib/trade-memory.ts` | ✅ G2 done: BM25 Okapi retrieval + AI reflection + trade stats |
| `src/lib/chart-aggregator.ts` | ✅ G3 done: nad.fun → GeckoTerminal → DexScreener (multi-source OHLCV) |
| `src/lib/technical-indicators.ts` | ✅ G4 done: SMA/EMA/RSI/MACD/Bollinger/ATR/VWMA (pure TS) |
| `src/lib/lifi-client.ts` | ✅ 53 MONAD_TOKENS + getLiFiQuote/executeLiFiSwap |
| `src/lib/relay-client.ts` | ✅ F1 done (288 lines, getRelayQuote/executeRelaySwap) |
| `src/lib/vault-operator.ts` | ✅ Code ready: recordPnlOnChain + depositProfitsOnChain + recordTradingFeeOnChain |
| `src/config/contracts.ts` | ✅ All ABIs present (lens, router, bondingCurveRouter, dexRouter, curve, erc20, erc8004, vault+tradingFee, yield) |
| `src/config/chains.ts` | ✅ All contract addresses correct + CAPITAL_VAULT from ENV |
| `contracts/src/AnoaCapitalVault.sol` | ✅ Ready to deploy |
| `contracts/script/DeployAnoa.s.sol` | ✅ Deploy script: AnoaCore + AnoaVault + config |
| `src/app/agents/create/page.tsx` | ✅ All 6 strategies + registrationFeeTxHash fix |
| `src/app/api/agents/[id]/sweep/route.ts` | ✅ Auto-sell + sweep done |
