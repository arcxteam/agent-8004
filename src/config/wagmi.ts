'use client';

import { cookieStorage, createStorage } from '@wagmi/core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { monadTestnet, monadMainnet } from './chains';
import { createFallbackTransport } from './rpc';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { getRpcUrl, getExplorerUrl, getCurrentNetwork } from '@/lib/config';

// Get WalletConnect project ID
export const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'demo-project-id';

if (!projectId || projectId === 'demo-project-id') {
  console.warn('WalletConnect Project ID not set. Get one at https://dashboard.reown.com');
}

// Get the correct chain based on environment
const network = getCurrentNetwork();

// Resolve URLs from environment - single source of truth
const testnetRpcUrl = getRpcUrl('testnet');
const mainnetRpcUrl = getRpcUrl('mainnet');
const testnetExplorerUrl = getExplorerUrl('testnet');
const mainnetExplorerUrl = getExplorerUrl('mainnet');

// Define networks for AppKit
export const monadTestnetNetwork: AppKitNetwork = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [testnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monadscan',
      url: testnetExplorerUrl,
    },
  },
  testnet: true,
};

export const monadMainnetNetwork: AppKitNetwork = {
  id: 143,
  name: 'Monad',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [mainnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monadscan',
      url: mainnetExplorerUrl,
    },
  },
  testnet: false,
};

// Networks array
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = network === 'mainnet'
  ? [monadMainnetNetwork, monadTestnetNetwork]
  : [monadTestnetNetwork, monadMainnetNetwork];

// Wagmi chains for compatibility
export const chains = network === 'mainnet'
  ? [monadMainnet, monadTestnet] as const
  : [monadTestnet, monadMainnet] as const;

// Create Wagmi Adapter with fallback-enabled transports for reliability
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [monadTestnet.id]: createFallbackTransport('testnet'),
    [monadMainnet.id]: createFallbackTransport('mainnet'),
  },
});

// Export wagmi config
export const wagmiConfig = wagmiAdapter.wagmiConfig;
