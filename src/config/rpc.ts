/**
 * Monad RPC Configuration
 * 
 * Provides multiple RPC endpoints for reliability with automatic fallback.
 * Used for fetching wallet balances across all pages.
 */

import { http, fallback } from 'viem';
import type { Transport } from 'viem';

// Monad Mainnet RPC endpoints - ordered by reliability/speed
export const MONAD_MAINNET_RPC_URLS = [
  'https://rpc3.monad.xyz',                              // Primary - fastest
  'https://rpc1.monad.xyz',
  'https://rpc.monad.xyz',
  'https://rpc-mainnet.monadinfra.com',
  'https://monad-mainnet.gateway.tatum.io',
  'https://monad-mainnet.api.onfinality.io/public',
  'https://monad-mainnet.drpc.org',
  'https://monad-mainnet-rpc.spidernode.net',
  'https://rpc.sentio.xyz/monad-mainnet',
  'https://infra.originstake.com/monad/evm',
  'https://rpc2.monad.xyz',
  'https://rpc4.monad.xyz',
] as const;

// Monad Testnet RPC endpoints
export const MONAD_TESTNET_RPC_URLS = [
  'https://testnet-rpc.monad.xyz',
] as const;

// Default timeout for RPC calls
export const RPC_TIMEOUT = 10000; // 10 seconds
export const RPC_RETRY_COUNT = 3;
export const RPC_RETRY_DELAY = 1000; // 1 second

/**
 * Get primary RPC URL from environment or fallback
 */
export function getPrimaryRpcUrl(network: 'mainnet' | 'testnet' = 'mainnet'): string {
  if (network === 'mainnet') {
    return process.env.NEXT_PUBLIC_RPC_URL_MAINNET || MONAD_MAINNET_RPC_URLS[0];
  }
  return process.env.NEXT_PUBLIC_RPC_URL_TESTNET || MONAD_TESTNET_RPC_URLS[0];
}

/**
 * Get all RPC URLs for a network
 */
export function getAllRpcUrls(network: 'mainnet' | 'testnet' = 'mainnet'): readonly string[] {
  if (network === 'mainnet') {
    return MONAD_MAINNET_RPC_URLS;
  }
  return MONAD_TESTNET_RPC_URLS;
}

/**
 * Create a viem transport with fallback support
 * Automatically tries next RPC if one fails
 */
export function createFallbackTransport(network: 'mainnet' | 'testnet' = 'mainnet'): Transport {
  const urls = getAllRpcUrls(network);
  
  return fallback(
    urls.map(url => 
      http(url, {
        timeout: RPC_TIMEOUT,
        retryCount: RPC_RETRY_COUNT,
        retryDelay: RPC_RETRY_DELAY,
      })
    ),
    { rank: true } // Auto-rank based on response time
  );
}

/**
 * Create http transports for wagmi
 */
export function createHttpTransports() {
  return {
    // Monad Mainnet (chain id: 143)
    143: createFallbackTransport('mainnet'),
    // Monad Testnet (chain id: 10143)
    10143: createFallbackTransport('testnet'),
  };
}
