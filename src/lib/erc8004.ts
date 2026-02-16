/**
 * ERC-8004 Service
 *
 * Core library for interacting with ERC-8004 registries on Monad.
 * Handles agent identity registration, metadata, and reputation management.
 *
 * Registry Addresses (same for testnet/mainnet):
 * - Identity Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 * - Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
 * - Validation Registry: Coming Soon
 */

import {
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  fromHex,
  encodeFunctionData,
  encodePacked,
} from 'viem';
import type { HDAccount, PrivateKeyAccount } from 'viem/accounts';
import { ERC8004_REGISTRIES } from '@/config/chains';
import { identityRegistryAbi, reputationRegistryAbi } from '@/config/contracts';

// ============================================================================
// Types
// ============================================================================

export interface AgentMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  a2aEndpoint?: string;
  mcpEndpoint?: string;
  strategy?: string;
  riskLevel?: string;
  trustModels?: string[];
  chainId?: number;
  owner?: string;
  active?: boolean;
  x402Enabled?: boolean;
}

export interface MetadataEntry {
  key: string;
  value: `0x${string}`;
}

export interface RegisterOptions {
  tokenURI?: string;
  metadata?: MetadataEntry[];
}

export interface FeedbackData {
  value: bigint; // int128 - can be negative
  valueDecimals: number;
  tag1?: `0x${string}`; // bytes32
  tag2?: `0x${string}`; // bytes32
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: `0x${string}`;
}

export interface Feedback {
  value: bigint;
  valueDecimals: number;
  tag1: `0x${string}`;
  tag2: `0x${string}`;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  responseURI: string;
  responseHash: `0x${string}`;
  revoked: boolean;
}

export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

// ============================================================================
// Constants
// ============================================================================

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
const EMPTY_HASH = keccak256(toHex(''));

// Well-known metadata keys
export const METADATA_KEYS = {
  STRATEGY: 'strategy',
  A2A_ENDPOINT: 'a2aEndpoint',
  MCP_ENDPOINT: 'mcpEndpoint',
  X402_ENABLED: 'x402Enabled',
  ACTIVE: 'active',
  TRUST_MODEL: 'trustModel',
} as const;

// Tag constants for reputation
export const REPUTATION_TAGS = {
  // Category tags (tag1)
  TRADE_EXECUTION: keccak256(toHex('trade_execution')) as `0x${string}`,
  YIELD_PERFORMANCE: keccak256(toHex('yield_performance')) as `0x${string}`,
  RISK_MANAGEMENT: keccak256(toHex('risk_management')) as `0x${string}`,
  PRICE_ACCURACY: keccak256(toHex('price_accuracy')) as `0x${string}`,

  // Outcome tags (tag2)
  SUCCESS: keccak256(toHex('success')) as `0x${string}`,
  FAILURE: keccak256(toHex('failure')) as `0x${string}`,
  TIMEOUT: keccak256(toHex('timeout')) as `0x${string}`,
  SLIPPAGE_OK: keccak256(toHex('slippage_ok')) as `0x${string}`,
  SLIPPAGE_HIGH: keccak256(toHex('slippage_high')) as `0x${string}`,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert string to bytes32
 */
export function stringToBytes32(str: string): `0x${string}` {
  return keccak256(toHex(str)) as `0x${string}`;
}

/**
 * Encode metadata value
 */
export function encodeMetadataValue(value: string | number | boolean): `0x${string}` {
  if (typeof value === 'boolean') {
    return encodeAbiParameters(parseAbiParameters('bool'), [value]);
  }
  if (typeof value === 'number') {
    return encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(value)]);
  }
  return encodeAbiParameters(parseAbiParameters('string'), [value]);
}

/**
 * Decode metadata value
 */
export function decodeMetadataValue(data: `0x${string}`, type: 'string' | 'bool' | 'uint256'): string | boolean | bigint {
  if (type === 'bool') {
    return fromHex(data, 'number') !== 0;
  }
  if (type === 'uint256') {
    return fromHex(data, 'bigint');
  }
  // For string, strip the length prefix (first 64 chars after 0x)
  const hex = data.slice(130); // Skip 0x + 64 (offset) + 64 (length)
  const bytes = fromHex(`0x${hex}` as `0x${string}`, 'bytes');
  return new TextDecoder().decode(bytes).replace(/\x00+$/, '');
}

/**
 * Create agent metadata JSON for storage upload (Cloudflare R2)
 * Follows ERC-721 Metadata Standard + ERC-8004 extensions for NFT explorers
 */
export function createAgentMetadataJson(metadata: AgentMetadata): object {
  const chainId = metadata.chainId || 143;
  const isMainnet = chainId === 143;
  const networkName = isMainnet ? 'Monad Mainnet' : 'Monad Testnet';

  return {
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    ...(metadata.external_url ? { external_url: metadata.external_url } : {}),
    // ERC-721 standard attributes (display_type for NFT explorers)
    attributes: [
      ...(metadata.strategy ? [{ trait_type: 'Strategy', value: metadata.strategy }] : []),
      ...(metadata.riskLevel ? [{ trait_type: 'Risk Level', value: metadata.riskLevel }] : []),
      ...(metadata.trustModels?.length ? [{ trait_type: 'Trust Models', value: metadata.trustModels.join(', ') }] : []),
      ...(metadata.a2aEndpoint ? [{ trait_type: 'A2A Endpoint', value: metadata.a2aEndpoint }] : []),
      ...(metadata.mcpEndpoint ? [{ trait_type: 'MCP Endpoint', value: metadata.mcpEndpoint }] : []),
      { trait_type: 'Chain', value: networkName },
      { trait_type: 'Chain ID', value: chainId, display_type: 'number' },
      { trait_type: 'Active', value: metadata.active ?? true },
      { trait_type: 'x402 Enabled', value: metadata.x402Enabled ?? !!process.env.PAY_TO_ADDRESS },
      { trait_type: 'Created', value: Math.floor(Date.now() / 1000), display_type: 'date' },
    ],
    // ERC-8004 specific fields
    erc8004: {
      chainId,
      identityRegistry: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
      reputationRegistry: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
      trustModels: metadata.trustModels || ['reputation'],
      registrations: [
        ...(metadata.a2aEndpoint ? [{ type: 'a2a', endpoint: metadata.a2aEndpoint, version: '0.3.0' }] : []),
        ...(metadata.mcpEndpoint ? [{ type: 'mcp', endpoint: metadata.mcpEndpoint, version: '1.0.0' }] : []),
      ],
    },
  };
}

// ============================================================================
// Identity Registry Functions
// ============================================================================

/**
 * Register a new agent (simple - no URI)
 */
export async function registerAgent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  options?: RegisterOptions
): Promise<{ hash: Hash; agentId?: bigint }> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  let hash: Hash;

  if (options?.tokenURI && options?.metadata && options.metadata.length > 0) {
    // Register with URI and metadata
    const data = encodeFunctionData({
      abi: identityRegistryAbi,
      functionName: 'register',
      args: [options.tokenURI, options.metadata],
    });

    hash = await walletClient.sendTransaction({
      to: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
      data,
      account,
      chain: walletClient.chain,
    });
  } else if (options?.tokenURI) {
    // Register with URI only
    const data = encodeFunctionData({
      abi: identityRegistryAbi,
      functionName: 'register',
      args: [options.tokenURI],
    });

    hash = await walletClient.sendTransaction({
      to: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
      data,
      account,
      chain: walletClient.chain,
    });
  } else {
    // Register without URI
    const data = encodeFunctionData({
      abi: identityRegistryAbi,
      functionName: 'register',
      args: [],
    });

    hash = await walletClient.sendTransaction({
      to: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
      data,
      account,
      chain: walletClient.chain,
    });
  }

  // Wait for receipt and extract agentId from logs
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const registryAddr = ERC8004_REGISTRIES.IDENTITY_REGISTRY.toLowerCase();

  // Method 1: Find ERC-8004 Registered(uint256 indexed agentId, address indexed owner) event
  let agentId: bigint | undefined;
  const registeredTopic = keccak256(toHex('Registered(uint256,address)'));
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === registryAddr) {
      if (log.topics[0] === registeredTopic && log.topics[1]) {
        agentId = BigInt(log.topics[1]);
        break;
      }
    }
  }

  // Method 2: Fallback to ERC-721 Transfer(address,address,uint256) event (minting from address(0))
  if (!agentId) {
    const transferTopic = keccak256(toHex('Transfer(address,address,uint256)'));
    const ZERO_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === registryAddr) {
        if (log.topics[0] === transferTopic && log.topics.length >= 4 && log.topics[1] === ZERO_TOPIC) {
          // topics[3] = tokenId (agentId) for mint events
          agentId = BigInt(log.topics[3]!);
          break;
        }
      }
    }
  }

  // Method 3: Last resort — any log from registry with indexed uint256
  if (!agentId) {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === registryAddr && log.topics.length >= 2 && log.topics[1]) {
        try {
          const candidate = BigInt(log.topics[1]);
          if (candidate > 0n) {
            agentId = candidate;
            break;
          }
        } catch { /* not a valid uint256 */ }
      }
    }
  }

  return { hash, agentId };
}

/**
 * Set agent URI (for updating metadata link)
 */
export async function setAgentURI(
  walletClient: WalletClient,
  agentId: bigint,
  newURI: string
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'setAgentURI',
    args: [agentId, newURI],
    account,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Set metadata key-value pair
 */
export async function setAgentMetadata(
  walletClient: WalletClient,
  agentId: bigint,
  key: string,
  value: `0x${string}`
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'setMetadata',
    args: [agentId, key, value],
    account,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Get agent token URI
 */
export async function getAgentURI(
  publicClient: PublicClient,
  agentId: bigint
): Promise<string> {
  const uri = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'tokenURI',
    args: [agentId],
  });

  return uri as string;
}

/**
 * Get agent owner
 */
export async function getAgentOwner(
  publicClient: PublicClient,
  agentId: bigint
): Promise<Address> {
  const owner = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'ownerOf',
    args: [agentId],
  });

  return owner as Address;
}

/**
 * Get agent wallet
 */
export async function getAgentWallet(
  publicClient: PublicClient,
  agentId: bigint
): Promise<Address> {
  const wallet = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'getAgentWallet',
    args: [agentId],
  });

  return wallet as Address;
}

/**
 * Generate consent signature from the agent wallet for setAgentWallet.
 * The newWallet signs a message proving it consents to being linked to the agentId.
 * Called server-side using the HD-derived agent wallet private key.
 */
export async function generateWalletConsentSignature(
  agentWalletAccount: HDAccount | PrivateKeyAccount,
  agentId: bigint,
  deadline: bigint,
  chainId: number,
): Promise<`0x${string}`> {
  // EIP-712 typed data signature for setAgentWallet consent
  return agentWalletAccount.signTypedData({
    domain: {
      name: 'ERC8004Identity',
      version: '1',
      chainId,
      verifyingContract: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    },
    types: {
      SetAgentWallet: [
        { name: 'agentId', type: 'uint256' },
        { name: 'newWallet', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'SetAgentWallet',
    message: {
      agentId,
      newWallet: agentWalletAccount.address,
      deadline,
    },
  });
}

/**
 * Call setAgentWallet on Identity Registry to link agent wallet on-chain.
 * Must be called by agent owner (the user who minted the NFT).
 * The signature is generated server-side from the agent wallet's private key.
 */
export async function setAgentWalletOnChain(
  walletClient: WalletClient,
  agentId: bigint,
  newWallet: Address,
  deadline: bigint,
  signature: `0x${string}`,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  return walletClient.writeContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'setAgentWallet',
    args: [agentId, newWallet, deadline, signature],
    account,
    chain: walletClient.chain,
  });
}

/**
 * Get metadata value
 */
export async function getAgentMetadata(
  publicClient: PublicClient,
  agentId: bigint,
  key: string
): Promise<`0x${string}`> {
  const value = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'getMetadata',
    args: [agentId, key],
  });

  return value as `0x${string}`;
}

/**
 * Check if address is authorized for agent
 */
export async function isAuthorizedOrOwner(
  publicClient: PublicClient,
  spender: Address,
  agentId: bigint
): Promise<boolean> {
  const authorized = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'isAuthorizedOrOwner',
    args: [spender, agentId],
  });

  return authorized as boolean;
}

/**
 * Get number of agents owned by address
 */
export async function getAgentBalance(
  publicClient: PublicClient,
  owner: Address
): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'balanceOf',
    args: [owner],
  });

  return balance as bigint;
}

// ============================================================================
// Reputation Registry Functions
// ============================================================================

/**
 * Give feedback to an agent
 *
 * @param agentId - The agent's token ID
 * @param feedbackData - Feedback details including value, tags, and URI
 */
export async function giveFeedback(
  walletClient: WalletClient,
  agentId: bigint,
  feedbackData: FeedbackData
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [
      agentId,
      feedbackData.value,
      feedbackData.valueDecimals,
      feedbackData.tag1 ?? ZERO_BYTES32,
      feedbackData.tag2 ?? ZERO_BYTES32,
      feedbackData.endpoint ?? '',
      feedbackData.feedbackURI ?? '',
      feedbackData.feedbackHash ?? EMPTY_HASH,
    ],
    account,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Get reputation summary for an agent
 *
 * @param agentId - The agent's token ID
 * @param clientAddresses - Filter by specific clients (empty array for all)
 * @param tag1 - Filter by category tag (optional)
 * @param tag2 - Filter by outcome tag (optional)
 */
export async function getReputationSummary(
  publicClient: PublicClient,
  agentId: bigint,
  clientAddresses: Address[] = [],
  tag1?: `0x${string}`,
  tag2?: `0x${string}`
): Promise<ReputationSummary> {
  const result = await publicClient.readContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [agentId, clientAddresses, tag1 ?? ZERO_BYTES32, tag2 ?? ZERO_BYTES32],
  });

  const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];

  return {
    count,
    summaryValue,
    summaryValueDecimals,
  };
}

/**
 * Read single feedback
 */
export async function readFeedback(
  publicClient: PublicClient,
  agentId: bigint,
  clientAddress: Address,
  feedbackIndex: bigint
): Promise<Feedback> {
  const feedback = await publicClient.readContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'readFeedback',
    args: [agentId, clientAddress, feedbackIndex],
  });

  return feedback as Feedback;
}

/**
 * Read all feedback for an agent
 */
export async function readAllFeedback(
  publicClient: PublicClient,
  agentId: bigint,
  clientAddresses: Address[] = [],
  tag1?: `0x${string}`,
  tag2?: `0x${string}`,
  includeRevoked: boolean = false
): Promise<Feedback[]> {
  const feedbacks = await publicClient.readContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'readAllFeedback',
    args: [
      agentId,
      clientAddresses,
      tag1 ?? ZERO_BYTES32,
      tag2 ?? ZERO_BYTES32,
      includeRevoked,
    ],
  });

  return feedbacks as Feedback[];
}

/**
 * Revoke own feedback
 */
export async function revokeFeedback(
  walletClient: WalletClient,
  agentId: bigint,
  feedbackIndex: bigint
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'revokeFeedback',
    args: [agentId, feedbackIndex],
    account,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Agent responds to feedback
 */
export async function appendResponse(
  walletClient: WalletClient,
  agentId: bigint,
  clientAddress: Address,
  feedbackIndex: bigint,
  responseURI: string,
  responseHash?: `0x${string}`
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'appendResponse',
    args: [agentId, clientAddress, feedbackIndex, responseURI, responseHash ?? EMPTY_HASH],
    account,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Get all clients who gave feedback to agent
 */
export async function getFeedbackClients(
  publicClient: PublicClient,
  agentId: bigint
): Promise<Address[]> {
  const clients = await publicClient.readContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getClients',
    args: [agentId],
  });

  return clients as Address[];
}

/**
 * Get last feedback index for specific client
 */
export async function getLastFeedbackIndex(
  publicClient: PublicClient,
  agentId: bigint,
  clientAddress: Address
): Promise<bigint> {
  const index = await publicClient.readContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getLastIndex',
    args: [agentId, clientAddress],
  });

  return index as bigint;
}

// ============================================================================
// Helper: Calculate reputation score from summary
// ============================================================================

/**
 * Convert reputation summary to normalized score (0-100)
 *
 * The ERC-8004 reputation uses signed int128 with decimals.
 * This helper normalizes it to a 0-100 scale for display.
 */
export function calculateReputationScore(summary: ReputationSummary): number {
  if (summary.count === 0n) return 50; // Default neutral score

  const divisor = 10n ** BigInt(summary.summaryValueDecimals);
  const normalizedValue = Number(summary.summaryValue) / Number(divisor);

  // Assuming value represents cumulative score, calculate average
  const average = normalizedValue / Number(summary.count);

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(average)));
}

/**
 * Create feedback value for trade result
 *
 * @param profit - Profit/loss percentage (e.g., 5.25 for 5.25% profit, -2.5 for 2.5% loss)
 * @param decimals - Decimal precision (default 2)
 */
export function createTradeResultFeedback(
  profit: number,
  decimals: number = 2
): { value: bigint; valueDecimals: number } {
  const multiplier = 10 ** decimals;
  const value = BigInt(Math.round(profit * multiplier));

  return {
    value,
    valueDecimals: decimals,
  };
}
