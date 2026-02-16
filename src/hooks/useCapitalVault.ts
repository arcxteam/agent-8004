/**
 * Capital Vault React Hooks
 *
 * React hooks for interacting with AnoaCapitalVault contract.
 * Handles capital delegation, withdrawals, and fee management.
 *
 * Architecture:
 * - Platform Fees (accumulatedFees) → Owner-only withdraw to Treasury
 * - User Capital (delegations) → User can withdraw to any wallet
 * - PnL Tracking → Tracked per agent, returned on withdrawal
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  usePublicClient, 
  useWalletClient, 
  useAccount, 
  useReadContract, 
  useWriteContract,
  useChainId,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { type Address, type Hash, parseEther, formatEther } from 'viem';
import { capitalVaultAbi } from '@/config/contracts';
import { CAPITAL_VAULT } from '@/config/chains';

// ============================================================================
// Types
// ============================================================================

export interface Delegation {
  delegationId: bigint;
  delegator: Address;
  agentId: bigint;
  amount: bigint;
  depositedAt: bigint;
  lockupEndsAt: bigint;
  isActive: boolean;
}

export interface FeeConfig {
  registrationFee: bigint;
  tradingFeeBps: bigint;
  withdrawalFeeBps: bigint;
  minCapital: bigint;
}

export interface VaultStats {
  totalDelegated: bigint;
  accumulatedFees: bigint;
  lockupPeriod: bigint;
}

// ============================================================================
// Helper: Get Vault Address by Chain
// ============================================================================

function getVaultAddress(chainId: number): Address | null {
  if (chainId === 143) return CAPITAL_VAULT.mainnet;
  if (chainId === 10143) return CAPITAL_VAULT.testnet;
  return null;
}

// ============================================================================
// Hook: useVaultAddress
// ============================================================================

export function useVaultAddress() {
  const chainId = useChainId();
  const address = useMemo(() => getVaultAddress(chainId), [chainId]);
  const isDeployed = !!address;
  
  return {
    address,
    isDeployed,
    chainId,
    network: chainId === 143 ? 'mainnet' : 'testnet',
  };
}

// ============================================================================
// Hook: useFeeConfig
// ============================================================================

export function useFeeConfig() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'feeConfig',
    query: {
      enabled: isDeployed,
    },
  });

  const feeConfig: FeeConfig | null = useMemo(() => {
    if (!data) return null;
    const [registrationFee, tradingFeeBps, withdrawalFeeBps, minCapital] = data;
    return {
      registrationFee,
      tradingFeeBps,
      withdrawalFeeBps,
      minCapital,
    };
  }, [data]);

  return {
    feeConfig,
    isLoading,
    error,
    refetch,
    // Formatted values for display
    registrationFeeMON: feeConfig ? Number(formatEther(feeConfig.registrationFee)) : 100,
    minCapitalMON: feeConfig ? Number(formatEther(feeConfig.minCapital)) : 100,
    tradingFeePercent: feeConfig ? Number(feeConfig.tradingFeeBps) / 100 : 0.5,
    withdrawalFeePercent: feeConfig ? Number(feeConfig.withdrawalFeeBps) / 100 : 0.1,
  };
}

// ============================================================================
// Hook: useVaultStats
// ============================================================================

export function useVaultStats() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();

  const { data: totalDelegated } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'totalDelegatedCapital',
    query: { enabled: isDeployed },
  });

  const { data: accumulatedFees } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'accumulatedFees',
    query: { enabled: isDeployed },
  });

  const { data: lockupPeriod } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'defaultLockupPeriod',
    query: { enabled: isDeployed },
  });

  return {
    totalDelegated: totalDelegated ?? 0n,
    accumulatedFees: accumulatedFees ?? 0n,
    lockupPeriod: lockupPeriod ?? 86400n, // Default 24 hours
    // Formatted values
    totalDelegatedMON: totalDelegated ? Number(formatEther(totalDelegated)) : 0,
    accumulatedFeesMON: accumulatedFees ? Number(formatEther(accumulatedFees)) : 0,
    lockupHours: lockupPeriod ? Number(lockupPeriod) / 3600 : 24,
  };
}

// ============================================================================
// Hook: useAgentCapital
// ============================================================================

export function useAgentCapital(agentId: bigint | undefined) {
  const { address: vaultAddress, isDeployed } = useVaultAddress();

  const { data, isLoading, refetch } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'agentCapital',
    args: agentId ? [agentId] : undefined,
    query: { enabled: isDeployed && !!agentId },
  });

  return {
    capital: data ?? 0n,
    capitalMON: data ? Number(formatEther(data)) : 0,
    isLoading,
    refetch,
  };
}

// ============================================================================
// Hook: useDelegatorDelegations
// ============================================================================

export function useDelegatorDelegations() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  const { data: delegationIds, isLoading, refetch } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'getDelegatorDelegations',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: isDeployed && !!userAddress },
  });

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Fetch delegation details
  const fetchDetails = useCallback(async () => {
    if (!delegationIds || !publicClient || !vaultAddress) return;
    setIsLoadingDetails(true);
    
    try {
      const details = await Promise.all(
        (delegationIds as bigint[]).map(async (id) => {
          const data = await publicClient.readContract({
            address: vaultAddress as Address,
            abi: capitalVaultAbi,
            functionName: 'delegations',
            args: [id],
          });
          
          const [delegator, agentId, amount, depositedAt, lockupEndsAt, isActive, accumulatedPnl] = data as unknown as [
            Address, bigint, bigint, bigint, bigint, boolean, bigint
          ];

          return {
            delegationId: id,
            delegator,
            agentId,
            amount,
            depositedAt,
            lockupEndsAt,
            isActive,
            accumulatedPnl,
          };
        })
      );
      
      setDelegations(details.filter(d => d.isActive));
    } catch (error) {
      console.error('Failed to fetch delegation details:', error);
    }
    setIsLoadingDetails(false);
  }, [delegationIds, publicClient, vaultAddress]);

  return {
    delegationIds: delegationIds ?? [],
    delegations,
    isLoading: isLoading || isLoadingDetails,
    refetch,
    fetchDetails,
    totalDelegated: delegations.reduce((sum, d) => sum + d.amount, 0n),
    totalDelegatedMON: delegations.reduce((sum, d) => sum + Number(formatEther(d.amount)), 0),
    activeDelegations: delegations.filter(d => d.isActive).length,
  };
}

// ============================================================================
// Hook: useDelegateCapital
// ============================================================================

export function useDelegateCapital() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hash, setHash] = useState<Hash | null>(null);
  const [delegationId, setDelegationId] = useState<bigint | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const delegate = useCallback(
    async (agentId: bigint, amountMON: number) => {
      if (!walletClient || !publicClient || !address || !vaultAddress) {
        throw new Error('Wallet not connected or vault not deployed');
      }

      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      setDelegationId(null);
      setHash(null);

      try {
        const amount = parseEther(amountMON.toString());

        // Write to contract
        const txHash = await walletClient.writeContract({
          address: vaultAddress,
          abi: capitalVaultAbi,
          functionName: 'delegateCapital',
          args: [agentId],
          value: amount,
        });

        setHash(txHash);

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Parse delegation ID from event logs
        const delegationEvent = receipt.logs.find((log) => {
          // Look for CapitalDelegated event
          return log.topics[0] === '0x' + 'CapitalDelegated'.slice(0, 64);
        });

        if (delegationEvent && delegationEvent.topics[1]) {
          setDelegationId(BigInt(delegationEvent.topics[1]));
        }

        setIsSuccess(true);
        return { hash: txHash, receipt };
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient, address, vaultAddress]
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setHash(null);
    setDelegationId(null);
    setError(null);
  }, []);

  return {
    delegate,
    isPending,
    isSuccess,
    hash,
    delegationId,
    error,
    reset,
    isReady: isDeployed && !!walletClient,
  };
}

// ============================================================================
// Hook: useWithdrawCapital
// ============================================================================

export function useWithdrawCapital() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hash, setHash] = useState<Hash | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const withdraw = useCallback(
    async (delegationId: bigint, recipient?: Address) => {
      if (!walletClient || !publicClient || !address || !vaultAddress) {
        throw new Error('Wallet not connected or vault not deployed');
      }

      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      setHash(null);

      try {
        // Default recipient is the user's own wallet
        const withdrawTo = recipient || address;

        // Write to contract
        const txHash = await walletClient.writeContract({
          address: vaultAddress,
          abi: capitalVaultAbi,
          functionName: 'withdrawCapital',
          args: [delegationId, withdrawTo],
        });

        setHash(txHash);

        // Wait for receipt
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setIsSuccess(true);
        return { hash: txHash };
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient, address, vaultAddress]
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setHash(null);
    setError(null);
  }, []);

  return {
    withdraw,
    isPending,
    isSuccess,
    hash,
    error,
    reset,
    isReady: isDeployed && !!walletClient,
  };
}

// ============================================================================
// Hook: usePayRegistrationFee
// ============================================================================

export function usePayRegistrationFee() {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { registrationFeeMON } = useFeeConfig();

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hash, setHash] = useState<Hash | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const payFee = useCallback(
    async (agentId: bigint) => {
      if (!walletClient || !publicClient || !address || !vaultAddress) {
        throw new Error('Wallet not connected or vault not deployed');
      }

      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      setHash(null);

      try {
        const fee = parseEther(registrationFeeMON.toString());

        // Write to contract
        const txHash = await walletClient.writeContract({
          address: vaultAddress,
          abi: capitalVaultAbi,
          functionName: 'payRegistrationFee',
          args: [agentId],
          value: fee,
        });

        setHash(txHash);

        // Wait for receipt
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setIsSuccess(true);
        return { hash: txHash };
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient, address, vaultAddress, registrationFeeMON]
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setHash(null);
    setError(null);
  }, []);

  return {
    payFee,
    isPending,
    isSuccess,
    hash,
    error,
    reset,
    fee: registrationFeeMON,
    isReady: isDeployed && !!walletClient,
  };
}

// ============================================================================
// Hook: useCalculateWithdrawalFee
// ============================================================================

export function useCalculateWithdrawalFee(amountMON: number) {
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const amount = parseEther(amountMON.toString());

  const { data, isLoading } = useReadContract({
    address: vaultAddress as Address,
    abi: capitalVaultAbi,
    functionName: 'calculateWithdrawalFee',
    args: [amount],
    query: { enabled: isDeployed && amountMON > 0 },
  });

  // Contract returns (amountAfterFee, fee) as a tuple
  const result = data as readonly [bigint, bigint] | undefined;
  const amountAfterFee = result?.[0] ?? 0n;
  const feeValue = result?.[1] ?? 0n;

  return {
    fee: feeValue,
    feeMON: feeValue ? Number(formatEther(feeValue)) : 0,
    netAmountMON: amountAfterFee ? Number(formatEther(amountAfterFee)) : amountMON,
    isLoading,
  };
}
