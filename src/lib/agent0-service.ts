/**
 * Agent0 SDK Service (Server-Side)
 *
 * Integrates agent0-sdk for ERC-8004 operations on Monad.
 * Monad is not yet officially listed in agent0-sdk defaults,
 * but the contracts use deterministic addresses (same across all chains).
 *
 * This service handles:
 * - Agent registration with HTTP URI (Cloudflare R2)
 * - Feedback submission (automated from trade outcomes)
 * - Agent search and discovery
 * - Reputation queries
 *
 * For client-side (user wallet signing), we keep the wagmi hooks
 * in src/hooks/useERC8004.ts
 */

import { SDK } from 'agent0-sdk';
import { getRpcUrl, getCurrentNetwork } from '@/lib/config';
import { getAgentAccount } from '@/lib/agent-wallet';

// ERC-8004 Registry addresses (deterministic, same on all EVM chains)
const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';

// Monad chain configurations (RPC URLs from centralized config, not hardcoded)
const MONAD_CHAINS = {
  mainnet: {
    chainId: 143,
    rpcUrl: getRpcUrl('mainnet'),
  },
  testnet: {
    chainId: 10143,
    rpcUrl: getRpcUrl('testnet'),
  },
} as const;

// Determine network
const network = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const chainConfig = MONAD_CHAINS[network];

/**
 * Create a read-only SDK instance (no private key needed)
 * Used for: search, getAgent, getReputationSummary
 */
export function createReadOnlySDK(): SDK {
  return new SDK({
    chainId: chainConfig.chainId,
    rpcUrl: chainConfig.rpcUrl,
    // No IPFS needed - we use Cloudflare R2 via registerHTTP()
  });
}

/**
 * Create a write-enabled SDK instance (requires private key)
 * Used for: automated feedback, server-side registration
 *
 * IMPORTANT: Only use on server-side (API routes), never in browser
 */
export function createWriteSDK(privateKey?: string): SDK {
  const key = privateKey || process.env.AGENT_PRIVATE_KEY;

  if (!key) {
    throw new Error('Private key required for write operations. Set AGENT_PRIVATE_KEY in .env');
  }

  return new SDK({
    chainId: chainConfig.chainId,
    rpcUrl: chainConfig.rpcUrl,
    privateKey: key,
    // No IPFS - we use R2 + registerHTTP()
  });
}

/**
 * Create an agent and register with HTTP URI (Cloudflare R2)
 *
 * Flow:
 * 1. Upload metadata JSON to Cloudflare R2 (via /api/metadata)
 * 2. Create agent with agent0-sdk
 * 3. Register on-chain with registerHTTP(r2Url)
 */
export async function registerAgentWithR2(params: {
  name: string;
  description: string;
  image: string;
  metadataUrl: string; // Cloudflare R2 public URL
  a2aEndpoint?: string;
  mcpEndpoint?: string;
  trustModels?: {
    reputation?: boolean;
    cryptoEconomic?: boolean;
    teeAttestation?: boolean;
  };
  privateKey?: string;
}) {
  const sdk = createWriteSDK(params.privateKey);

  // Create agent
  const agent = sdk.createAgent(params.name, params.description, params.image);

  // Configure endpoints
  if (params.a2aEndpoint) {
    await agent.setA2A(params.a2aEndpoint);
  }
  if (params.mcpEndpoint) {
    await agent.setMCP(params.mcpEndpoint);
  }

  // Set trust models
  const trust = params.trustModels || { reputation: true };
  agent.setTrust(
    trust.reputation ?? true,
    trust.cryptoEconomic ?? false,
    trust.teeAttestation ?? false
  );

  // Add OASF skills and domains for hackathon
  agent.addSkill('advanced_reasoning_planning/strategic_planning', true);
  agent.addDomain('finance_and_business/investment_services', true);

  agent.setActive(true);

  // Register on-chain with HTTP URI (Cloudflare R2)
  const regTx = await agent.registerHTTP(params.metadataUrl);
  const { receipt, result } = await regTx.waitConfirmed();

  return {
    agentId: result.agentId,
    agentURI: result.agentURI,
    txHash: receipt.transactionHash,
  };
}

/**
 * Submit feedback to Reputation Registry
 * Called automatically after trade executions
 *
 * Uses the agent's own HD wallet for signing (derived from AGENT_MASTER_SEED).
 * Falls back to AGENT_PRIVATE_KEY if agentDbId is not provided.
 */
export async function submitFeedback(params: {
  agentId: string; // Format: "chainId:tokenId" e.g. "143:42"
  agentDbId?: string; // Prisma Agent.id — used to derive HD wallet key
  value: number; // Feedback value (e.g. 85 for good trade, -50 for bad)
  tag1?: string; // e.g. "trade_execution"
  tag2?: string; // e.g. "success" or "failure"
  endpoint?: string; // e.g. trade tx hash
  feedbackUri?: string; // R2 URL to detailed feedback JSON
  privateKey?: string;
}) {
  // Derive agent-specific private key if agentDbId provided
  let signingKey = params.privateKey;
  if (!signingKey && params.agentDbId) {
    try {
      const account = await getAgentAccount(params.agentDbId);
      // HDAccount from viem exposes the private key through the account
      // createWriteSDK expects a hex private key string
      signingKey = (account as unknown as { privateKey?: string }).privateKey;
    } catch {
      // Fall through to createWriteSDK default (AGENT_PRIVATE_KEY)
    }
  }

  const sdk = createWriteSDK(signingKey);

  const tx = await sdk.giveFeedback(
    params.agentId,
    params.value,
    params.tag1 || '',
    params.tag2 || '',
    params.endpoint || '',
    params.feedbackUri ? { uri: params.feedbackUri } : undefined
  );

  const { receipt, result: feedback } = await tx.waitConfirmed();

  return {
    txHash: receipt.transactionHash,
    feedback,
  };
}

/**
 * Search agents registered on ERC-8004
 */
export async function searchAgents(filters?: {
  name?: string;
  active?: boolean;
  x402support?: boolean;
  hasA2A?: boolean;
  hasMCP?: boolean;
}) {
  const sdk = createReadOnlySDK();

  const results = await sdk.searchAgents({
    ...filters,
    chains: [chainConfig.chainId],
  });

  return results;
}

/**
 * Get a specific agent by ID
 */
export async function getAgent(agentId: string) {
  const sdk = createReadOnlySDK();
  return sdk.getAgent(agentId);
}

/**
 * Get reputation summary for an agent
 */
export async function getReputationSummary(agentId: string) {
  const sdk = createReadOnlySDK();
  return sdk.getReputationSummary(agentId);
}

/**
 * Search feedback for an agent
 */
export async function searchFeedback(params: {
  agentId: string;
  minValue?: number;
  maxValue?: number;
  tag1?: string;
  tag2?: string;
}) {
  const sdk = createReadOnlySDK();
  return sdk.searchFeedback({
    agentId: params.agentId,
    ...(params.minValue !== undefined && { minValue: params.minValue }),
    ...(params.maxValue !== undefined && { maxValue: params.maxValue }),
    ...(params.tag1 && { tag1: params.tag1 }),
    ...(params.tag2 && { tag2: params.tag2 }),
  });
}

// Export constants for use elsewhere
export { IDENTITY_REGISTRY, REPUTATION_REGISTRY, MONAD_CHAINS, chainConfig };
