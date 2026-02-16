'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/utils';

export interface GlobalStats {
  totalAgents: number;
  totalTvl: number;
  totalPnl: number;
  totalTrades: number;
  avgTrustScore: number;
  avgWinRate: number;
  // Formatted versions
  formattedTvl: string;
  formattedPnl: string;
  tvlChange: string;
  pnlChange: string;
}

interface LeaderboardResponse {
  success: boolean;
  data: {
    globalStats: {
      totalAgents: number;
      totalTvl: number;
      totalPnl: number;
      totalTrades: number;
      avgTrustScore: number;
      avgWinRate: number;
    };
  };
}

const DEFAULT_STATS: GlobalStats = {
  totalAgents: 0,
  totalTvl: 0,
  totalPnl: 0,
  totalTrades: 0,
  avgTrustScore: 0,
  avgWinRate: 0,
  formattedTvl: '$0.00',
  formattedPnl: '$0.00',
  tvlChange: '+0%',
  pnlChange: '+0%',
};

/**
 * Hook to fetch global stats from leaderboard API
 * Used by sidebar, home page, dashboard to show consistent TVL/agents data
 */
export function useGlobalStats(refreshInterval = 60000) {
  const [stats, setStats] = useState<GlobalStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch from leaderboard API (limit=1 just to get globalStats efficiently)
      const response = await fetch('/api/leaderboard?limit=1');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const data: LeaderboardResponse = await response.json();

      if (data.success && data.data?.globalStats) {
        const gs = data.data.globalStats;
        
        // Calculate TVL and PnL changes (placeholder - would need historical data)
        // For now, show percentage based on totalPnl/totalTvl ratio
        const pnlRatio = gs.totalTvl > 0 ? (gs.totalPnl / gs.totalTvl) * 100 : 0;
        
        setStats({
          totalAgents: gs.totalAgents || 0,
          totalTvl: gs.totalTvl || 0,
          totalPnl: gs.totalPnl || 0,
          totalTrades: gs.totalTrades || 0,
          avgTrustScore: gs.avgTrustScore || 0,
          avgWinRate: gs.avgWinRate || 0,
          formattedTvl: formatCurrency(gs.totalTvl || 0),
          formattedPnl: formatCurrency(gs.totalPnl || 0),
          tvlChange: pnlRatio >= 0 ? `+${pnlRatio.toFixed(1)}%` : `${pnlRatio.toFixed(1)}%`,
          pnlChange: pnlRatio >= 0 ? `+${pnlRatio.toFixed(1)}%` : `${pnlRatio.toFixed(1)}%`,
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching global stats:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Auto-refresh stats
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshInterval]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
