'use client';

import { useReadContract, useWriteContract, useAccount, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { 
  lensAbi, 
  routerAbi, 
  curveAbi, 
  erc20Abi,
} from '@/config/contracts';
import { getContractsByChainId } from '@/config/chains';

// Helper to get contracts for current chain
function useContracts() {
  const chainId = useChainId();
  return getContractsByChainId(chainId);
}

// ===========================================
// ANOA Trading Hooks
// ===========================================

// Get quote for buying tokens with MON
export function useGetBuyQuote(tokenAddress: `0x${string}`, amountIn: bigint, enabled = true) {
  const contracts = useContracts();
  
  return useReadContract({
    address: contracts.LENS,
    abi: lensAbi,
    functionName: 'getAmountOut',
    args: [tokenAddress, amountIn, true], // true = isBuy
    query: {
      enabled: enabled && amountIn > BigInt(0),
    },
  });
}

// Get quote for selling tokens
export function useGetSellQuote(tokenAddress: `0x${string}`, amountIn: bigint, enabled = true) {
  const contracts = useContracts();
  
  return useReadContract({
    address: contracts.LENS,
    abi: lensAbi,
    functionName: 'getAmountOut',
    args: [tokenAddress, amountIn, false], // false = isSell
    query: {
      enabled: enabled && amountIn > BigInt(0),
    },
  });
}

// Get bonding curve info
export function useCurveInfo(tokenAddress: `0x${string}`, enabled = true) {
  const contracts = useContracts();
  
  return useReadContract({
    address: contracts.CURVE,
    abi: curveAbi,
    functionName: 'curves',
    args: [tokenAddress],
    query: {
      enabled,
    },
  });
}

// Check if token is graduated
export function useIsGraduated(tokenAddress: `0x${string}`, enabled = true) {
  const contracts = useContracts();
  
  return useReadContract({
    address: contracts.LENS,
    abi: lensAbi,
    functionName: 'isGraduated',
    args: [tokenAddress],
    query: {
      enabled,
    },
  });
}

// Get graduation progress
export function useGetProgress(tokenAddress: `0x${string}`, enabled = true) {
  const contracts = useContracts();
  
  return useReadContract({
    address: contracts.LENS,
    abi: lensAbi,
    functionName: 'getProgress',
    args: [tokenAddress],
    query: {
      enabled,
    },
  });
}

// Buy tokens with MON
export function useBuyTokens() {
  const { address } = useAccount();
  const contracts = useContracts();
  const { writeContract, isPending, isSuccess, isError, data, error } = useWriteContract();

  const buy = async (
    tokenAddress: `0x${string}`,
    amountOutMin: bigint,
    deadline: bigint,
    value: bigint
  ) => {
    if (!address) throw new Error('Wallet not connected');
    
    writeContract({
      address: contracts.BONDING_CURVE_ROUTER,
      abi: routerAbi,
      functionName: 'buy',
      args: [{
        amountOutMin,
        token: tokenAddress,
        to: address,
        deadline,
      }],
      value,
    });
  };

  return { buy, isPending, isSuccess, isError, data, error };
}

// Sell tokens for MON
export function useSellTokens() {
  const { address } = useAccount();
  const contracts = useContracts();
  const { writeContract, isPending, isSuccess, isError, data, error } = useWriteContract();

  const sell = async (
    tokenAddress: `0x${string}`,
    amountIn: bigint,
    amountOutMin: bigint,
    deadline: bigint
  ) => {
    if (!address) throw new Error('Wallet not connected');
    
    writeContract({
      address: contracts.BONDING_CURVE_ROUTER,
      abi: routerAbi,
      functionName: 'sell',
      args: [{
        amountIn,
        amountOutMin,
        token: tokenAddress,
        to: address,
        deadline,
      }],
    });
  };

  return { sell, isPending, isSuccess, isError, data, error };
}

// ===========================================
// ERC-20 Hooks
// ===========================================

export function useTokenBalance(tokenAddress: `0x${string}`, owner: `0x${string}`, enabled = true) {
  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
    query: {
      enabled: enabled && !!owner,
    },
  });
}

export function useTokenAllowance(tokenAddress: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`, enabled = true) {
  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
    query: {
      enabled: enabled && !!owner && !!spender,
    },
  });
}

export function useApproveToken() {
  const { writeContract, isPending, isSuccess, isError, data, error } = useWriteContract();

  const approve = async (
    tokenAddress: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint
  ) => {
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return { approve, isPending, isSuccess, isError, data, error };
}

// ===========================================
// Swap Execution Hook (Combined)
// ===========================================

export function useSwap() {
  const { address } = useAccount();
  const contracts = useContracts();
  const { writeContract, isPending, isSuccess, isError, data, error } = useWriteContract();

  const swap = async (
    tokenAddress: `0x${string}`,
    isBuy: boolean,
    amountIn: bigint,
    amountOutMin: bigint,
    slippageBps: number = 100 // 1% default
  ) => {
    if (!address) throw new Error('Wallet not connected');
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes
    const adjustedAmountOutMin = amountOutMin * BigInt(10000 - slippageBps) / BigInt(10000);

    if (isBuy) {
      writeContract({
        address: contracts.BONDING_CURVE_ROUTER,
        abi: routerAbi,
        functionName: 'buy',
        args: [{
          amountOutMin: adjustedAmountOutMin,
          token: tokenAddress,
          to: address,
          deadline,
        }],
        value: amountIn,
      });
    } else {
      writeContract({
        address: contracts.BONDING_CURVE_ROUTER,
        abi: routerAbi,
        functionName: 'sell',
        args: [{
          amountIn,
          amountOutMin: adjustedAmountOutMin,
          token: tokenAddress,
          to: address,
          deadline,
        }],
      });
    }
  };

  return { swap, isPending, isSuccess, isError, data, error };
}

// ===========================================
// Utility Hooks
// ===========================================

export function useNativeBalance() {
  const { address } = useAccount();
  return { address };
}

// Export formatted utilities
export { parseEther, formatEther };
