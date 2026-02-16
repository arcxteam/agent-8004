/**
 * Environment Configuration Utility
 *
 * Centralizes all environment variables with type-safe access.
 * Provides consistent URL management for RPC endpoints, explorers, and APIs.
 */

// Type definitions
export type Network = 'testnet' | 'mainnet';

// Constants
export const RPC_TIMEOUT = 10000; // 10 seconds
export const API_TIMEOUT = 10000; // 10 seconds

// Fallback URL lookup tables (used when env vars are not available)
const RPC_FALLBACKS: Record<Network, string[]> = {
  mainnet: ['https://rpc3.monad.xyz', 'https://rpc-mainnet.monadinfra.com', 'https://monad-mainnet.drpc.org'],
  testnet: ['https://testnet-rpc.monad.xyz'],
};
const EXPLORER_FALLBACKS: Record<Network, string> = {
  mainnet: 'https://monadscan.com',
  testnet: 'https://testnet.monadscan.com',
};
const API_FALLBACKS: Record<Network, string> = {
  mainnet: 'https://api.nadapp.net',
  testnet: 'https://dev-api.nad.fun',
};

/**
 * Get the current network from environment
 * Defaults to testnet if not specified or invalid
 */
export function getCurrentNetwork(): Network {
  const network = process.env.NEXT_PUBLIC_NETWORK?.toLowerCase();
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}

/**
 * Get RPC URL for the specified network
 * @param network - The network to get RPC URL for
 * @returns RPC URL string
 */
export function getRpcUrl(network: Network = getCurrentNetwork()): string {
  const envVar = network === 'mainnet'
    ? process.env.NEXT_PUBLIC_RPC_URL_MAINNET
    : process.env.NEXT_PUBLIC_RPC_URL_TESTNET;

  if (!envVar) {
    const fb = RPC_FALLBACKS[network][0];
    console.warn('[config] RPC URL for ' + network + ' not in env, using fallback: ' + fb);
    return fb;
  }

  return envVar;
}

/**
 * Get Explorer URL for the specified network
 * @param network - The network to get explorer URL for
 * @returns Explorer URL string
 */
export function getExplorerUrl(network: Network = getCurrentNetwork()): string {
  const envVar = network === 'mainnet'
    ? process.env.NEXT_PUBLIC_EXPLORER_URL_MAINNET
    : process.env.NEXT_PUBLIC_EXPLORER_URL_TESTNET;

  if (!envVar) {
    const fb = EXPLORER_FALLBACKS[network];
    console.warn('[config] Explorer URL for ' + network + ' not in env, using fallback: ' + fb);
    return fb;
  }

  return envVar;
}

/**
 * Get API URL for the specified network
 * @param network - The network to get API URL for
 * @returns API URL string
 */
export function getApiUrl(network: Network = getCurrentNetwork()): string {
  const envVar = network === 'mainnet'
    ? process.env.NEXT_PUBLIC_API_URL_MAINNET
    : process.env.NEXT_PUBLIC_API_URL_TESTNET;

  if (!envVar) {
    const fb = API_FALLBACKS[network];
    console.warn('[config] API URL for ' + network + ' not in env, using fallback: ' + fb);
    return fb;
  }

  return envVar;
}

/**
 * Get contract address for the specified network
 * @param contractName - The contract name from environment variables
 * @param network - The network to get contract address for
 * @returns Contract address string or undefined if not found
 */
export function getContractAddress(
  contractName: 'WMON' | 'CURVE' | 'LENS' | 'DEX_ROUTER' | 'BONDING_CURVE_ROUTER' | 'V3_FACTORY' | 'CREATOR_TREASURY',
  network: Network = getCurrentNetwork()
): string | undefined {
  const envKey = 'NEXT_PUBLIC_' + contractName + '_' + network.toUpperCase();
  const envVar = process.env[envKey];

  if (!envVar) {
    console.warn('Contract address not found for ' + contractName + ' on ' + network);
  }

  return envVar;
}

/**
 * Environment configuration object for easy access
 */
export const config = {
  // Network
  network: getCurrentNetwork(),

  // RPC URLs
  rpcUrl: getRpcUrl(),
  rpcTimeout: RPC_TIMEOUT,

  // Explorer URLs
  explorerUrl: getExplorerUrl(),

  // API URLs
  apiUrl: getApiUrl(),
  apiTimeout: API_TIMEOUT,

  // Wallet Connect
  walletConnectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,

  // Agent Faucet
  agentFaucetUrl: process.env.NEXT_PUBLIC_AGENT_FAUCET_URL,
} as const;

/**
 * Validate that all required environment variables are set
 * Call this on app initialization to catch configuration issues early
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check critical variables
  if (!process.env.NEXT_PUBLIC_NETWORK) {
    errors.push('NEXT_PUBLIC_NETWORK is not set');
  }

  const network = getCurrentNetwork();
  if (network === 'mainnet' && !process.env.NEXT_PUBLIC_RPC_URL_MAINNET) {
    errors.push('NEXT_PUBLIC_RPC_URL_MAINNET is not set');
  }
  if (network === 'testnet' && !process.env.NEXT_PUBLIC_RPC_URL_TESTNET) {
    errors.push('NEXT_PUBLIC_RPC_URL_TESTNET is not set');
  }

  if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID) {
    errors.push('NEXT_PUBLIC_WALLET_CONNECT_ID is not set');
  }

  if (errors.length > 0) {
    console.error('Environment configuration errors:', errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate production-critical environment variables
 * Warns in production if any are missing (uses fallbacks where available)
 */
export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'NEXTAUTH_URL',
    'DATABASE_URL',
    'AGENT_MASTER_SEED',
  ];

  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    required.push('NEXT_PUBLIC_RPC_URL_MAINNET');
  } else {
    required.push('NEXT_PUBLIC_RPC_URL_TESTNET');
  }

  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      '[config] Missing production ENV variables: ' + missing.join(', ') + '. ' +
      'Check .env.example for documentation. Using fallbacks where available.'
    );
  }
}
