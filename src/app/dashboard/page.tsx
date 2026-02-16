'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAccount, useBalance } from 'wagmi';
import {
  Rocket,
  TrendingUp,
  Wallet,
  BarChart3,
  Trophy,
  ArrowUpRight,
  Zap,
  Bot,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedAgentAvatar } from '@/components/ui/agent-avatar';
import { formatAddress, formatCurrency, formatNumber, formatPercentage, timeAgo, cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import { useMyAgents } from '@/hooks/useAgents';
import { usePortfolio } from '@/hooks/usePortfolio';

// Get deterministic random agent avatar based on wallet address
function getAgentAvatar(addr: string): string {
  const addressNum = parseInt(addr.slice(2, 10), 16);
  const avatarNum = (addressNum % 200) + 1;
  return `/agents/agent-${avatarNum}.png`;
}

// Portfolio summary card
function PortfolioSummary() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { stats, isLoading } = useGlobalStats();

  if (!isConnected) {
    return (
      <Card variant="gradient" className="col-span-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-white/60 text-center mb-6 max-w-sm">
            Connect your wallet to view your portfolio and manage your AI agents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="gradient" className="col-span-full">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary-500/30 flex-shrink-0">
              <Image
                src={getAgentAvatar(address!)}
                alt="Avatar"
                width={48}
                height={48}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{formatAddress(address!)}</span>
                <Badge variant="success" size="sm" dot>Connected</Badge>
              </div>
              <div className="text-sm text-white/60">
                Balance: {balance ? `${formatNumber(Number(balance.formatted))} ${balance.symbol}` : '...'}
              </div>
            </div>
          </div>
          <Link href="/agents/create">
            <Button>
              <span className="font-bold bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
              Create Agent
              </span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-xs text-white/40 mb-1">Total Value</div>
            {isLoading ? (
              <div className="h-8 w-24 bg-white/10 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats.formattedTvl}</div>
            )}
            <div className={cn("text-xs", stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {stats.tvlChange} (24h)
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-xs text-white/40 mb-1">Active Agents</div>
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats.totalAgents}</div>
            )}
            <div className="text-xs text-white/60">Total Registered</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-xs text-white/40 mb-1">Total PnL</div>
            {isLoading ? (
              <div className="h-8 w-24 bg-white/10 animate-pulse rounded" />
            ) : (
              <div className={cn("text-2xl font-bold", stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.formattedPnl}
              </div>
            )}
            <div className="text-xs text-white/60">All Time</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-xs text-white/40 mb-1">Avg Trust Score</div>
            {isLoading ? (
              <div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats.avgTrustScore.toFixed(1)}</div>
            )}
            <div className="text-xs text-white/60">Platform Avg</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Map UI period labels to API period params
const PERIOD_MAP: Record<string, string> = {
  '1D': '1d',
  '1W': '7d',
  '1M': '30d',
  '3M': '90d',
  'ALL': 'all',
};

// Performance chart - fetches PnL history from API with period filter
function PerformanceChart() {
  const { address, isConnected } = useAccount();
  const [selectedPeriod, setSelectedPeriod] = React.useState('1M');
  const [pnlHistory, setPnlHistory] = React.useState<{ date: string; label: string; pnl: number; cumulative: number }[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch PnL history when period or address changes
  React.useEffect(() => {
    if (!address || !isConnected) {
      setPnlHistory([]);
      return;
    }

    const fetchPnlHistory = async () => {
      setIsLoading(true);
      try {
        const apiPeriod = PERIOD_MAP[selectedPeriod] || '30d';
        const res = await fetch(`/api/portfolio?address=${address}&period=${apiPeriod}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.pnlHistory) {
            setPnlHistory(data.data.pnlHistory);
          }
        }
      } catch {
        // Silently fail — chart shows empty state
      } finally {
        setIsLoading(false);
      }
    };

    fetchPnlHistory();
  }, [address, isConnected, selectedPeriod]);

  // Build chart bars from PnL data
  const chartData = React.useMemo(() => {
    if (pnlHistory.length > 0) {
      const maxVal = Math.max(...pnlHistory.map(d => Math.abs(d.cumulative)), 1);
      return pnlHistory.slice(-12).map(d => ({
        value: 50 + (d.cumulative / maxVal) * 40, // Base 50%, ±40%
        label: d.label || d.date,
        isPositive: d.cumulative >= 0,
      }));
    }
    // Placeholder when no history
    return Array(12).fill(0).map((_, i) => ({
      value: 50,
      label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
      isPositive: true,
    }));
  }, [pnlHistory]);

  return (
    <Card variant="glass" className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-400" />
            Portfolio Performance
          </CardTitle>
          <div className="flex gap-2">
            {['1D', '1W', '1M', '3M', 'ALL'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  period === selectedPeriod
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-end gap-1 h-48">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-white/10 rounded-sm animate-pulse"
                style={{ height: `${30 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-1 h-48">
            {chartData.map((bar, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 rounded-sm",
                  bar.isPositive
                    ? "bg-gradient-to-t from-green-500 to-purple-500"
                    : "bg-gradient-to-t from-purple-600 to-green-400"
                )}
                initial={{ height: 0 }}
                animate={{ height: `${bar.value}%` }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
              />
            ))}
          </div>
        )}
        <div className="flex justify-between mt-4 text-xs text-white/40">
          {chartData.slice(0, 12).map((bar, i) => (
            <span key={i}>{bar.label}</span>
          ))}
        </div>
        {pnlHistory.length === 0 && !isLoading && (
          <div className="text-center mt-4 text-white/40 text-sm">
            No trading history yet. Deploy an agent to start building your performance record.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Agent status card - uses real agent data from API
function AgentStatusCard({
  name,
  strategy,
  status,
  pnl,
  trades,
  trustScore,
  id,
  walletAddr,
}: {
  name: string;
  strategy: string;
  status: 'active' | 'paused' | 'stopped' | 'pending';
  pnl: number;
  trades: number;
  trustScore: number;
  id?: string;
  walletAddr?: string;
}) {
  const statusColors = {
    active: 'success',
    paused: 'warning',
    stopped: 'danger',
    pending: 'info',
  } as const;

  // Format strategy for display
  const displayStrategy = strategy.charAt(0).toUpperCase() + strategy.slice(1).toLowerCase();

  return (
    <Link href={id ? `/agents/${id}` : '/agents'}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        className="card-hover cursor-pointer"
      >
        <Card variant="glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <AnimatedAgentAvatar
                  agentId={id || name}
                  size="sm"
                  animation="pulse"
                  gradientBorder
                />
                <div>
                  <div className="font-semibold text-white">{name}</div>
                  <div className="text-xs text-white/60">{displayStrategy}</div>
                </div>
              </div>
              <Badge variant={statusColors[status] || 'info'} size="sm" dot>
                {status}
              </Badge>
            </div>
            {walletAddr && (
              <div className="mb-2 px-2 py-1.5 bg-white/5 rounded-lg">
                <div className="text-xs text-white/40 mb-0.5">Wallet</div>
                <code className="text-xs text-cyan-400 font-mono">{formatAddress(walletAddr)}</code>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white/5 rounded-lg">
                <div className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{formatPercentage(pnl)}
                </div>
                <div className="text-xs text-white/40">PnL</div>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <div className="text-sm font-semibold text-white">{trades}</div>
                <div className="text-xs text-white/40">Trades</div>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <div className="text-sm font-semibold text-white">{trustScore}</div>
                <div className="text-xs text-white/40">Trust</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

// Recent transactions - uses real data from usePortfolio
function RecentTransactions() {
  const { transactions, isLoading } = usePortfolio();

  // Show loading skeleton if loading
  if (isLoading) {
    return (
      <Card variant="glass" className="col-span-full lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/portfolio" className="text-xs text-purple-400 hover:text-primary-300">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-6 bg-white/10 rounded" />
                  <div className="w-16 h-4 bg-white/10 rounded" />
                </div>
                <div className="text-right">
                  <div className="w-16 h-4 bg-white/10 rounded mb-1" />
                  <div className="w-10 h-3 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no transactions
  if (transactions.length === 0) {
    return (
      <Card variant="glass" className="col-span-full lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/portfolio" className="text-xs text-purple-400 hover:text-primary-300">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6 text-white/40" />
            </div>
            <p className="text-white/60 text-sm">No recent activity</p>
            <p className="text-white/40 text-xs mt-1">Deploy an agent to start trading</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="col-span-full lg:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link href="/portfolio" className="text-xs text-purple-400 hover:text-primary-300">
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.slice(0, 5).map((tx, i) => (
            <motion.div
              key={tx.id || i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  variant={tx.type === 'buy' ? 'success' : tx.type === 'sell' ? 'danger' : 'info'}
                  size="sm"
                >
                  {tx.type.toUpperCase()}
                </Badge>
                {tx.txHash ? (
                  <a
                    href={`https://monadscan.com/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-medium truncate text-sm hover:underline"
                    title={tx.txHash}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                  </a>
                ) : (
                  <span className="text-white font-medium truncate text-sm" title={tx.token}>
                    {tx.token.length > 12 ? `${tx.token.slice(0, 6)}...${tx.token.slice(-4)}` : tx.token}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-white/80 text-sm">{formatCurrency(tx.value)}</div>
                <div className="text-white/40 text-xs">{timeAgo(tx.timestamp)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Quick actions with Lucide icons and colored backgrounds
function QuickActions() {
  const actions = [
    { 
      icon: Rocket, 
      label: 'Deploy Agent', 
      href: '/agents/create',
      bgColor: 'from-cyan-500/20 to-blue-500/20',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
    },
    { 
      icon: Trophy, 
      label: 'Leaderboard', 
      href: '/leaderboard',
      bgColor: 'from-yellow-500/20 to-amber-500/20',
      iconColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30',
    },
    { 
      icon: Wallet, 
      label: 'Deposit', 
      href: '/portfolio',
      bgColor: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
      borderColor: 'border-green-500/30',
    },
    { 
      icon: BarChart3, 
      label: 'Analytics', 
      href: '/dashboard',
      bgColor: 'from-purple-500/20 to-violet-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/30',
    },
  ];

  return (
    <Card variant="glass" className="col-span-full">
      <CardHeader>
        <CardTitle className="bg-gradient-to-r from-cyan-300 via-red-500 to-purple-800 bg-clip-text text-transparent">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {actions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "p-4 rounded-xl text-center cursor-pointer transition-all border",
                    "bg-gradient-to-br hover:brightness-110",
                    action.bgColor,
                    action.borderColor
                  )}
                >
                  <div className={cn("w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center bg-white/10", action.iconColor)}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-white">{action.label}</div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Main dashboard page content - uses real data from API
function DashboardPageContent() {
  const { isConnected } = useAccount();
  const { agents, isLoading: agentsLoading } = useMyAgents();

  return (
    <DashboardLayout showFooter={false}>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white"
          >
            Dashboard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/60 mt-1"
          >
            Monitor your AI agents and portfolio performance
          </motion.p>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portfolio Summary */}
          <PortfolioSummary />

          {/* Performance Chart */}
          <PerformanceChart />

          {/* Recent Transactions */}
          <RecentTransactions />

          {/* Active Agents */}
          <div className="col-span-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
              <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
                Monitoring Agents
              </span>
              </h2>
              <Link href="/agents">
              <Button variant="ghost" size="sm" className="bg-gradient-to-r from-purple-500 to-green-500 text-white hover:opacity-90">
                View All
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
              </Link>
            </div>
            
            {/* Loading state */}
            {agentsLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} variant="glass">
                    <CardContent className="pt-4">
                      <div className="animate-pulse">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-white/10 rounded-full" />
                          <div>
                            <div className="w-24 h-4 bg-white/10 rounded mb-1" />
                            <div className="w-16 h-3 bg-white/10 rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="p-2 bg-white/5 rounded-lg">
                              <div className="w-12 h-4 bg-white/10 rounded mx-auto mb-1" />
                              <div className="w-8 h-3 bg-white/10 rounded mx-auto" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {/* Empty state - not connected */}
            {!isConnected && !agentsLoading && (
              <Card variant="glass">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-white/60 text-sm mb-4">Connect to view and manage your AI agents</p>
                </CardContent>
              </Card>
            )}
            
            {/* Empty state - no agents */}
            {isConnected && !agentsLoading && agents.length === 0 && (
              <Card variant="glass">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Agents Yet</h3>
                  <p className="text-white/60 text-sm mb-4">Deploy your first AI agent to start trading</p>
                  <Link href="/agents/create">
                    <Button>
                      <Rocket className="w-4 h-4 mr-2" />
                      <span className="font-bold bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
                      Deploy Agent First
                      </span>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            
            {/* Agent cards */}
            {!agentsLoading && agents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.slice(0, 6).map((agent, i) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <AgentStatusCard
                      id={agent.id}
                      name={agent.name}
                      strategy={agent.strategy}
                      status={agent.status}
                      pnl={agent.pnl}
                      trades={agent.totalTrades}
                      trustScore={agent.trustScore}
                      walletAddr={agent.walletAddr}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <QuickActions />
        </div>
      </div>
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageLoadingFallback message="Loading dashboard..." />}>
        <DashboardPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
