'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import {
  TrendingUp,
  BarChart3,
  Shield,
  AlertTriangle,
  Zap,
  Star,
  RefreshCw,
  Gift,
  Layers,
} from 'lucide-react';
import {
  Card,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { DashboardLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import {
  useAprMonBalance,
  useEarnAusdBalance,
  useConvertAprMonToMon,
} from '@/hooks/useYield';
import { useTokenPrice } from '@/hooks/useTokenPrices';

// Local imports from split files
import type { YieldStrategy, UserDeposit, YieldApiResponse } from './types';
import { fallbackStrategies } from './types';
import { StrategyCard, YieldOverview, UpshiftBanner, YieldInfoCards } from './components';
import { DepositModal, UserPositionsModal, WithdrawModal, ClaimRewardsModal } from './modals';

// Main Yield Page content
function YieldPageContent() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState('all');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<YieldStrategy | null>(null);
  const [positionsModalOpen, setPositionsModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'aprMON' | 'earnAUSD'>('aprMON');
  const [claimsModalOpen, setClaimsModalOpen] = useState(false);

  // API state
  const [strategies, setStrategies] = useState<YieldStrategy[]>(fallbackStrategies);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Get real MON price
  const { price: monPriceData } = useTokenPrice('MON');
  const monPriceUsd = monPriceData?.priceUsd || 0;

  // Fetch user's on-chain yield positions
  const { data: aprMonBalance, refetch: refetchAprMon } = useAprMonBalance(address);
  const { data: earnAusdBalance, refetch: refetchEarnAusd } = useEarnAusdBalance(address);

  // Convert aprMON shares to actual MON value (exchange rate)
  const { data: aprMonInMon } = useConvertAprMonToMon(aprMonBalance ?? BigInt(0), !!aprMonBalance && aprMonBalance > BigInt(0));

  // Derive user deposits from on-chain balances
  const userDeposits = useMemo((): UserDeposit[] => {
    const deposits: UserDeposit[] = [];

    if (aprMonBalance) {
      const sharesBalance = parseFloat(formatEther(aprMonBalance));
      // aprMON is reward-bearing: value increases, balance stays same
      // convertToAssets(shares) = how much MON you'd get if you redeem now
      const monValue = aprMonInMon ? parseFloat(formatEther(aprMonInMon)) : sharesBalance;
      const earned = monValue - sharesBalance; // exchange rate gain in MON
      if (sharesBalance > 0) {
        deposits.push({
          strategy: 'mon-staking',
          amount: sharesBalance,
          amountUsd: monValue * monPriceUsd,
          earned: earned > 0 ? earned : 0,
          earnedUsd: (earned > 0 ? earned : 0) * monPriceUsd,
          depositDate: '-',
        });
      }
    }

    if (earnAusdBalance) {
      const balance = parseFloat(formatUnits(earnAusdBalance, 6));
      if (balance > 0) {
        // earnAUSD is backed by aUSD (~$1), share price appreciates
        deposits.push({
          strategy: 'upshift-ausd',
          amount: balance,
          amountUsd: balance, // 1 earnAUSD ≈ $1 (stablecoin)
          earned: 0,
          earnedUsd: 0,
          depositDate: '-',
        });
      }
    }

    return deposits;
  }, [aprMonBalance, earnAusdBalance, aprMonInMon, monPriceUsd]);

  // Fetch strategies from API
  const fetchStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/yield');
      const data: YieldApiResponse = await response.json();

      if (data.success && data.data) {
        // Map API response to YieldStrategy type
        const mappedStrategies: YieldStrategy[] = data.data.map(s => ({
          id: s.id,
          name: s.name,
          protocol: s.protocol,
          icon: s.icon,
          apy: s.apy,
          tvl: s.tvl,
          risk: s.risk,
          tokens: s.tokens,
          description: s.description,
          minDeposit: s.minDeposit,
          minDepositUnit: s.id === 'mon-staking' ? 'native' : 'usd',
          lockPeriod: s.lockPeriod,
          featured: s.featured,
          sharePrice: s.sharePrice,
          apyBreakdown: s.apyBreakdown,
          campaignApy: s.campaignApy,
        }));
        setStrategies(mappedStrategies);
        setLastUpdated(new Date().toLocaleTimeString());
        setIsCached(data.cached ?? false);
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      // Keep using fallback strategies
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and set up refresh interval
  useEffect(() => {
    fetchStrategies();

    // Refresh every 5 minutes to check for updates
    const interval = setInterval(fetchStrategies, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStrategies]);

  const handleDeposit = (strategy: YieldStrategy) => {
    setSelectedStrategy(strategy);
    setDepositModalOpen(true);
  };

  const handleWithdraw = (type: 'aprMON' | 'earnAUSD') => {
    setWithdrawType(type);
    setWithdrawModalOpen(true);
  };

  // Get user deposit for a strategy from on-chain balance data
  const getUserDepositForStrategy = (strategyId: string): UserDeposit | undefined => {
    return userDeposits.find((d) => d.strategy === strategyId);
  };

  // Filter strategies by risk
  const filteredStrategies = activeTab === 'all'
    ? strategies
    : strategies.filter((s) => s.risk === activeTab);

  const tabs = [
    { id: 'all', label: 'All Strategies', Icon: Layers },
    { id: 'low', label: 'Low Risk', Icon: Shield, color: 'text-green-500' },
    { id: 'medium', label: 'Medium Risk', Icon: AlertTriangle, color: 'text-yellow-500' },
    { id: 'high', label: 'High Risk', Icon: Zap, color: 'text-red-500' },
  ];

  return (
    <DashboardLayout showFooter={false}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-foreground"
            >
              Yield Strategies
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              Earn passive income with AI-optimized yield strategies
            </motion.p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            {/* Data Status */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isCached ? "bg-yellow-400" : "bg-green-400"
                )} />
                <span>Updated {new Date().toLocaleDateString()} {lastUpdated}</span>
              </div>
            )}
            <button
              className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 flex items-center gap-2"
              onClick={fetchStrategies}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4 text-purple-400", isLoading && "animate-spin")} />
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 font-medium bg-clip-text text-transparent text-sm">
                Refresh
              </span>
            </button>
            <button
              onClick={() => setPositionsModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 font-medium bg-clip-text text-transparent text-sm">
                My Positions
              </span>
            </button>
            <button
              onClick={() => setClaimsModalOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-300 flex items-center gap-2"
            >
              <Gift className="w-4 h-4 text-white" />
              <span className="text-white font-medium text-sm">Claim Rewards</span>
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <YieldOverview strategies={strategies} />

        {/* Upshift Banner */}
        <UpshiftBanner
          apy={strategies.find(s => s.id === 'upshift-ausd')?.apy ?? 0}
          tvl={strategies.find(s => s.id === 'upshift-ausd')?.tvl ?? 0}
          sharePrice={strategies.find(s => s.id === 'upshift-ausd')?.sharePrice}
          isLoading={isLoading}
          onDeposit={() => {
            const upshiftStrategy = strategies.find(s => s.id === 'upshift-ausd');
            if (upshiftStrategy) {
              handleDeposit(upshiftStrategy);
            }
          }}
        />

        {/* Strategy Filters */}
        <Card variant="glass" className="p-4">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Card>

        {/* Featured Strategies */}
        {activeTab === 'all' && (
          <>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-bold text-foreground">Featured Strategies</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {strategies.filter((s) => s.featured).map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  userDeposit={getUserDepositForStrategy(strategy.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* All Strategies */}
        <h2 className="text-xl font-bold text-foreground">
          <span className="flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            {activeTab === 'all' ? 'All Strategies' : `Showing ${activeTab} risk strategies`}
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredStrategies
              .filter((s) => activeTab === 'all' ? !s.featured : true)
              .map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  userDeposit={getUserDepositForStrategy(strategy.id)}
                />
              ))}
          </AnimatePresence>
        </div>

        {/* Info Cards */}
        <YieldInfoCards />
      </div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => {
          setDepositModalOpen(false);
          setSelectedStrategy(null);
          // Refetch balances after deposit to show updated positions
          refetchAprMon();
          refetchEarnAusd();
        }}
        strategy={selectedStrategy}
      />

      {/* User Positions Modal */}
      <UserPositionsModal
        isOpen={positionsModalOpen}
        onClose={() => setPositionsModalOpen(false)}
        onWithdraw={(type) => {
          setWithdrawType(type);
          setPositionsModalOpen(false);
          setWithdrawModalOpen(true);
        }}
        strategies={strategies}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => {
          setWithdrawModalOpen(false);
          refetchAprMon();
          refetchEarnAusd();
        }}
        type={withdrawType}
      />

      {/* Claim Rewards Modal */}
      <ClaimRewardsModal
        isOpen={claimsModalOpen}
        onClose={() => {
          setClaimsModalOpen(false);
          refetchAprMon();
          refetchEarnAusd();
        }}
      />
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function YieldPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback message="Loading yield strategies..." />}>
        <YieldPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
