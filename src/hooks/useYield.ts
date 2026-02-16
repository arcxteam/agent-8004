'use client';

import { useReadContract, useWriteContract, useAccount, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { 
  aprMonAbi, 
  upshiftVaultAbi, 
  erc20Abi, 
  YIELD_CONTRACTS,
  YIELD_DECIMALS,
} from '@/config/contracts';

// ==========================================
// YIELD PROTOCOL HOOKS - MAINNET (BE CAREFUL!)
// ==========================================

// ===========================================
// Balance & Read Hooks
// ===========================================

/**
 * Get native MON balance
 */
export function useMonBalance(address: `0x${string}` | undefined) {
  return useBalance({
    address,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Get aprMON balance for a user
 */
export function useAprMonBalance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.APRMON,
    abi: aprMonAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Get aUSD balance for a user
 */
export function useAusdBalance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.AUSD,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Get earnAUSD (Upshift LP token) balance for a user
 */
export function useEarnAusdBalance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.EARNAUSD_RECEIPT,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Get USDC balance for a user
 */
export function useUsdcBalance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Get aUSD allowance for Upshift vault
 */
export function useAusdAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.AUSD,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, YIELD_CONTRACTS.UPSHIFT_VAULT] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Get USDC allowance for Upshift vault
 */
export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.USDC,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, YIELD_CONTRACTS.UPSHIFT_VAULT] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Convert MON to aprMON shares (preview deposit)
 */
export function useConvertMonToAprMon(amountMon: bigint, enabled = true) {
  return useReadContract({
    address: YIELD_CONTRACTS.APRMON,
    abi: aprMonAbi,
    functionName: 'convertToShares',
    args: [amountMon],
    query: {
      enabled: enabled && amountMon > BigInt(0),
    },
  });
}

/**
 * Convert aprMON shares to MON value (current value)
 */
export function useConvertAprMonToMon(shares: bigint, enabled = true) {
  return useReadContract({
    address: YIELD_CONTRACTS.APRMON,
    abi: aprMonAbi,
    functionName: 'convertToAssets',
    args: [shares],
    query: {
      enabled: enabled && shares > BigInt(0),
    },
  });
}

/**
 * Get user's pending withdrawal requests for aprMON
 */
export function useAprMonWithdrawalRequests(
  owner: `0x${string}` | undefined, 
  startIndex = 0, 
  pageSize = 10
) {
  return useReadContract({
    address: YIELD_CONTRACTS.APRMON,
    abi: aprMonAbi,
    functionName: 'getUserRequestData',
    args: owner ? [owner, BigInt(startIndex), BigInt(pageSize)] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

// ===========================================
// aPriori (aprMON) Write Hooks
// ===========================================

/**
 * Deposit native MON into aPriori to receive aprMON
 * 
 * MAINNET WARNING: This sends real MON!
 * 
 * @example
 * const { depositMon, isPending, isSuccess } = useDepositMon();
 * await depositMon(parseEther('1')); // Deposit 1 MON
 */
export function useDepositMon() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const depositMon = async (amountWei: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountWei <= BigInt(0)) throw new Error('Amount must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.APRMON,
      abi: aprMonAbi,
      functionName: 'deposit',
      args: [amountWei, address],
      value: amountWei, // Native MON sent as value
    });
  };

  return { 
    depositMon, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    contractAddress: YIELD_CONTRACTS.APRMON,
  };
}

/**
 * Request withdrawal from aPriori (initiates unstaking)
 * Wait ~12-18 hours before calling redeem
 */
export function useRequestRedeemAprMon() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const requestRedeem = async (sharesWei: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    if (sharesWei <= BigInt(0)) throw new Error('Shares must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.APRMON,
      abi: aprMonAbi,
      functionName: 'requestRedeem',
      args: [sharesWei, address, address],
    });
  };

  return { requestRedeem, isPending, isSuccess, isError, txHash, error, reset };
}

/**
 * Claim MON after withdrawal request is claimable
 */
export function useRedeemAprMon() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const redeem = async (requestIds: bigint[]) => {
    if (!address) throw new Error('Wallet not connected');
    if (requestIds.length === 0) throw new Error('No request IDs provided');
    
    writeContract({
      address: YIELD_CONTRACTS.APRMON,
      abi: aprMonAbi,
      functionName: 'redeem',
      args: [requestIds, address],
    });
  };

  return { redeem, isPending, isSuccess, isError, txHash, error, reset };
}

// ===========================================
// Upshift (earnAUSD) Write Hooks
// ===========================================

/**
 * Approve aUSD spending for Upshift vault
 */
export function useApproveAusd() {
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const approve = async (amount: bigint) => {
    writeContract({
      address: YIELD_CONTRACTS.AUSD,
      abi: erc20Abi,
      functionName: 'approve',
      args: [YIELD_CONTRACTS.UPSHIFT_VAULT, amount],
    });
  };

  return { 
    approve, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    vaultAddress: YIELD_CONTRACTS.UPSHIFT_VAULT,
  };
}

/**
 * Deposit aUSD into Upshift vault to receive earnAUSD
 * 
 * MAINNET WARNING: This sends real aUSD!
 * 
 * IMPORTANT: Must call approve first if allowance is insufficient
 * 
 * @example
 * const { depositAusd, isPending, isSuccess } = useDepositAusd();
 * // First approve
 * await approve(parseUnits('100', 6));
 * // Then deposit
 * await depositAusd(parseUnits('100', 6)); // Deposit 100 aUSD
 */
export function useDepositAusd() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const depositAusd = async (amountAusd: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountAusd <= BigInt(0)) throw new Error('Amount must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.UPSHIFT_VAULT,
      abi: upshiftVaultAbi,
      functionName: 'deposit',
      args: [YIELD_CONTRACTS.AUSD, amountAusd, address],
    });
  };

  return { 
    depositAusd, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    contractAddress: YIELD_CONTRACTS.UPSHIFT_VAULT,
  };
}

/**
 * Approve USDC spending for Upshift vault
 */
export function useApproveUsdc() {
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const approve = async (amount: bigint) => {
    writeContract({
      address: YIELD_CONTRACTS.USDC,
      abi: erc20Abi,
      functionName: 'approve',
      args: [YIELD_CONTRACTS.UPSHIFT_VAULT, amount],
    });
  };

  return { 
    approve, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    vaultAddress: YIELD_CONTRACTS.UPSHIFT_VAULT,
  };
}

/**
 * Deposit USDC into Upshift vault to receive earnAUSD
 * 
 * MAINNET WARNING: This sends real USDC!
 * 
 * IMPORTANT: Must call approve first if allowance is insufficient
 */
export function useDepositUsdc() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const depositUsdc = async (amountUsdc: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountUsdc <= BigInt(0)) throw new Error('Amount must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.UPSHIFT_VAULT,
      abi: upshiftVaultAbi,
      functionName: 'deposit',
      args: [YIELD_CONTRACTS.USDC, amountUsdc, address],
    });
  };

  return { 
    depositUsdc, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    contractAddress: YIELD_CONTRACTS.UPSHIFT_VAULT,
  };
}

/**
 * Get earnAUSD (LP token) allowance for Upshift vault
 * Required before calling instantRedeem or requestRedeem
 */
export function useEarnAusdAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_CONTRACTS.EARNAUSD_RECEIPT,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, YIELD_CONTRACTS.UPSHIFT_VAULT] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

/**
 * Approve earnAUSD (LP token) spending for Upshift vault
 * MUST be called before instantRedeem or requestRedeem
 */
export function useApproveEarnAusd() {
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const approve = async (amount: bigint) => {
    writeContract({
      address: YIELD_CONTRACTS.EARNAUSD_RECEIPT,
      abi: erc20Abi,
      functionName: 'approve',
      args: [YIELD_CONTRACTS.UPSHIFT_VAULT, amount],
    });
  };

  return { 
    approve, 
    isPending, 
    isSuccess, 
    isError, 
    txHash, 
    error, 
    reset,
    lpTokenAddress: YIELD_CONTRACTS.EARNAUSD_RECEIPT,
    vaultAddress: YIELD_CONTRACTS.UPSHIFT_VAULT,
  };
}

/**
 * Instant redemption from Upshift (0.2% fee)
 * IMPORTANT: Must approve earnAUSD (LP token) first using useApproveEarnAusd
 * 
 * @param stableOutIdx - Index of stablecoin to receive (0 for aUSD)
 */
export function useInstantRedeemAusd() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const instantRedeem = async (lpAmount: bigint, minAmountOut: bigint, stableOutIdx = 0) => {
    if (!address) throw new Error('Wallet not connected');
    if (lpAmount <= BigInt(0)) throw new Error('Amount must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.UPSHIFT_VAULT,
      abi: upshiftVaultAbi,
      functionName: 'instantRedeem',
      args: [lpAmount, BigInt(stableOutIdx), minAmountOut, address],
    });
  };

  return { instantRedeem, isPending, isSuccess, isError, txHash, error, reset };
}

/**
 * Request delayed redemption from Upshift (no fee, up to 96H wait)
 * IMPORTANT: Must approve earnAUSD (LP token) first using useApproveEarnAusd
 */
export function useRequestRedeemAusd() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const requestRedeem = async (lpAmount: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    if (lpAmount <= BigInt(0)) throw new Error('Amount must be greater than 0');
    
    writeContract({
      address: YIELD_CONTRACTS.UPSHIFT_VAULT,
      abi: upshiftVaultAbi,
      functionName: 'requestRedeem',
      args: [lpAmount, address],
    });
  };

  return { requestRedeem, isPending, isSuccess, isError, txHash, error, reset };
}

/**
 * Claim aUSD after 3-day waiting period
 */
export function useClaimAusd() {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess, isError, data: txHash, error, reset } = useWriteContract();

  const claim = async (requestId: bigint, minAmountOut: bigint, stableOutIdx = 0) => {
    if (!address) throw new Error('Wallet not connected');
    
    writeContract({
      address: YIELD_CONTRACTS.UPSHIFT_VAULT,
      abi: upshiftVaultAbi,
      functionName: 'claim',
      args: [requestId, BigInt(stableOutIdx), minAmountOut, address],
    });
  };

  return { claim, isPending, isSuccess, isError, txHash, error, reset };
}

// ===========================================
// Transaction Tracking Hook
// ===========================================

/**
 * Wait for transaction confirmation
 */
export function useYieldTransactionReceipt(txHash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Parse MON amount to wei (18 decimals)
 */
export function parseMonAmount(amount: string): bigint {
  return parseEther(amount);
}

/**
 * Format MON from wei to string
 */
export function formatMonAmount(wei: bigint): string {
  return formatEther(wei);
}

/**
 * Parse aUSD amount to smallest unit (6 decimals)
 */
export function parseAusdAmount(amount: string): bigint {
  return parseUnits(amount, YIELD_DECIMALS.AUSD);
}

/**
 * Format aUSD from smallest unit to string
 */
export function formatAusdAmount(units: bigint): string {
  return formatUnits(units, YIELD_DECIMALS.AUSD);
}

/**
 * Get contract addresses (for display/linking)
 */
export function getYieldContracts() {
  return YIELD_CONTRACTS;
}
