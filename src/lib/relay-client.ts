/**
 * Relay Protocol DEX Aggregator Client for Monad
 *
 * Provides quote and swap execution through Relay's SDK.
 * Used as the third trading venue (alongside nad.fun and LiFi) for:
 * - ARBITRAGE strategy: cross-venue price comparison
 * - General swaps: solver-based routing may yield better prices
 *
 * SDK: @relayprotocol/relay-sdk v5.x
 * API: https://api.relay.link
 * Monad chain ID: 143
 *
 * Rate limits (without API key): 50 quotes/min, 200 req/min for other endpoints
 * With API key: 10 req/sec for quotes
 *
 * Contract addresses on Monad:
 *   RelayRouter: 0x3eC130B627944cad9b2750300ECB0A695DA522B6
 *   RelayApprovalProxy: 0x58cC3e0aA6CD7bf795832A225179ec2d848cE3e7
 *   RelayReceiver: 0xf17902d51FdfF7Bf50AacB78d6bB399BaF88b479
 */

import {
  createClient,
  getClient,
  MAINNET_RELAY_API,
} from '@relayprotocol/relay-sdk';
import type { WalletClient } from 'viem';
import { MONAD_TOKENS, resolveTokenAddress } from '@/lib/lifi-client';

// Monad chain ID
const MONAD_CHAIN_ID = 143;

// Native MON uses zero address
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RelayQuoteResult {
  /** Raw quote object from Relay SDK (passed to execute) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawQuote: any;
  /** Estimated output amount in human-readable format */
  estimatedOutput: string;
  /** Estimated output amount in wei */
  estimatedOutputWei: string;
  /** Input amount in human-readable format */
  inputAmount: string;
  /** Price of output token in USD (if available) */
  outputPriceUsd?: number;
}

export interface RelaySwapResult {
  /** Transaction hash(es) from the swap */
  txHash: string;
  /** Input amount (human-readable) */
  fromAmount: string;
  /** Output amount (human-readable) */
  toAmount: string;
  /** Gas used (if available) */
  gasUsed?: bigint;
}

// ─── Singleton Initialization ───────────────────────────────────────────────

let relayInitialized = false;

/**
 * Initialize Relay SDK singleton. Safe to call multiple times.
 * Uses proxy API URL from env if available, otherwise direct API.
 */
function ensureRelayClient(): void {
  if (relayInitialized) return;

  const baseApiUrl = process.env.RELAY_PROXY_API || process.env.RELAY_API_URL || MAINNET_RELAY_API;
  const apiKey = process.env.RELAY_API_KEY;

  createClient({
    baseApiUrl,
    source: 'anoa.agent',
    ...(apiKey ? { apiKey } : {}),
  });

  relayInitialized = true;
  console.log(`[Relay] Client initialized (API: ${baseApiUrl})`);
}

// ─── Quote ──────────────────────────────────────────────────────────────────

/**
 * Get a swap quote from Relay for same-chain swap on Monad.
 *
 * @param fromToken - Token address or symbol (e.g., 'MON', '0x...')
 * @param toToken - Token address or symbol
 * @param amount - Human-readable amount (e.g., '1.5')
 * @param userAddress - Wallet address
 */
export async function getRelayQuote(
  fromToken: string,
  toToken: string,
  amount: string,
  userAddress: string,
): Promise<RelayQuoteResult> {
  ensureRelayClient();

  const client = getClient();
  if (!client) {
    throw new Error('Relay client not initialized');
  }

  // Resolve token addresses
  const from = resolveRelayTokenAddress(fromToken);
  const to = resolveRelayTokenAddress(toToken);

  // Convert amount to wei
  const { parseUnits } = await import('viem');
  const amountWei = parseUnits(amount, from.decimals).toString();

  // Build headers with API key if available
  const headers: Record<string, string> = {};
  if (process.env.RELAY_API_KEY) {
    headers['x-api-key'] = process.env.RELAY_API_KEY;
  }

  const quote = await client.actions.getQuote(
    {
      chainId: MONAD_CHAIN_ID,
      toChainId: MONAD_CHAIN_ID,
      currency: from.address,
      toCurrency: to.address,
      amount: amountWei,
      user: userAddress,
      recipient: userAddress,
      tradeType: 'EXACT_INPUT',
    },
    false, // includeDefaultParameters
    Object.keys(headers).length > 0 ? headers : undefined,
  );

  // Extract estimated output from quote details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (quote as any).details;
  const estimatedOutputWei = details?.currencyOut?.amount || '0';
  const { formatUnits } = await import('viem');
  const estimatedOutput = formatUnits(BigInt(estimatedOutputWei), to.decimals);
  const outputPriceUsd = details?.currencyOut?.amountUsd
    ? Number(details.currencyOut.amountUsd) / Number(estimatedOutput || '1')
    : undefined;

  return {
    rawQuote: quote,
    estimatedOutput,
    estimatedOutputWei,
    inputAmount: amount,
    outputPriceUsd: outputPriceUsd && !isNaN(outputPriceUsd) ? outputPriceUsd : undefined,
  };
}

// ─── Execute ────────────────────────────────────────────────────────────────

/**
 * Execute a Relay swap using a previously obtained quote.
 * The SDK handles all transaction construction and signing via the walletClient.
 *
 * @param quote - Quote obtained from getRelayQuote()
 * @param walletClient - Viem WalletClient with account
 */
export async function executeRelaySwap(
  quote: RelayQuoteResult,
  walletClient: WalletClient,
): Promise<RelaySwapResult> {
  ensureRelayClient();

  const client = getClient();
  if (!client) {
    throw new Error('Relay client not initialized');
  }

  if (!walletClient.account) {
    throw new Error('Wallet client must have an account');
  }

  let txHash = '';
  let toAmount = quote.estimatedOutput;

  // Execute the swap. SDK handles tx construction via walletClient.
  const executePromise = client.actions.execute({
    quote: quote.rawQuote,
    wallet: walletClient,
    onProgress: (data) => {
      // Capture tx hash from progress
      if (data.txHashes && data.txHashes.length > 0) {
        txHash = data.txHashes[data.txHashes.length - 1].txHash;
      }

      // Update output amount from execution details if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = (data as any).details;
      if (details?.currencyOut?.amount) {
        const { formatUnits } = require('viem');
        // Try to get output decimals from the quote
        const outDecimals = getOutputDecimals(quote);
        toAmount = formatUnits(BigInt(details.currencyOut.amount), outDecimals);
      }
    },
  });

  // The execute function returns a promise with abortController
  const result = await executePromise;

  // Check for errors in the final result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalSteps = (result.data as any)?.steps;
  if (finalSteps) {
    for (const step of finalSteps) {
      for (const item of step.items || []) {
        if (item.status === 'failure') {
          throw new Error(`Relay swap failed: ${item.error || 'Unknown error'}`);
        }
      }
    }
  }

  if (!txHash) {
    throw new Error('No transaction hash received from Relay swap');
  }

  return {
    txHash,
    fromAmount: quote.inputAmount,
    toAmount,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a token symbol or address to its address and decimals.
 * Uses MONAD_TOKENS from lifi-client for consistent token resolution.
 */
function resolveRelayTokenAddress(tokenOrSymbol: string): { address: string; decimals: number } {
  try {
    return resolveTokenAddress(tokenOrSymbol);
  } catch {
    // If not found in MONAD_TOKENS, assume it's a raw address with 18 decimals
    if (tokenOrSymbol.startsWith('0x')) {
      return { address: tokenOrSymbol, decimals: 18 };
    }
    throw new Error(`Unknown token: ${tokenOrSymbol}`);
  }
}

/**
 * Extract output token decimals from quote details.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOutputDecimals(quote: RelayQuoteResult): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = (quote.rawQuote as any)?.details;
    const toCurrency = details?.currencyOut?.currency?.address;
    if (toCurrency) {
      const resolved = resolveRelayTokenAddress(toCurrency);
      return resolved.decimals;
    }
  } catch {
    // fallback
  }
  return 18;
}

/**
 * Check if Relay is available and configured.
 * Returns true if the SDK can be initialized.
 */
export function isRelayAvailable(): boolean {
  return true; // Relay SDK works without API key (rate-limited to 50 quotes/min)
}

/**
 * Check if a token address is known and potentially tradable via Relay.
 * Relay supports any token with liquidity on Monad — this checks our known list.
 */
export function isRelaySupportedToken(tokenAddress: string): boolean {
  return Object.values(MONAD_TOKENS).some(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}
