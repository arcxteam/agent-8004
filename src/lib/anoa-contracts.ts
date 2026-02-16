/**
 * ANOA Protocol Contracts Service
 *
 * Library for interacting with ANOA custom contracts on Monad.
 * These contracts provide extended functionality beyond the official ERC-8004 registries:
 *
 * - AnoaAgentIdentity: Extended identity with handles, capabilities, operator delegation
 * - AnoaAgentReputation: 0-100 score system with validator weights
 * - AnoaAgentValidator: Validation schemes (BASIC, STANDARD, ADVANCED)
 * - AnoaTrustlessAgentCore: Risk Router with TradeIntent execution
 *
 * IMPORTANT: These contracts need to be deployed before use.
 * Update ANOA_CONTRACTS in contracts.ts after deployment.
 */

import {
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  keccak256,
  toHex,
  parseEther,
} from 'viem';
import { ANOA_PROTOCOL_CONTRACTS, anoaAgentIdentityAbi, anoaAgentReputationAbi } from '@/config/contracts';
import { getCurrentNetwork } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

export interface AnoaAgentInfo {
  walletAddress: Address;
  metadataUri: string;
  registeredAt: bigint;
  isActive: boolean;
  operator: Address;
  capabilities: bigint;
  version: number;
}

export interface AnoaFeedback {
  clientAddress: Address;
  score: number;
  tag1: `0x${string}`;
  tag2: `0x${string}`;
  proofHash: `0x${string}`;
  timestamp: bigint;
  validatorWeight: bigint;
}

export interface AnoaReputationSummary {
  totalFeedbacks: bigint;
  averageScore: bigint;
  lastFeedbackAt: bigint;
  totalValidatorFeedbacks: bigint;
  validatorScoreSum: bigint;
}

export interface RegisterAnoaAgentParams {
  agentWallet: Address;
  handle: string;
  metadataUri: string;
  capabilities?: bigint;
}

// ============================================================================
// Constants
// ============================================================================

// Capability flags (bitmap)
export const ANOA_CAPABILITIES = {
  TRADING: 1n << 0n,        // Can execute trades
  YIELD: 1n << 1n,          // Can stake/farm
  LENDING: 1n << 2n,        // Can lend/borrow
  ARBITRAGE: 1n << 3n,      // Can do arbitrage
  MARKET_MAKING: 1n << 4n,  // Can provide liquidity
  A2A: 1n << 5n,            // Supports A2A protocol
  MCP: 1n << 6n,            // Supports MCP
  X402: 1n << 7n,           // Supports x402 payments
} as const;

// Tag constants for reputation (same keccak256 hashes)
export const ANOA_TAGS = {
  // Performance tags
  FAST_EXECUTION: keccak256(toHex('FAST_EXECUTION')) as `0x${string}`,
  PROFITABLE: keccak256(toHex('PROFITABLE')) as `0x${string}`,
  LOW_SLIPPAGE: keccak256(toHex('LOW_SLIPPAGE')) as `0x${string}`,
  HIGH_VOLUME: keccak256(toHex('HIGH_VOLUME')) as `0x${string}`,
  
  // Strategy tags
  MOMENTUM: keccak256(toHex('MOMENTUM')) as `0x${string}`,
  YIELD_FARMING: keccak256(toHex('YIELD_FARMING')) as `0x${string}`,
  ARBITRAGE: keccak256(toHex('ARBITRAGE')) as `0x${string}`,
  DCA: keccak256(toHex('DCA')) as `0x${string}`,
  GRID: keccak256(toHex('GRID')) as `0x${string}`,
  HEDGE: keccak256(toHex('HEDGE')) as `0x${string}`,
  
  // Outcome tags
  SUCCESS: keccak256(toHex('SUCCESS')) as `0x${string}`,
  FAILURE: keccak256(toHex('FAILURE')) as `0x${string}`,
  PARTIAL: keccak256(toHex('PARTIAL')) as `0x${string}`,
} as const;

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get ANOA contract addresses for current network
 */
function getAnoaContracts() {
  const network = getCurrentNetwork();
  return ANOA_PROTOCOL_CONTRACTS[network];
}

/**
 * Check if ANOA contracts are deployed
 */
export function areAnoaContractsDeployed(): boolean {
  const contracts = getAnoaContracts();
  return contracts.AGENT_IDENTITY !== null;
}

/**
 * Combine multiple capability flags
 */
export function combineCapabilities(...caps: bigint[]): bigint {
  return caps.reduce((acc, cap) => acc | cap, 0n);
}

// ============================================================================
// Identity Registry Functions
// ============================================================================

/**
 * Register a new agent on ANOA Identity contract
 *
 * @param params Registration parameters
 * @param registrationFee Fee to pay (will be read from contract if not provided)
 */
export async function registerAnoaAgent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: RegisterAnoaAgentParams,
  registrationFee?: bigint
): Promise<{ hash: Hash; tokenId?: bigint }> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Get registration fee if not provided
  let fee = registrationFee;
  if (!fee) {
    fee = await publicClient.readContract({
      address: contracts.AGENT_IDENTITY,
      abi: anoaAgentIdentityAbi,
      functionName: 'registrationFee',
    }) as bigint;
  }

  const hash = await walletClient.writeContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'register',
    args: [
      params.agentWallet,
      params.handle,
      params.metadataUri,
      params.capabilities ?? 0n,
    ],
    value: fee,
    account,
    chain: walletClient.chain,
  });

  // Wait for receipt and extract tokenId from logs
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let tokenId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === contracts.AGENT_IDENTITY.toLowerCase()) {
      // AgentRegistered event topic
      const eventTopic = keccak256(
        toHex('AgentRegistered(uint256,address,address,string,string,uint256)')
      );
      if (log.topics[0] === eventTopic && log.topics[1]) {
        tokenId = BigInt(log.topics[1]);
        break;
      }
    }
  }

  return { hash, tokenId };
}

/**
 * Get agent info from ANOA Identity contract
 */
export async function getAnoaAgentInfo(
  publicClient: PublicClient,
  tokenId: bigint
): Promise<AnoaAgentInfo> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  const info = await publicClient.readContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'getMetadata',
    args: [tokenId],
  });

  return info as AnoaAgentInfo;
}

/**
 * Get agent by wallet address
 */
export async function getAnoaAgentByWallet(
  publicClient: PublicClient,
  wallet: Address
): Promise<bigint> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  const tokenId = await publicClient.readContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'getAgentByWallet',
    args: [wallet],
  });

  return tokenId as bigint;
}

/**
 * Update agent metadata URI
 */
export async function updateAnoaAgentMetadata(
  walletClient: WalletClient,
  tokenId: bigint,
  newMetadataUri: string
): Promise<Hash> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  return walletClient.writeContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'setMetadata',
    args: [tokenId, newMetadataUri],
    account,
    chain: walletClient.chain,
  });
}

/**
 * Deactivate agent
 */
export async function deactivateAnoaAgent(
  walletClient: WalletClient,
  tokenId: bigint
): Promise<Hash> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  return walletClient.writeContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'deactivate',
    args: [tokenId],
    account,
    chain: walletClient.chain,
  });
}

/**
 * Get total number of registered agents
 */
export async function getTotalAnoaAgents(
  publicClient: PublicClient
): Promise<bigint> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_IDENTITY) {
    throw new Error('ANOA Agent Identity contract not deployed');
  }

  return publicClient.readContract({
    address: contracts.AGENT_IDENTITY,
    abi: anoaAgentIdentityAbi,
    functionName: 'totalAgents',
  }) as Promise<bigint>;
}

// ============================================================================
// Reputation Registry Functions
// ============================================================================

/**
 * Give feedback to an agent (0-100 score)
 */
export async function giveAnoaFeedback(
  walletClient: WalletClient,
  agentId: bigint,
  score: number,
  tag1?: `0x${string}`,
  tag2?: `0x${string}`,
  proofHash?: `0x${string}`
): Promise<Hash> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  if (score < 0 || score > 100) {
    throw new Error('Score must be between 0 and 100');
  }

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  return walletClient.writeContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'giveFeedback',
    args: [
      agentId,
      score,
      tag1 ?? ZERO_BYTES32,
      tag2 ?? ZERO_BYTES32,
      proofHash ?? ZERO_BYTES32,
    ],
    account,
    chain: walletClient.chain,
  });
}

/**
 * Get reputation summary for an agent
 */
export async function getAnoaReputationSummary(
  publicClient: PublicClient,
  agentId: bigint
): Promise<{ totalFeedbacks: bigint; averageScore: bigint; lastFeedbackAt: bigint }> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  const result = await publicClient.readContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'getSummary',
    args: [agentId],
  });

  const [totalFeedbacks, averageScore, lastFeedbackAt] = result as [bigint, bigint, bigint];
  return { totalFeedbacks, averageScore, lastFeedbackAt };
}

/**
 * Get trust score (0-100 or 0 if insufficient feedbacks)
 */
export async function getAnoaTrustScore(
  publicClient: PublicClient,
  agentId: bigint
): Promise<bigint> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  return publicClient.readContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'getTrustScore',
    args: [agentId],
  }) as Promise<bigint>;
}

/**
 * Check if agent meets minimum reputation
 */
export async function hasMinimumAnoaReputation(
  publicClient: PublicClient,
  agentId: bigint,
  minScore: bigint
): Promise<boolean> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  return publicClient.readContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'hasMinimumReputation',
    args: [agentId, minScore],
  }) as Promise<boolean>;
}

/**
 * Get all feedbacks for an agent
 */
export async function getAnoaFeedbacks(
  publicClient: PublicClient,
  agentId: bigint
): Promise<AnoaFeedback[]> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  return publicClient.readContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'getFeedbacks',
    args: [agentId],
  }) as Promise<AnoaFeedback[]>;
}

/**
 * Get tag count for reputation
 */
export async function getAnoaTagCount(
  publicClient: PublicClient,
  agentId: bigint,
  tag: `0x${string}`
): Promise<bigint> {
  const contracts = getAnoaContracts();
  if (!contracts.AGENT_REPUTATION) {
    throw new Error('ANOA Agent Reputation contract not deployed');
  }

  return publicClient.readContract({
    address: contracts.AGENT_REPUTATION,
    abi: anoaAgentReputationAbi,
    functionName: 'getTagCount',
    args: [agentId, tag],
  }) as Promise<bigint>;
}

// ============================================================================
// Score Conversion Helpers
// ============================================================================

/**
 * Convert ANOA score (scaled by 100) to percentage
 */
export function anoaScoreToPercent(score: bigint): number {
  return Number(score) / 100;
}

/**
 * Convert percentage to ANOA score (0-100)
 */
export function percentToAnoaScore(percent: number): number {
  return Math.round(Math.max(0, Math.min(100, percent)));
}
