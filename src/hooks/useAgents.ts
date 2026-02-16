'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

export interface Agent {
  id: string;
  name: string;
  strategy: string;
  status: 'active' | 'paused' | 'stopped' | 'pending';
  trustScore: number;
  pnl: number;
  totalTrades: number;
  winRate: number;
  tvl: number;
  createdAt: Date;
  description?: string;
  onChainId?: string;
  walletAddr?: string;
  userId?: string;
  ownerAddress?: string;
  activeDelegations?: number;
  totalDelegated?: number;
}

export interface AgentFilters {
  strategy?: string;
  status?: string;
  search?: string;
  sortBy?: 'trust' | 'pnl' | 'tvl' | 'trades';
  page?: number;
  limit?: number;
}

export interface AgentsData {
  agents: Agent[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Hook to fetch agents from API
export function useAgents(filters: AgentFilters = {}): AgentsData {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.strategy && filters.strategy !== 'all') {
        params.set('strategy', filters.strategy);
      }
      if (filters.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }
      if (filters.page) {
        params.set('page', filters.page.toString());
      }
      if (filters.limit) {
        params.set('limit', filters.limit.toString());
      }

      const response = await fetch(`/api/agents?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const result = await response.json();
      if (result.success) {
        const mappedAgents: Agent[] = result.data.map((agent: Record<string, unknown>) => ({
          id: agent.id,
          name: agent.name,
          strategy: (agent.strategy as string).toLowerCase(),
          status: (agent.status as string).toLowerCase() as Agent['status'],
          trustScore: agent.trustScore,
          pnl: parseFloat(String(agent.totalPnlUsd ?? agent.totalPnl ?? 0)),
          totalTrades: agent.totalTrades,
          winRate: agent.winRate,
          tvl: parseFloat(String(agent.totalCapitalUsd ?? agent.totalCapital ?? 0)),
          createdAt: new Date(agent.createdAt as string),
          description: agent.description as string | undefined,
          onChainId: agent.onChainId as string | undefined,
          walletAddr: agent.walletAddr as string | undefined,
          userId: agent.userId as string | undefined,
          ownerAddress: (agent as Record<string, unknown> & { user?: { address?: string } }).user?.address?.toLowerCase(),
          activeDelegations: (agent.activeDelegations as number) ?? 0,
          totalDelegated: parseFloat(String(agent.totalDelegated ?? 0)),
        }));

        setAgents(mappedAgents);
        setTotal(result.pagination?.total || mappedAgents.length);
        setTotalPages(result.pagination?.totalPages || 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [filters.strategy, filters.status, filters.page, filters.limit]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    total,
    totalPages,
    isLoading,
    error,
    refetch: fetchAgents,
  };
}

// Hook to fetch user's own agents
export function useMyAgents(): AgentsData {
  const { address } = useAccount();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMyAgents = useCallback(async () => {
    if (!address) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents?owner=${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const result = await response.json();
      if (result.success) {
        const mappedAgents: Agent[] = result.data.map((agent: Record<string, unknown>) => ({
          id: agent.id,
          name: agent.name,
          strategy: (agent.strategy as string).toLowerCase(),
          status: (agent.status as string).toLowerCase() as Agent['status'],
          trustScore: agent.trustScore,
          pnl: parseFloat(String(agent.totalPnlUsd ?? agent.totalPnl ?? 0)),
          totalTrades: agent.totalTrades,
          winRate: agent.winRate,
          tvl: parseFloat(String(agent.totalCapitalUsd ?? agent.totalCapital ?? 0)),
          createdAt: new Date(agent.createdAt as string),
          description: agent.description as string | undefined,
          onChainId: agent.onChainId as string | undefined,
          walletAddr: agent.walletAddr as string | undefined,
          activeDelegations: (agent.activeDelegations as number) ?? 0,
          totalDelegated: parseFloat(String(agent.totalDelegated ?? 0)),
        }));

        setAgents(mappedAgents);
        setTotal(result.pagination?.total || mappedAgents.length);
        setTotalPages(result.pagination?.totalPages || 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchMyAgents();
  }, [fetchMyAgents]);

  return {
    agents,
    total,
    totalPages,
    isLoading,
    error,
    refetch: fetchMyAgents,
  };
}

// Hook to create a new agent
export function useCreateAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createAgent = async (data: {
    name: string;
    strategy: string;
    description?: string;
    userAddress: string;
    maxDrawdown?: number;
    riskParams?: Record<string, unknown>;
  }): Promise<Agent | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create agent');
      }

      const result = await response.json();
      if (result.success) {
        return {
          id: result.data.id,
          name: result.data.name,
          strategy: result.data.strategy.toLowerCase(),
          status: result.data.status.toLowerCase() as Agent['status'],
          trustScore: result.data.trustScore,
          pnl: 0,
          totalTrades: 0,
          winRate: 0,
          tvl: 0,
          createdAt: new Date(result.data.createdAt),
        };
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { createAgent, isLoading, error };
}
