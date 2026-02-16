/**
 * LiFi DEX Aggregator Client for Monad
 *
 * Provides quote and swap execution through LiFi's REST API.
 * Used for trading 52 tokens on Monad mainnet (50 official from
 * tokenlist-monad.json + CHOG + APR) when they're not available
 * on nad.fun bonding curves.
 *
 * LiFi API: https://li.quest/v1/
 * Router: 0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37 (Monad mainnet)
 * Source: https://github.com/monad-crypto/token-list (v2.27.0)
 */

import { type PublicClient, type WalletClient, parseUnits, formatUnits, erc20Abi } from 'viem';
import { LIFI_ROUTER_ADDRESS } from '@/config/contracts';

const LIFI_API_BASE = 'https://li.quest/v1';

// Monad chain IDs
const MONAD_MAINNET_CHAIN_ID = 143;

// Native MON address (LiFi uses zero address for native tokens on Monad)
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// All token addresses on Monad mainnet (chain 143)
// Source: tokenlist-monad.json v2.27.0 (50 tokens) + CHOG + APR (custom)
// Keys are UPPERCASED for lookup via resolveTokenAddress()
const MONAD_TOKENS: Record<string, { address: string; decimals: number }> = {
  // ── Native & Wrapped ─────────────────────────────────────────────────────
  MON:      { address: NATIVE_TOKEN_ADDRESS, decimals: 18 },
  WMON:     { address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', decimals: 18 },

  // ── Stablecoins ──────────────────────────────────────────────────────────
  USDC:     { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', decimals: 6 },
  USDT0:    { address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D', decimals: 6 },  // Official symbol: USDT0 (LayerZero)
  USDT:     { address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D', decimals: 6 },  // Alias for backward compat
  AUSD:     { address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a', decimals: 6 },
  IDRX:     { address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', decimals: 2 },
  'USD*':   { address: '0x1808D4aA4D4a7cf66bb6515BF126edEfA2b018c1', decimals: 6 },
  USD1:     { address: '0x111111d2bf19e43C34263401e0CAd979eD1cdb61', decimals: 6 },

  // ── Yield / Staking Stablecoins ──────────────────────────────────────────
  EARNAUSD: { address: '0x103222f020e98Bba0AD9809A011FDF8e6F067496', decimals: 6 },
  SAUSD:    { address: '0xD793c04B87386A6bb84ee61D98e0065FdE7fdA5E', decimals: 6 },
  SUUSD:    { address: '0x8BF591Eae535f93a242D5A954d3Cde648b48A5A8', decimals: 18 },
  SYZUSD:   { address: '0x484be0540aD49f351eaa04eeB35dF0f937D4E73f', decimals: 18 },
  WSRUSD:   { address: '0x4809010926aec940b550D34a46A52739f996D75D', decimals: 18 },
  LVUSD:    { address: '0xFD44B35139Ae53FFF7d8F2A9869c503D987f00d1', decimals: 18 },
  YZUSD:    { address: '0x9dcB0D17eDDE04D27F387c89fECb78654C373858', decimals: 18 },
  THBILL:   { address: '0xfDD22Ce6D1F66bc0Ec89b20BF16CcB6670F55A5a', decimals: 6 },

  // ── ETH Variants ─────────────────────────────────────────────────────────
  WETH:     { address: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242', decimals: 18 },
  WSTETH:   { address: '0x10Aeaf63194db8d453d4D85a06E5eFE1dd0b5417', decimals: 18 },
  WEETH:    { address: '0xA3D68b74bF0528fdD07263c60d6488749044914b', decimals: 18 },
  EZETH:    { address: '0x2416092f143378750bb29b79eD961ab195CcEea5', decimals: 18 },
  PUFETH:   { address: '0x37D6382B6889cCeF8d6871A8b60E667115eDDBcF', decimals: 18 },
  SUETH:    { address: '0x1c22531AA9747d76fFF8F0A43b37954ca67d28e0', decimals: 18 },

  // ── BTC Variants ─────────────────────────────────────────────────────────
  WBTC:     { address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', decimals: 8 },
  'BTC.B':  { address: '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072', decimals: 8 },
  LBTC:     { address: '0xecAc9C5F704e954931349Da37F60E39f515c11c1', decimals: 8 },
  SOLVBTC:  { address: '0xaE4EFbc7736f963982aACb17EFA37fCBAb924cB3', decimals: 18 },
  XSOLVBTC: { address: '0xc99F5c922DAE05B6e2ff83463ce705eF7C91F077', decimals: 18 },
  SUBTC:    { address: '0xe85411C030fB32A9D8b14Bbbc6CB19417391F711', decimals: 18 },

  // ── MON Staking / LST ────────────────────────────────────────────────────
  APRMON:   { address: '0x0c65A0BC65a5D819235B71F554D210D3F80E0852', decimals: 18 },
  GMON:     { address: '0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081', decimals: 18 },
  SMON:     { address: '0xA3227C5969757783154C60bF0bC1944180ed81B9', decimals: 18 },
  SHMON:    { address: '0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c', decimals: 18 },
  EARNMON:  { address: '0x8FA1365f6E39B7404737721a356B1d4a7b11cA7D', decimals: 18 },
  LVMON:    { address: '0x91b81bfbe3A747230F0529Aa28d8b2Bc898E6D56', decimals: 18 },
  MCMON:    { address: '0x1D4795A4670033f47f572b910553be0295077b51', decimals: 18 },

  // ── Cross-chain Assets ───────────────────────────────────────────────────
  SOL:      { address: '0xea17E5a9efEBf1477dB45082d67010E2245217f1', decimals: 9 },
  XAUT0:    { address: '0x01bFF41798a0BcF287b996046Ca68b395DbC1071', decimals: 6 },

  // ── DeFi Protocol Tokens ─────────────────────────────────────────────────
  CAKE:     { address: '0xF59D81cd43f620E722E07f9Cb3f6E41B031017a3', decimals: 18 },
  DUST:     { address: '0xAD96C3dffCD6374294e2573A7fBBA96097CC8d7c', decimals: 18 },
  EUL:      { address: '0xDef72Af3fc69E1Dd5a094f7DDa08Ba203CD0438B', decimals: 18 },
  FOLKS:    { address: '0xFF7F8F301F7A706E3CfD3D2275f5dc0b9EE8009B', decimals: 6 },
  NXPC:     { address: '0xD33F18D8d48CbbB2f8b47063DE97f94De0D49B99', decimals: 18 },
  MVT:      { address: '0x04f8c38AE80BcF690B947f60F62BdA18145c3D67', decimals: 18 },
  LV:       { address: '0x1001fF13bf368Aa4fa85F21043648079F00E1001', decimals: 18 },
  YZPP:     { address: '0xb37476cB1F6111cC682b107B747b8652f90B0984', decimals: 18 },

  // ── Mu Digital ───────────────────────────────────────────────────────────
  AZND:     { address: '0x4917a5ec9fCb5e10f47CBB197aBe6aB63be81fE8', decimals: 18 },
  LOAZND:   { address: '0x9c82eB49B51F7Dc61e22Ff347931CA32aDc6cd90', decimals: 18 },
  MUBOND:   { address: '0x336D414754967C6682B5A665C7DAF6F1409E63e8', decimals: 18 },

  // ── Midas ────────────────────────────────────────────────────────────────
  MEDGE:    { address: '0x1c8eE940B654bFCeD403f2A44C1603d5be0F50Fa', decimals: 18 },
  MHYPER:   { address: '0xd90F6bFEd23fFDE40106FC4498DD2e9EDB95E4e7', decimals: 18 },

  // ── Custom (not in official tokenlist) ────────────────────────────────────
  CHOG:     { address: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777', decimals: 18 },
  APR:      { address: '0x0a332311633C0625f63CFc51EE33fC49826E0a3C', decimals: 18 },
};

export interface LiFiQuote {
  id: string;
  type: string;
  tool: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: LiFiToken;
    toToken: LiFiToken;
    fromAmount: string;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    feeCosts: Array<{ amount: string; token: LiFiToken }>;
    gasCosts: Array<{ amount: string; token: LiFiToken }>;
    executionDuration: number;
  };
  transactionRequest: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice?: string;
    chainId: number;
  };
}

export interface LiFiToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  priceUSD?: string;
}

export interface LiFiQuoteParams {
  fromToken: string; // Token address or symbol
  toToken: string;   // Token address or symbol
  amount: string;    // Human-readable amount (e.g., "1.5")
  fromAddress: string; // Wallet address
  slippageBps?: number; // Slippage in bps (default 100 = 1%)
}

export interface LiFiSwapResult {
  txHash: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  gasUsed?: bigint;
}

/**
 * Resolve token symbol to address. Supports both addresses (0x...) and symbols (USDC).
 */
export function resolveTokenAddress(tokenOrSymbol: string): { address: string; decimals: number } {
  // If it's already an address
  if (tokenOrSymbol.startsWith('0x') || tokenOrSymbol.startsWith('0X')) {
    // Look up decimals from known tokens
    const known = Object.values(MONAD_TOKENS).find(
      (t) => t.address.toLowerCase() === tokenOrSymbol.toLowerCase()
    );
    return {
      address: tokenOrSymbol,
      decimals: known?.decimals ?? 18, // Default to 18 if unknown
    };
  }

  // Look up by symbol
  const symbol = tokenOrSymbol.toUpperCase();
  const token = MONAD_TOKENS[symbol];
  if (!token) {
    throw new Error(`Unknown token symbol: ${tokenOrSymbol}. Known tokens: ${Object.keys(MONAD_TOKENS).join(', ')}`);
  }
  return token;
}

/**
 * Check if a token is supported by LiFi on Monad.
 * Returns true for known portfolio tokens.
 */
export function isLiFiSupportedToken(tokenAddress: string): boolean {
  return Object.values(MONAD_TOKENS).some(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}

/**
 * Get the LiFi router address for Monad
 */
export function getLiFiRouterAddress(): `0x${string}` {
  return LIFI_ROUTER_ADDRESS;
}

/**
 * Get a quote from LiFi for a token swap on Monad.
 *
 * @param params - Quote parameters
 * @returns LiFi quote with transaction data
 */
export async function getLiFiQuote(params: LiFiQuoteParams): Promise<LiFiQuote> {
  const { fromToken, toToken, amount, fromAddress, slippageBps = 100 } = params;

  const from = resolveTokenAddress(fromToken);
  const to = resolveTokenAddress(toToken);

  // Convert human-readable amount to smallest unit
  const fromAmount = parseUnits(amount, from.decimals).toString();
  const slippage = slippageBps / 10000; // Convert bps to decimal (100 bps = 0.01)

  const queryParams = new URLSearchParams({
    fromChain: MONAD_MAINNET_CHAIN_ID.toString(),
    toChain: MONAD_MAINNET_CHAIN_ID.toString(),
    fromToken: from.address,
    toToken: to.address,
    fromAmount,
    fromAddress,
    toAddress: fromAddress,
    slippage: slippage.toString(),
    integrator: 'NadFun',
    fee: '0.01',
    order: 'RECOMMENDED',
    allowDestinationCall: 'true',
  });

  const response = await fetch(`${LIFI_API_BASE}/quote?${queryParams}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LiFi quote failed (${response.status}): ${errorBody || response.statusText}`);
  }

  const quote = await response.json() as LiFiQuote;

  if (!quote.transactionRequest) {
    throw new Error('LiFi quote did not return transaction data');
  }

  return quote;
}

/**
 * Execute a LiFi swap on-chain using the quote's transaction data.
 *
 * @param quote - LiFi quote from getLiFiQuote
 * @param walletClient - Viem wallet client with account
 * @param publicClient - Viem public client for receipt
 * @returns Swap result with tx hash and amounts
 */
export async function executeLiFiSwap(
  quote: LiFiQuote,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<LiFiSwapResult> {
  const { transactionRequest: tx } = quote;

  if (!walletClient.account) {
    throw new Error('Wallet client must have an account');
  }

  // If swapping from ERC20 (not native), check approval first
  const fromTokenAddr = quote.action.fromToken.address;
  const isNative = fromTokenAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
  const approvalAddress = quote.estimate.approvalAddress;

  if (!isNative && approvalAddress) {
    // Check current allowance using standard erc20Abi from viem
    const currentAllowance = await publicClient.readContract({
      address: fromTokenAddr as `0x${string}`,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletClient.account.address, approvalAddress as `0x${string}`],
    });

    const requiredAmount = BigInt(quote.action.fromAmount);
    if ((currentAllowance as bigint) < requiredAmount) {
      const approveTx = await walletClient.writeContract({
        address: fromTokenAddr as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [approvalAddress as `0x${string}`, requiredAmount],
        chain: walletClient.chain,
        account: walletClient.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  // Validate LiFi transaction before sending
  if (tx.chainId && tx.chainId !== MONAD_MAINNET_CHAIN_ID) {
    throw new Error(`Chain ID mismatch: expected ${MONAD_MAINNET_CHAIN_ID}, got ${tx.chainId}`);
  }

  if (tx.to.toLowerCase() !== LIFI_ROUTER_ADDRESS.toLowerCase()) {
    throw new Error(`Unknown LiFi target: ${tx.to}. Expected router: ${LIFI_ROUTER_ADDRESS}`);
  }

  if (!tx.data || tx.data.length < 10) {
    throw new Error('Invalid transaction data from LiFi');
  }

  // Send the swap transaction
  const txHash = await walletClient.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value || '0'),
    gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
    chain: walletClient.chain,
    account: walletClient.account!,
  });

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error('LiFi swap transaction reverted');
  }

  const fromDecimals = quote.action.fromToken.decimals;
  const toDecimals = quote.action.toToken.decimals;

  return {
    txHash,
    fromToken: quote.action.fromToken.address,
    toToken: quote.action.toToken.address,
    fromAmount: formatUnits(BigInt(quote.estimate.fromAmount), fromDecimals),
    toAmount: formatUnits(BigInt(quote.estimate.toAmount), toDecimals),
    toAmountMin: formatUnits(BigInt(quote.estimate.toAmountMin), toDecimals),
    gasUsed: receipt.gasUsed,
  };
}

/**
 * Check the status of a LiFi transaction.
 */
export async function getLiFiStatus(txHash: string): Promise<{
  status: 'PENDING' | 'DONE' | 'FAILED' | 'NOT_FOUND';
  substatus?: string;
}> {
  const params = new URLSearchParams({
    txHash,
    bridge: 'lifi',
    fromChain: MONAD_MAINNET_CHAIN_ID.toString(),
    toChain: MONAD_MAINNET_CHAIN_ID.toString(),
  });

  const response = await fetch(`${LIFI_API_BASE}/status?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return { status: 'NOT_FOUND' };
  }

  const data = await response.json();
  return {
    status: data.status || 'NOT_FOUND',
    substatus: data.substatus,
  };
}

/**
 * Get available tokens on LiFi for Monad chain.
 */
export async function getLiFiTokens(): Promise<LiFiToken[]> {
  const response = await fetch(
    `${LIFI_API_BASE}/tokens?chains=${MONAD_MAINNET_CHAIN_ID}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch LiFi tokens: ${response.statusText}`);
  }

  const data = await response.json();
  return data.tokens?.[MONAD_MAINNET_CHAIN_ID.toString()] || [];
}

// ─── MON-denominated token symbols (value ≈ balance in MON terms) ─────────
// WMON is 1:1 with MON. LSTs (liquid staking tokens) are approximately 1:1.
const MON_DENOMINATED_SYMBOLS = new Set([
  'WMON', 'APRMON', 'GMON', 'SMON', 'SHMON', 'EARNMON', 'LVMON', 'MCMON',
]);

/**
 * Get ERC-20 token holdings for a wallet address using on-chain balanceOf calls.
 * Uses multicall for efficient batch querying of all MONAD_TOKENS (1-2 RPC calls).
 *
 * Returns holdings in the same format as nadfun-api getHoldings() for compatibility.
 * - `value` field: approximate MON-denominated value for WMON/LSTs, "0" for others.
 *
 * @param publicClient - Viem public client
 * @param walletAddress - Wallet to check balances for
 */
export async function getERC20Holdings(
  publicClient: PublicClient,
  walletAddress: string,
): Promise<{ holdings: Array<{ token: string; name: string; symbol: string; balance: string; value: string }> }> {
  // Get all non-native tokens (skip MON native — we query getBalance separately)
  const tokenEntries = Object.entries(MONAD_TOKENS).filter(
    ([, t]) => t.address !== NATIVE_TOKEN_ADDRESS
  );

  // Remove duplicates (e.g. USDT0 and USDT share same address)
  const seen = new Set<string>();
  const uniqueTokens = tokenEntries.filter(([, t]) => {
    const lower = t.address.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Batch query via multicall (all balanceOf in 1-2 RPC calls)
  const calls = uniqueTokens.map(([, t]) => ({
    address: t.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [walletAddress as `0x${string}`],
  }));

  const results = await publicClient.multicall({ contracts: calls });

  const holdings: Array<{ token: string; name: string; symbol: string; balance: string; value: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'success' && result.result) {
      const rawBalance = result.result as bigint;
      if (rawBalance > 0n) {
        const [symbol, tokenInfo] = uniqueTokens[i];
        const formattedBalance = formatUnits(rawBalance, tokenInfo.decimals);

        // MON-denominated value: WMON and MON LSTs are ~1:1 with MON
        // Other tokens: "0" (requires price oracle for accurate MON valuation)
        const value = MON_DENOMINATED_SYMBOLS.has(symbol) ? formattedBalance : '0';

        holdings.push({
          token: tokenInfo.address,
          name: symbol,
          symbol,
          balance: formattedBalance,
          value,
        });
      }
    }
  }

  return { holdings };
}

// Re-export known tokens for convenience
export { MONAD_TOKENS };
