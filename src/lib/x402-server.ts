/**
 * x402 Payment Server Configuration for Monad
 *
 * Based on official Monad x402 guide:
 * https://docs.monad.xyz/guides/x402-guide
 *
 * This module sets up the x402 resource server with Monad's facilitator.
 * Used to protect API endpoints (e.g. /api/a2a) with micropayments.
 *
 * Payment flow:
 * 1. Client sends request to protected endpoint
 * 2. Server returns 402 + payment requirements JSON
 * 3. Client signs EIP-712 USDC transfer authorization
 * 4. Facilitator verifies signature and settles payment (covers gas)
 * 5. Server serves the content
 */

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { Network } from '@x402/core/types';

// Monad network configuration
const MONAD_NETWORKS = {
  testnet: {
    network: 'eip155:10143' as Network,
    usdc: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    usdcName: 'USDC',
    usdcVersion: '2',
  },
  mainnet: {
    network: 'eip155:143' as Network,
    usdc: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    usdcName: 'USDC',
    usdcVersion: '2',
  },
} as const;

// Monad facilitator URL (supports both testnet and mainnet)
const FACILITATOR_URL = 'https://x402-facilitator.molandak.org';

// Determine current network
const currentNetwork = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const networkConfig = MONAD_NETWORKS[currentNetwork];

/**
 * Create and configure x402 resource server for Monad
 */
export function createX402Server() {
  // Create facilitator client
  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

  // Create x402 resource server
  const server = new x402ResourceServer(facilitatorClient);

  // Create Exact EVM Scheme with custom money parser for Monad USDC
  const monadScheme = new ExactEvmScheme();
  monadScheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === networkConfig.network) {
      // Convert decimal amount to USDC smallest units (6 decimals)
      const tokenAmount = Math.floor(amount * 1_000_000).toString();
      return {
        amount: tokenAmount,
        asset: networkConfig.usdc,
        extra: {
          name: networkConfig.usdcName,
          version: networkConfig.usdcVersion,
        },
      };
    }
    return null;
  });

  // Register network with custom scheme
  server.register(networkConfig.network, monadScheme);

  return server;
}

/**
 * Get x402 route configuration for protecting an endpoint
 *
 * @param payToAddress - Wallet address to receive payments
 * @param price - Price in USD (e.g. "$0.001")
 * @param resource - Resource URL
 * @param description - Description of the resource
 */
export function getRouteConfig(
  payToAddress: string,
  price?: string,
  resource?: string,
  description?: string
) {
  const resolvedPrice = price || process.env.X402_PRICE || '$0.001';
  return {
    accepts: {
      scheme: 'exact' as const,
      network: networkConfig.network,
      payTo: payToAddress,
      price: resolvedPrice,
    },
    resource: resource || '/api/a2a',
    description: description || 'ANOA Agent A2A Endpoint',
    mimeType: 'application/json' as const,
  };
}

// Export configuration for use in other modules
export {
  FACILITATOR_URL,
  MONAD_NETWORKS,
  networkConfig,
  currentNetwork,
};
