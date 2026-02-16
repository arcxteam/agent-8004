import { type Chain } from 'viem';
import { getRpcUrl, getExplorerUrl, getApiUrl, getCurrentNetwork } from '@/lib/config';

// Resolve URLs from environment at module initialization
const testnetRpcUrl = getRpcUrl('testnet');
const mainnetRpcUrl = getRpcUrl('mainnet');
const testnetExplorerUrl = getExplorerUrl('testnet');
const mainnetExplorerUrl = getExplorerUrl('mainnet');

// Monad Testnet Configuration
export const monadTestnet: Chain = {
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

// Monad Mainnet Configuration
export const monadMainnet: Chain = {
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
};

// Network-specific contract addresses
export const CONTRACTS = {
  testnet: {
    DEX_ROUTER: '0x5D4a4f430cA3B1b2dB86B9cFE48a5316800F5fb2' as `0x${string}`,
    BONDING_CURVE_ROUTER: '0x865054F0F6A288adaAc30261731361EA7E908003' as `0x${string}`,
    LENS: '0xB056d79CA5257589692699a46623F901a3BB76f1' as `0x${string}`,
    CURVE: '0x1228b0dc9481C11D3071E7A924B794CfB038994e' as `0x${string}`,
    WMON: '0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd' as `0x${string}`,
    V3_FACTORY: '0xd0a37cf728CE2902eB8d4F6f2afc76854048253b' as `0x${string}`,
    CREATOR_TREASURY: '0x24dFf9B68fA36f8400302e2babC3e049eA19459E' as `0x${string}`,
  },
  mainnet: {
    DEX_ROUTER: '0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137' as `0x${string}`,
    BONDING_CURVE_ROUTER: '0x6F6B8F1a20703309951a5127c45B49b1CD981A22' as `0x${string}`,
    LENS: '0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea' as `0x${string}`,
    CURVE: '0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE' as `0x${string}`,
    WMON: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' as `0x${string}`,
    V3_FACTORY: '0x6B5F564339DbAD6b780249827f2198a841FEB7F3' as `0x${string}`,
    CREATOR_TREASURY: '0x42e75B4B96d7000E7Da1e0c729Cec8d2049B9731' as `0x${string}`,
  },
} as const;

// Official ERC-8004 Registry Addresses on Monad (from docs.monad.xyz)
export const ERC8004_REGISTRIES = {
  // Same addresses for both testnet and mainnet
  IDENTITY_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
  REPUTATION_REGISTRY: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as `0x${string}`,
  VALIDATION_REGISTRY: null as `0x${string}` | null, // Coming soon
} as const;

// ANOA Capital Vault Address (to be deployed)
// This vault handles capital delegation, fee collection, and withdrawals
export const CAPITAL_VAULT = {
  // Placeholder - update after deployment with forge script
  testnet: process.env.NEXT_PUBLIC_CAPITAL_VAULT_TESTNET as `0x${string}` || null,
  mainnet: process.env.NEXT_PUBLIC_CAPITAL_VAULT_MAINNET as `0x${string}` || null,
} as const;

// x402 Payment Protocol Configuration
export const X402_CONFIG = {
  testnet: {
    network: 'eip155:10143' as const,
    facilitatorUrl: 'https://x402-facilitator.molandak.org',
    usdcAddress: '0x534b2f3A21130d7a60830c2Df862319e593943A3' as `0x${string}`,
    usdcName: 'USDC',
    usdcVersion: '2',
    usdcDecimals: 6,
  },
  mainnet: {
    network: 'eip155:143' as const,
    facilitatorUrl: 'https://x402-facilitator.molandak.org',
    usdcAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as `0x${string}`,
    usdcName: 'USDC',
    usdcVersion: '2',
    usdcDecimals: 6,
  },
} as const;

// Contract addresses by chain ID for easy lookup
export const ANOA_CONTRACTS = {
  10143: CONTRACTS.testnet, // Monad Testnet
  143: CONTRACTS.mainnet,   // Monad Mainnet
} as const;

// Helper to get contracts by chain ID
export function getContractsByChainId(chainId: number) {
  if (chainId === 10143) return CONTRACTS.testnet;
  if (chainId === 143) return CONTRACTS.mainnet;
  return CONTRACTS.testnet; // Default to testnet
}

// API URLs loaded from environment
export const API_URLS = {
  testnet: getApiUrl('testnet'),
  mainnet: getApiUrl('mainnet'),
} as const;

// Get current network configuration
export function getNetworkConfig() {
  const network = getCurrentNetwork();
  return {
    chain: network === 'mainnet' ? monadMainnet : monadTestnet,
    contracts: CONTRACTS[network],
    apiUrl: API_URLS[network],
    network,
  };
}

// Relay Protocol Contract Addresses on Monad
export const RELAY_CONTRACTS = {
  mainnet: {
    RELAY_ROUTER: '0x3eC130B627944cad9b2750300ECB0A695DA522B6' as `0x${string}`,
    RELAY_APPROVAL_PROXY: '0x58cC3e0aA6CD7bf795832A225179ec2d848cE3e7' as `0x${string}`,
    RELAY_RECEIVER: '0xf17902d51FdfF7Bf50AacB78d6bB399BaF88b479' as `0x${string}`,
  },
} as const;

// Monad-specific constants
export const MONAD_CONSTANTS = {
  BLOCK_TIME_MS: 400,
  FINALITY_MS: 800,
  TPS: 10000,
  MAX_CONTRACT_SIZE_KB: 128,
} as const;
