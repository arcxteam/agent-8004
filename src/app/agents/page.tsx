'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedAgentAvatar } from '@/components/ui/agent-avatar';
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import { useAgents } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';
import { CloseAgentModal } from './closeAgent';

// Agent card component
function AgentCard({
  id,
  name,
  strategy,
  status,
  trustScore,
  pnl,
  totalTrades,
  winRate,
  tvl,
  createdAt,
  activeDelegations,
  totalDelegated,
  onSelect,
  onStop,
}: {
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
  activeDelegations?: number;
  totalDelegated?: number;
  onSelect: (id: string) => void;
  onStop?: (id: string) => void;
}) {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'Active' },
    paused: { variant: 'warning' as const, label: 'Paused' },
    stopped: { variant: 'danger' as const, label: 'Stopped' },
    pending: { variant: 'warning' as const, label: 'Pending' },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      style={{ willChange: 'transform' }}
      className="card-hover cursor-pointer"
      onClick={() => onSelect(id)}
    >
      <Card variant="glass" className="h-full">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <AnimatedAgentAvatar
                agentId={id}
                size="md"
                animation="pulse"
                gradientBorder
              />
              <div>
                <h3 className="font-bold text-white">{name}</h3>
                <p className="text-xs text-white/60">{strategy.toLowerCase().replace('_', ' ')}</p>
              </div>
            </div>
            <Badge variant={statusConfig[status].variant} dot size="sm">
              {statusConfig[status].label}
            </Badge>
          </div>

          {/* Capital Delegation Notification */}
          {activeDelegations && activeDelegations > 0 ? (
            <div className="mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-medium text-cyan-300">
                  {activeDelegations} delegator{activeDelegations > 1 ? 's' : ''} aktif
                </span>
                <span className="text-xs text-white/40 ml-auto">
                  {formatCurrency(totalDelegated || 0)} MON
                </span>
              </div>
            </div>
          ) : null}

          {/* Trust Score */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/60">Trust Score</span>
              <span className="text-white font-medium">{trustScore}/100</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${
                  trustScore >= 80
                    ? 'bg-emerald-500'
                    : trustScore >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${trustScore}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-white/5 rounded-xl">
              <div className="text-xs text-white/40 mb-1">PnL (30d)</div>
              <div className={`text-lg font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <div className="text-xs text-white/40 mb-1">Win Rate</div>
              <div className="text-lg font-bold text-white">{winRate}%</div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <div className="text-xs text-white/40 mb-1">TVL</div>
              <div className="text-lg font-bold text-white">{formatCurrency(tvl)}</div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <div className="text-xs text-white/40 mb-1">Trades</div>
              <div className="text-lg font-bold text-white">{formatNumber(totalTrades)}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-xs text-white/40">Created {timeAgo(createdAt)}</span>
            <div className="flex items-center gap-2">
              {status === 'active' && onStop && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onStop(id); }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  Stop
                </Button>
              )}
              <Button variant="ghost" size="sm">
                View Details
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Agent type definition for display
type AgentData = Agent;

// Main agents page content
function AgentsPageContent() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState('trust');
  const [selectedAgent, setSelectedAgent] = React.useState<string | null>(null);
  const [closingAgent, setClosingAgent] = React.useState<Agent | null>(null);

  // Fetch agents from API — filter by owner when "mine" tab is active
  const { agents, isLoading, error, refetch } = useAgents({
    status: activeTab !== 'all' && activeTab !== 'mine' ? activeTab : undefined,
  });

  // Log selected agent for development
  React.useEffect(() => {
    if (selectedAgent) {
      console.log('Selected agent:', selectedAgent);
    }
  }, [selectedAgent]);

  // Filter and sort agents
  const filteredAgents = React.useMemo(() => {
    let result = agents;

    // Filter by tab
    if (activeTab === 'mine' && address) {
      result = result.filter((agent) => agent.ownerAddress === address.toLowerCase());
    } else if (activeTab !== 'all' && activeTab !== 'mine') {
      result = result.filter((agent) => agent.status === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.strategy.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'trust':
        result = [...result].sort((a, b) => b.trustScore - a.trustScore);
        break;
      case 'pnl':
        result = [...result].sort((a, b) => b.pnl - a.pnl);
        break;
      case 'tvl':
        result = [...result].sort((a, b) => b.tvl - a.tvl);
        break;
      case 'trades':
        result = [...result].sort((a, b) => b.totalTrades - a.totalTrades);
        break;
    }

    return result;
  }, [agents, activeTab, searchQuery, sortBy]);

  const sortOptions: SelectOption[] = [
    { value: 'trust', label: 'Trust Score' },
    { value: 'pnl', label: 'Performance (PnL)' },
    { value: 'tvl', label: 'Total Value Locked' },
    { value: 'trades', label: 'Total Trades' },
  ];

  return (
    <DashboardLayout showFooter={false}>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-white"
            >
              AI Agents
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/60 mt-1"
            >
              Deploy and manage your autonomous trading agents
            </motion.p>
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
              placeholder="Sort by"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">
              All ({agents.length})
            </TabsTrigger>
            {address && (
              <TabsTrigger value="mine">
                My Agents
              </TabsTrigger>
            )}
            <TabsTrigger value="active">
              Active ({agents.filter((a) => a.status === 'active').length})
            </TabsTrigger>
            <TabsTrigger value="paused">
              Paused ({agents.filter((a) => a.status === 'paused').length})
            </TabsTrigger>
            <TabsTrigger value="stopped">
              Stopped ({agents.filter((a) => a.status === 'stopped').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Agent Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">Loading agents...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Failed to load agents</h3>
            <p className="text-white/60 mb-4">{error.message}</p>
            <Button variant="ghost" onClick={() => refetch()}>Try Again</Button>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                {...agent}
                onSelect={setSelectedAgent}
                onStop={(id) => {
                  const agentToClose = agents.find(a => a.id === id);
                  if (agentToClose) setClosingAgent(agentToClose);
                }}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {filteredAgents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No agents found</h3>
            <p className="text-white/60 mb-6">
              {searchQuery
                ? 'Try adjusting your search criteria'
                : "You haven't created any agents yet"}
            </p>
            <Link href="/agents/create">
                <Button>
                <span className="font-bold bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
                  Create Your First Agent
                </span>
                </Button>
            </Link>
          </motion.div>
        )}
        </>
        )}
      </div>

      {/* Close Agent Modal */}
      {closingAgent && (
        <CloseAgentModal
          agentId={closingAgent.id}
          agentName={closingAgent.name}
          walletAddr={closingAgent.walletAddr || null}
          isOpen={!!closingAgent}
          onClose={() => setClosingAgent(null)}
          onSuccess={() => refetch()}
        />
      )}
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function AgentsPage() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageLoadingFallback message="Loading agents..." />}>
        <AgentsPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
