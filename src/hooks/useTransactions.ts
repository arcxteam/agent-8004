'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

// Extended Transaction interface for useTransactions (supports additional types)
export interface TransactionRecord {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'swap' | 'stake' | 'unstake' | 'yield' | 'claim' | 'delegate';
  token: string;
  tokenIcon?: string;
  amount: string;
  value?: number;
  txHash: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  from?: string;
  to?: string;
  chainId?: number;
}

export interface TransactionsData {
  transactions: TransactionRecord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Hook to fetch recent transactions
export function useTransactions(limit: number = 10): TransactionsData {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch from executions API (which is connected to DB)
      const response = await fetch(`/api/executions?address=${address}&limit=${limit}`);
      
      if (!response.ok) {
        // If API doesn't exist or fails, return empty array
        setTransactions([]);
        return;
      }

      const result = await response.json();
      if (result.success && result.data) {
        const mapped: TransactionRecord[] = result.data.map((exec: Record<string, unknown>) => {
          const type = (exec.type as string).toLowerCase();
          return {
            id: exec.id as string,
            type: type as TransactionRecord['type'],
            token: (exec.params as Record<string, string>)?.token || 'Unknown',
            amount: (exec.pnl?.toString() || '0'),
            txHash: exec.txHash as string,
            timestamp: new Date(exec.executedAt as string),
            status: (exec.status as string).toLowerCase() === 'success' ? 'confirmed' : 
                   (exec.status as string).toLowerCase() === 'failed' ? 'failed' : 'pending',
          };
        });
        setTransactions(mapped);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      // Don't set error for missing API - just return empty
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

// Hook for dashboard recent activity (combines executions + delegations)
export function useRecentActivity(limit: number = 5): TransactionsData {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch from multiple sources in parallel
      const [execResponse, delegResponse] = await Promise.allSettled([
        fetch(`/api/executions?address=${address}&limit=${limit}`),
        fetch(`/api/delegations?address=${address}&limit=${limit}`),
      ]);

      const allActivity: TransactionRecord[] = [];

      // Process executions
      if (execResponse.status === 'fulfilled' && execResponse.value.ok) {
        const execResult = await execResponse.value.json();
        if (execResult.success && execResult.data) {
          execResult.data.forEach((exec: Record<string, unknown>) => {
            const type = (exec.type as string).toLowerCase();
            allActivity.push({
              id: exec.id as string,
              type: type as TransactionRecord['type'],
              token: (exec.params as Record<string, string>)?.token || 'MON',
              amount: (exec.pnl?.toString() || '0'),
              txHash: exec.txHash as string || '',
              timestamp: new Date(exec.executedAt as string),
              status: (exec.status as string).toLowerCase() === 'success' ? 'confirmed' : 
                     (exec.status as string).toLowerCase() === 'failed' ? 'failed' : 'pending',
            });
          });
        }
      }

      // Process delegations
      if (delegResponse.status === 'fulfilled' && delegResponse.value.ok) {
        const delegResult = await delegResponse.value.json();
        if (delegResult.success && delegResult.data) {
          delegResult.data.forEach((deleg: Record<string, unknown>) => {
            allActivity.push({
              id: deleg.id as string,
              type: 'delegate',
              token: 'MON',
              amount: (deleg.amount?.toString() || '0'),
              txHash: deleg.txHash as string || '',
              timestamp: new Date(deleg.createdAt as string),
              status: 'confirmed',
            });
          });
        }
      }

      // Sort by timestamp descending and limit
      allActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setTransactions(allActivity.slice(0, limit));

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [address, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchActivity,
  };
}
