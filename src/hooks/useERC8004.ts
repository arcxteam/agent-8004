/**
 * ERC-8004 React Hooks
 *
 * React hooks for interacting with ERC-8004 registries on Monad.
 * Uses wagmi for state management and transaction handling.
 *
 * Usage:
 *   const { register, isPending, isSuccess } = useRegisterAgent();
 *   const { data: summary } = useAgentReputation(agentId);
 */

'use client';

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount, useReadContract, useWriteContract } from 'wagmi';
import { type Address, type Hash } from 'viem';
import { ERC8004_REGISTRIES } from '@/config/chains';
import { identityRegistryAbi, reputationRegistryAbi } from '@/config/contracts';
import {
  type RegisterOptions,
  type FeedbackData,
  type ReputationSummary,
  type Feedback,
  calculateReputationScore,
  REPUTATION_TAGS,
  METADATA_KEYS,
} from '@/lib/erc8004';

// ============================================================================
// Identity Registry Hooks
// ============================================================================

/**
 * Hook to register a new agent on ERC-8004 Identity Registry
 *
 * @example
 * const { register, isPending, isSuccess, agentId, error } = useRegisterAgent();
 *
 * const handleRegister = async () => {
 *   await register({ tokenURI: 'https://r2.example.com/agents/...' });
 * };
 */
export function useRegisterAgent() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hash, setHash] = useState<Hash | null>(null);
  const [agentId, setAgentId] = useState<bigint | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const register = useCallback(
    async (options?: RegisterOptions) => {
      if (!walletClient || !publicClient || !address) {
        throw new Error('Wallet not connected');
      }

      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      setAgentId(null);
      setHash(null);

      try {
        // Import the function dynamically to avoid circular deps
        const { registerAgent } = await import('@/lib/erc8004');

        const result = await registerAgent(publicClient, walletClient, options);

        setHash(result.hash);
        if (result.agentId) {
          setAgentId(result.agentId);
        }
        setIsSuccess(true);

        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient, address]
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setHash(null);
    setAgentId(null);
    setError(null);
  }, []);

  return {
    register,
    isPending,
    isSuccess,
    hash,
    agentId,
    error,
    reset,
  };
}

/**
 * Hook to get agent URI (metadata link)
 */
export function useAgentURI(agentId: bigint | undefined, enabled = true) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'tokenURI',
    args: agentId ? [agentId] : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to get agent owner
 */
export function useAgentOwner(agentId: bigint | undefined, enabled = true) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'ownerOf',
    args: agentId ? [agentId] : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to get agent's associated wallet
 */
export function useAgentWallet(agentId: bigint | undefined, enabled = true) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'getAgentWallet',
    args: agentId ? [agentId] : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to get specific metadata value
 */
export function useAgentMetadata(
  agentId: bigint | undefined,
  key: string,
  enabled = true
) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'getMetadata',
    args: agentId ? [agentId, key] : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to check if address is authorized for agent
 */
export function useIsAuthorizedOrOwner(
  spender: Address | undefined,
  agentId: bigint | undefined,
  enabled = true
) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'isAuthorizedOrOwner',
    args: spender && agentId ? [spender, agentId] : undefined,
    query: {
      enabled: enabled && spender !== undefined && agentId !== undefined,
    },
  });
}

/**
 * Hook to get number of agents owned by address
 */
export function useAgentBalance(owner: Address | undefined, enabled = true) {
  return useReadContract({
    address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: enabled && owner !== undefined,
    },
  });
}

/**
 * Hook to set agent URI (update metadata link)
 */
export function useSetAgentURI() {
  const { writeContract, isPending, isSuccess, data: hash, error } = useWriteContract();

  const setAgentURI = useCallback(
    async (agentId: bigint, newURI: string) => {
      return writeContract({
        address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'setAgentURI',
        args: [agentId, newURI],
      });
    },
    [writeContract]
  );

  return {
    setAgentURI,
    isPending,
    isSuccess,
    hash,
    error,
  };
}

/**
 * Hook to set agent metadata
 */
export function useSetAgentMetadata() {
  const { writeContract, isPending, isSuccess, data: hash, error } = useWriteContract();

  const setMetadata = useCallback(
    async (agentId: bigint, key: string, value: `0x${string}`) => {
      return writeContract({
        address: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'setMetadata',
        args: [agentId, key, value],
      });
    },
    [writeContract]
  );

  return {
    setMetadata,
    isPending,
    isSuccess,
    hash,
    error,
  };
}

// ============================================================================
// Reputation Registry Hooks
// ============================================================================

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Hook to get reputation summary for an agent
 *
 * @example
 * const { data: summary, score } = useAgentReputation(agentId);
 * console.log(`Score: ${score}/100, ${summary?.count} feedbacks`);
 */
export function useAgentReputation(
  agentId: bigint | undefined,
  clientAddresses: Address[] = [],
  tag1?: `0x${string}`,
  tag2?: `0x${string}`,
  enabled = true
) {
  const result = useReadContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: agentId
      ? [agentId, clientAddresses, tag1 ?? ZERO_BYTES32, tag2 ?? ZERO_BYTES32]
      : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });

  // Parse the result into ReputationSummary
  const summary = result.data
    ? {
        count: (result.data as readonly [bigint, bigint, number])[0],
        summaryValue: (result.data as readonly [bigint, bigint, number])[1],
        summaryValueDecimals: (result.data as readonly [bigint, bigint, number])[2],
      }
    : undefined;

  // Calculate normalized score
  const score = summary ? calculateReputationScore(summary) : 50;

  return {
    ...result,
    summary,
    score,
  };
}

/**
 * Hook to give feedback to an agent
 *
 * @example
 * const { giveFeedback, isPending } = useGiveFeedback();
 *
 * await giveFeedback(agentId, {
 *   value: 100n, // e.g., 1.00 with 2 decimals
 *   valueDecimals: 2,
 *   tag1: REPUTATION_TAGS.TRADE_EXECUTION,
 *   tag2: REPUTATION_TAGS.SUCCESS,
 * });
 */
export function useGiveFeedback() {
  const { writeContract, isPending, isSuccess, data: hash, error } = useWriteContract();

  const giveFeedback = useCallback(
    async (agentId: bigint, feedbackData: FeedbackData) => {
      const { keccak256, toHex } = await import('viem');
      const EMPTY_HASH = keccak256(toHex(''));

      return writeContract({
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
      });
    },
    [writeContract]
  );

  return {
    giveFeedback,
    isPending,
    isSuccess,
    hash,
    error,
  };
}

/**
 * Hook to read all feedback for an agent
 */
export function useAgentFeedback(
  agentId: bigint | undefined,
  clientAddresses: Address[] = [],
  tag1?: `0x${string}`,
  tag2?: `0x${string}`,
  includeRevoked = false,
  enabled = true
) {
  return useReadContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'readAllFeedback',
    args: agentId
      ? [agentId, clientAddresses, tag1 ?? ZERO_BYTES32, tag2 ?? ZERO_BYTES32, includeRevoked]
      : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to get all clients who gave feedback
 */
export function useFeedbackClients(agentId: bigint | undefined, enabled = true) {
  return useReadContract({
    address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getClients',
    args: agentId ? [agentId] : undefined,
    query: {
      enabled: enabled && agentId !== undefined,
    },
  });
}

/**
 * Hook to revoke own feedback
 */
export function useRevokeFeedback() {
  const { writeContract, isPending, isSuccess, data: hash, error } = useWriteContract();

  const revokeFeedback = useCallback(
    async (agentId: bigint, feedbackIndex: bigint) => {
      return writeContract({
        address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: 'revokeFeedback',
        args: [agentId, feedbackIndex],
      });
    },
    [writeContract]
  );

  return {
    revokeFeedback,
    isPending,
    isSuccess,
    hash,
    error,
  };
}

/**
 * Hook for agent to respond to feedback
 */
export function useAppendResponse() {
  const { writeContract, isPending, isSuccess, data: hash, error } = useWriteContract();

  const appendResponse = useCallback(
    async (
      agentId: bigint,
      clientAddress: Address,
      feedbackIndex: bigint,
      responseURI: string,
      responseHash?: `0x${string}`
    ) => {
      const { keccak256, toHex } = await import('viem');
      const EMPTY_HASH = keccak256(toHex(''));

      return writeContract({
        address: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: 'appendResponse',
        args: [agentId, clientAddress, feedbackIndex, responseURI, responseHash ?? EMPTY_HASH],
      });
    },
    [writeContract]
  );

  return {
    appendResponse,
    isPending,
    isSuccess,
    hash,
    error,
  };
}

// ============================================================================
// Combined Hooks
// ============================================================================

/**
 * Hook to get full agent details including identity and reputation
 */
export function useAgentDetails(agentId: bigint | undefined, enabled = true) {
  const uri = useAgentURI(agentId, enabled);
  const owner = useAgentOwner(agentId, enabled);
  const wallet = useAgentWallet(agentId, enabled);
  const reputation = useAgentReputation(agentId, [], undefined, undefined, enabled);

  const isLoading = uri.isLoading || owner.isLoading || wallet.isLoading || reputation.isLoading;
  const error = uri.error || owner.error || wallet.error || reputation.error;

  return {
    agentId,
    uri: uri.data as string | undefined,
    owner: owner.data as Address | undefined,
    wallet: wallet.data as Address | undefined,
    reputation: reputation.summary,
    score: reputation.score,
    isLoading,
    error,
    refetch: () => {
      uri.refetch();
      owner.refetch();
      wallet.refetch();
      reputation.refetch();
    },
  };
}

// Re-export constants for convenience
export { REPUTATION_TAGS, METADATA_KEYS };
