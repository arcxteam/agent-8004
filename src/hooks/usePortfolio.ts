'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { erc20Abi } from '@/config/contracts';
import { useTokenPrices, MONAD_TOKEN_CONTRACTS } from './useTokenPrices';

// Monad mainnet tokens - synced with useTokenPrices and portfolio page
export const MONAD_TOKENS = [
  { symbol: 'MON', name: 'Monad', address: null, decimals: 18, icon: '/icons/monad.png', isNative: true },
  { symbol: 'WMON', name: 'Wrapped MON', address: MONAD_TOKEN_CONTRACTS['WMON'], decimals: 18, icon: '/icons/wmon.png', isNative: false },
  { symbol: 'USDC', name: 'USD Coin', address: MONAD_TOKEN_CONTRACTS['USDC'], decimals: 6, icon: '/icons/usdc-monad.png', isNative: false },
  { symbol: 'USDT', name: 'Tether USD', address: MONAD_TOKEN_CONTRACTS['USDT'], decimals: 6, icon: '/icons/usdt-monad.png', isNative: false },
  { symbol: 'aUSD', name: 'Agora USD', address: MONAD_TOKEN_CONTRACTS['aUSD'], decimals: 6, icon: '/icons/aUSD-monad.png', isNative: false },
  { symbol: 'earnAUSD', name: 'Earn aUSD', address: MONAD_TOKEN_CONTRACTS['earnAUSD'], decimals: 6, icon: '/icons/earnAUSD-monad.png', isNative: false },
  { symbol: 'aprMON', name: 'Apriori MON', address: MONAD_TOKEN_CONTRACTS['aprMON'], decimals: 18, icon: '/icons/aprmon.png', isNative: false },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: MONAD_TOKEN_CONTRACTS['WBTC'], decimals: 8, icon: '/icons/wbtc-monad.png', isNative: false },
  { symbol: 'WETH', name: 'Wrapped Ether', address: MONAD_TOKEN_CONTRACTS['WETH'], decimals: 18, icon: '/icons/weth-monad.png', isNative: false },
  { symbol: 'CHOG', name: 'Chog', address: MONAD_TOKEN_CONTRACTS['CHOG'], decimals: 18, icon: '/icons/chog.png', isNative: false },
] as const;

export interface Holding {
  symbol: string;
  name: string;
  address: string | null;
  balance: string;
  balanceRaw: number;
  value: number;
  price: number;
  change24h: number;
  allocation: number;
  icon: string;
  decimals: number;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'swap' | 'stake' | 'unstake' | 'provide_liquidity' | 'remove_liquidity' | 'lend' | 'borrow' | 'repay' | 'claim_rewards';
  token: string;
  tokenIcon?: string;
  amount: string;
  value: number;
  txHash: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface PnLData {
  date: string;
  label: string;
  pnl: number;
  cumulative: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalAssets: number;
  winRate: number;
  bestPerformer: string;
  todayPnl: number;
  weekPnl: number;
}

export interface PortfolioData {
  holdings: Holding[];
  transactions: Transaction[];
  pnlHistory: PnLData[];
  stats: PortfolioStats;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Hook to fetch portfolio data
export function usePortfolio(): PortfolioData {
  const { address, isConnected } = useAccount();
  const [apiData, setApiData] = useState<{
    transactions: Transaction[];
    pnlHistory: PnLData[];
    dbStats: Partial<PortfolioStats>;
  } | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<Error | null>(null);

  // Get real token prices from CoinGecko
  const tokenSymbols = MONAD_TOKENS.map(t => t.symbol);
  const { prices, isLoading: isPricesLoading } = useTokenPrices(tokenSymbols);

  // Native MON balance
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address,
    query: {
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });

  // ERC20 tokens (non-native)
  const erc20Tokens = MONAD_TOKENS.filter(t => !t.isNative && t.address);

  // Fetch all ERC20 balances in a single multicall
  const { data: tokenBalancesData, isLoading: isTokensLoading, refetch: refetchTokens } = useReadContracts({
    contracts: erc20Tokens.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })),
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });

  // Fetch additional data from API
  useEffect(() => {
    if (!address) {
      setApiData(null);
      return;
    }

    const fetchApiData = async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const response = await fetch(`/api/portfolio?address=${address}`);
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio data');
        }
        const result = await response.json();
        if (result.success) {
          // Map API data to our format
          const transactions: Transaction[] = (result.data.transactions || []).map((tx: Record<string, unknown>) => ({
            id: tx.id as string,
            type: tx.type as Transaction['type'],
            token: tx.token as string,
            amount: tx.amount as string,
            value: (tx.value as number) || Math.abs(parseFloat(String(tx.amount || '0'))),
            txHash: tx.txHash as string,
            timestamp: new Date(tx.timestamp as string),
            status: tx.status as Transaction['status'],
          }));

          const pnlHistory: PnLData[] = (result.data.pnlHistory || []).map((p: Record<string, unknown>) => ({
            date: p.date as string,
            label: (p.label as string) || (p.date as string),
            pnl: p.pnl as number,
            cumulative: p.cumulative as number,
          }));

          setApiData({
            transactions,
            pnlHistory,
            dbStats: result.data.stats || {},
          });
        }
      } catch (err) {
        setApiError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setApiLoading(false);
      }
    };

    fetchApiData();
  }, [address]);

  // Compute holdings from on-chain data
  const holdings = useMemo<Holding[]>(() => {
    if (!isConnected || !address) return [];

    const result: Holding[] = [];

    // Add native MON balance
    const monToken = MONAD_TOKENS.find(t => t.isNative);
    if (monToken && balanceData) {
      const formattedBalance = parseFloat(balanceData.formatted);
      if (formattedBalance > 0) {
        const priceData = prices[monToken.symbol];
        const price = priceData?.priceUsd || 1.0;
        const change24h = priceData?.change24h || 0;
        result.push({
          symbol: monToken.symbol,
          name: monToken.name,
          address: null,
          balance: formattedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
          balanceRaw: formattedBalance,
          value: formattedBalance * price,
          price,
          change24h,
          allocation: 0,
          icon: monToken.icon,
          decimals: monToken.decimals,
        });
      }
    }

    // Add ERC20 token balances
    if (tokenBalancesData) {
      erc20Tokens.forEach((token, index) => {
        const balanceResult = tokenBalancesData[index];
        if (balanceResult?.status === 'success' && balanceResult.result) {
          const rawBalance = balanceResult.result as bigint;
          const formattedBalance = parseFloat(formatUnits(rawBalance, token.decimals));

          if (formattedBalance > 0) {
            const priceData = prices[token.symbol];
            const price = priceData?.priceUsd || 1.0;
            const change24h = priceData?.change24h || 0;
            result.push({
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              balance: formattedBalance.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: token.decimals > 8 ? 4 : 2 
              }),
              balanceRaw: formattedBalance,
              value: formattedBalance * price,
              price,
              change24h,
              allocation: 0,
              icon: token.icon,
              decimals: token.decimals,
            });
          }
        }
      });
    }

    // Calculate allocations
    const totalValue = result.reduce((sum, h) => sum + h.value, 0);
    if (totalValue > 0) {
      result.forEach(h => {
        h.allocation = Math.round((h.value / totalValue) * 100);
      });
    }

    // Sort by value descending
    return result.sort((a, b) => b.value - a.value);
  }, [isConnected, address, balanceData, tokenBalancesData, erc20Tokens, prices]);

  // Calculate stats
  const stats = useMemo<PortfolioStats>(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const bestPerformer = holdings.length > 0 
      ? holdings.reduce((best, h) => h.balanceRaw > best.balanceRaw ? h : best, holdings[0]).symbol 
      : '-';

    return {
      totalValue,
      totalPnl: apiData?.dbStats?.totalPnl || 0,
      totalPnlPercent: apiData?.dbStats?.totalPnlPercent || 0,
      totalAssets: holdings.length,
      winRate: apiData?.dbStats?.winRate || 0,
      bestPerformer,
      todayPnl: 0, // TODO: Calculate from price changes
      weekPnl: 0,
    };
  }, [holdings, apiData]);

  const isLoading = isBalanceLoading || isTokensLoading || apiLoading || isPricesLoading;

  const refetch = () => {
    refetchBalance();
    refetchTokens();
  };

  return {
    holdings,
    transactions: apiData?.transactions || [],
    pnlHistory: apiData?.pnlHistory || [],
    stats,
    isLoading,
    error: apiError,
    refetch,
  };
}

// Hook to get portfolio stats summary
export function usePortfolioStats() {
  const { stats, isLoading, error } = usePortfolio();
  return { stats, isLoading, error };
}
