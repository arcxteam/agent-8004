'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Diamond,
  Shield,
  BarChart3,
  Scale,
  CheckCircle,
  Coins,
  Activity,
  Zap,
  Grid3X3,
  LineChart,
  Target,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  BadgeCheck,
  ExternalLink,
  Eye,
  HandCoins,
  Info,
  Copy,
  CheckCheck,
  Sparkle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  AnimatedAgentAvatar,
  Modal,
} from '@/components/ui';
import { DashboardLayout } from '@/components/layout';
import { cn, formatAddress, formatCurrency, formatPercentage } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import { useAccount } from 'wagmi';
import { useDelegateCapital, useVaultAddress } from '@/hooks/useCapitalVault';

// Agent leaderboard data type
interface LeaderboardAgent {
  rank: number;
  name: string;
  address: string;
  avatar: string;
  strategy: string;
  trustScore: number;
  pnl: number;
  pnlPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  tvl: number;
  trades: number;
  winRate: number;
  verified: boolean;
  trending: 'up' | 'down' | 'stable';
  badges: string[];
  // On-chain IDs for delegation
  anoaAgentId?: string | number | bigint | null;
  erc8004AgentId?: string | number | bigint | null;
  walletAddr?: string | null;
  activeDelegations?: number;
}

// Default empty state for leaderboard
const ITEMS_PER_PAGE = 10;

// API response types
interface LeaderboardResponse {
  success: boolean;
  data: {
    agents: LeaderboardAgent[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
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

// Strategy color mapping - used for filter pills and table badges
const strategyColors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  'all': { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', hover: 'hover:bg-slate-500/30' },
  'momentum': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', hover: 'hover:bg-purple-500/30' },
  'yield': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', hover: 'hover:bg-orange-500/30' },
  'arbitrage': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', hover: 'hover:bg-red-500/30' },
  'dca': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', hover: 'hover:bg-cyan-500/30' },
  'grid': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', hover: 'hover:bg-pink-500/30' },
  'hedge': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', hover: 'hover:bg-yellow-500/30' },
  'n/a': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', hover: 'hover:bg-gray-500/30' },
};

// Get strategy color by name
function getStrategyColor(strategy: string) {
  const key = strategy.toLowerCase();
  return strategyColors[key] || strategyColors['n/a'];
}

// Stat card for top section
function StatCard({ label, value, icon, trend, iconComponent }: { label: string; value: string; icon?: string; trend?: string; iconComponent?: React.ReactNode }) {
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {trend && (
            <p className={cn(
              'text-sm font-medium',
              trend.startsWith('+') ? 'text-success' : 'text-danger'
            )}>
              {trend}
            </p>
          )}
        </div>
        {iconComponent ? (
          iconComponent
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center text-2xl">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// View My Rank Modal
function ViewMyRankModal({
  isOpen,
  onClose,
  agents,
  totalAgents,
}: {
  isOpen: boolean;
  onClose: () => void;
  agents: LeaderboardAgent[];
  totalAgents: number;
}) {
  const { address, isConnected } = useAccount();
  const [searchedAgent, setSearchedAgent] = useState<LeaderboardAgent | null>(null);
  const [searching, setSearching] = useState(false);

  // Find user's agent — first check current page, then search via API
  const localAgent = agents.find(a => a.address.toLowerCase() === address?.toLowerCase());
  const userAgent = localAgent || searchedAgent;

  useEffect(() => {
    if (!isOpen || !address || !isConnected || localAgent) {
      setSearchedAgent(null);
      return;
    }

    // Agent not on current page — search across all agents
    const searchAll = async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/leaderboard?limit=100&sortBy=pnl`);
        const data = await res.json();
        if (data.success) {
          const found = data.data.agents.find(
            (a: LeaderboardAgent & { user?: { address: string } }) =>
              (a.user?.address || a.address || '').toLowerCase() === address.toLowerCase()
          );
          if (found) {
            setSearchedAgent({
              rank: found.rank,
              name: found.name || '',
              address: found.user?.address || found.address || '',
              avatar: found.imageUrl || '',
              strategy: found.strategy || 'N/A',
              trustScore: found.trustScore || 0,
              pnl: parseFloat(String(found.totalPnlUsd || found.pnl || 0)),
              pnlPercent: found.pnlPercent || 0,
              sharpeRatio: found.sharpeRatio || 0,
              maxDrawdown: found.maxDrawdown || 0,
              tvl: parseFloat(String(found.totalCapitalUsd || found.tvl || 0)),
              trades: found.totalTrades || found.trades || 0,
              winRate: found.winRate || 0,
              verified: found.verified || false,
              trending: found.trending || 'stable',
              badges: [],
              walletAddr: found.walletAddr ?? null,
            });
          }
        }
      } catch {
        // Silently fail
      } finally {
        setSearching(false);
      }
    };

    searchAll();
  }, [isOpen, address, isConnected, localAgent]);
  
  if (!isConnected) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Connect Wallet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Connect your wallet to view your agent's rank
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkle className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-foreground">My Ranking</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        
        {userAgent ? (
          <>
            {/* Rank Display */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm mb-2">Current Rank</p>
              <p className="text-5xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                #{userAgent.rank}
              </p>
              <p className="text-muted-foreground text-sm mt-2">out of {totalAgents} agents</p>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Trust Score</p>
                <p className="text-2xl font-bold text-foreground">{userAgent.trustScore}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">PnL</p>
                <p className={cn(
                  'text-2xl font-bold',
                  userAgent.pnl >= 0 ? 'text-success' : 'text-danger'
                )}>
                  {userAgent.pnl >= 0 ? '+' : ''}{formatCurrency(userAgent.pnl)}
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-foreground">{formatPercentage(userAgent.winRate)}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">TVL</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(userAgent.tvl)}</p>
              </div>
            </div>
            
            {/* Agent Info */}
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AnimatedAgentAvatar
                  agentId={userAgent.address}
                  size="lg"
                  animation="glow"
                  gradientBorder
                />
                <div>
                  <p className="font-semibold text-foreground">{userAgent.name}</p>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
                    <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent font-medium">
                      {userAgent.strategy}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : searching ? (
          /* Searching State */
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Searching for your agent...</p>
          </div>
        ) : (
          /* No Agent State */
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex items-center justify-center">
              <Users className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">No Agent Found</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You don't have any registered agents yet. Create an agent to participate in the leaderboard.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all"
            >
              <span className="bg-gradient-to-r from-cyan-400 to-red-500 bg-clip-text text-transparent font-medium">
                Create Agent First
              </span>
            </button>
          </div>
        )}
        
        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-700 hover:from-purple-700 hover:to-cyan-500 text-white font-semibold"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// View Agent Modal - Shows agent details and links to ERC-8004 smart contract
// ERC-8004 is an extension of ERC-721 (NFT) that represents AI Agent identity on-chain
function ViewAgentModal({
  isOpen,
  onClose,
  agent,
}: {
  isOpen: boolean;
  onClose: () => void;
  agent: LeaderboardAgent | null;
}) {
  const [copied, setCopied] = useState(false);
  
  const copyAddress = () => {
    const agentAddr = agent?.walletAddr || agent?.address;
    if (agentAddr) {
      navigator.clipboard.writeText(agentAddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!agent) return null;

  const strategyColor = getStrategyColor(agent.strategy);

  // Use agent's wallet address for explorer (fallback to owner address)
  const agentDisplayAddr = agent.walletAddr || agent.address;
  const explorerUrl = `https://monadscan.com/address/${agentDisplayAddr}`;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Eye className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-foreground">Agent Details</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            EIP-8004 AI Agent Identity (ERC-721 Extension)
          </p>
        </div>
        
        {/* Agent Card */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <AnimatedAgentAvatar
              agentId={agent.walletAddr || agent.name || agent.address}
              size="lg"
              animation="glow"
              gradientBorder
            />
            <div>
              <p className="font-semibold text-foreground text-lg">{agent.name || 'Unnamed Agent'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full border',
                  strategyColor.bg, strategyColor.border
                )}>
                  <span className={cn('font-medium', strategyColor.text)}>{agent.strategy}</span>
                </span>
                {agent.verified && (
                  <BadgeCheck className="w-4 h-4 text-brand-primary" />
                )}
              </div>
            </div>
          </div>
          
          {/* Contract Address */}
          <div className="bg-black/20 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Agent Wallet Address</p>
              <p className="font-mono text-sm text-foreground">{agentDisplayAddr}</p>
            </div>
            <button 
              onClick={copyAddress}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {copied ? (
                <CheckCheck className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Rank</p>
            <p className="text-xl font-bold text-foreground">#{agent.rank}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Trust Score</p>
            <p className="text-xl font-bold text-foreground">{agent.trustScore}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">PnL</p>
            <p className={cn('text-xl font-bold', agent.pnl >= 0 ? 'text-success' : 'text-danger')}>
              {agent.pnl >= 0 ? '+' : ''}{formatCurrency(agent.pnl)}
            </p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
            <p className="text-xl font-bold text-foreground">{formatPercentage(agent.winRate)}</p>
          </div>
        </div>
        
        {/* Additional Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Sharpe Ratio</p>
            <p className="text-lg font-bold text-foreground">{agent.sharpeRatio.toFixed(2)}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Max Drawdown</p>
            <p className="text-lg font-bold text-foreground">-{formatPercentage(agent.maxDrawdown)}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">TVL</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(agent.tvl)}</p>
          </div>
        </div>
        
        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground mb-1">What is ERC-8004?</p>
              <p className="text-muted-foreground">
                ERC-8004 extends ERC-721 with three on-chain registries: <strong>Identity Registry</strong> (agent discovery), 
                <strong>Reputation Registry</strong> (feedback & trust signals), and <strong>Validation Registry</strong> (independent verification). 
                This enables trustless Agent-to-Agent (A2A) interactions across organizational boundaries.
              </p>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border/50 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4 text-cyan-400" />
            <span className="text-foreground font-medium">View on Monadscan</span>
          </a>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-purple-600 hover:to-cyan-400 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Delegate Modal - Allows users to delegate capital to an AI agent
// Delegation is done through ERC-8004 smart contract on-chain
function DelegateModal({
  isOpen,
  onClose,
  agent,
}: {
  isOpen: boolean;
  onClose: () => void;
  agent: LeaderboardAgent | null;
}) {
  const { address, isConnected } = useAccount();
  const { address: vaultAddress, isDeployed, network } = useVaultAddress();
  const { delegate, isPending, isSuccess, hash, error, reset } = useDelegateCapital();
  const [amount, setAmount] = useState('');
  const [delegateStep, setDelegateStep] = useState<'input' | 'confirm' | 'processing' | 'success' | 'error'>('input');
  
  if (!agent) return null;
  
  const strategyColor = getStrategyColor(agent.strategy);
  
  // Get agent's on-chain ID (prefer anoaAgentId)
  const agentOnChainId = agent.anoaAgentId || agent.erc8004AgentId;
  const hasOnChainId = agentOnChainId !== null && agentOnChainId !== undefined;
  
  // Reset on modal open
  const handleClose = () => {
    setAmount('');
    setDelegateStep('input');
    reset();
    onClose();
  };
  
  // Handle delegation
  const handleDelegate = async () => {
    if (!hasOnChainId || !amount || parseFloat(amount) <= 0) return;
    
    try {
      setDelegateStep('processing');
      const agentId = BigInt(agentOnChainId.toString());
      await delegate(agentId, parseFloat(amount));
      setDelegateStep('success');
    } catch (err) {
      console.error('Delegation failed:', err);
      setDelegateStep('error');
    }
  };
  
  // Validation
  const parsedAmount = parseFloat(amount || '0');
  const isValidAmount = amount && parsedAmount >= 1000;
  const isBelowMin = amount && parsedAmount > 0 && parsedAmount < 1000;
  const delegationsFull = (agent.activeDelegations ?? 0) >= 5;
  const canDelegate = isConnected && isDeployed && hasOnChainId && isValidAmount && !isPending && !delegationsFull;
  
  if (!isConnected) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Connect Wallet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Connect your wallet to delegate to this agent
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }
  
  // Success state
  if (delegateStep === 'success' && hash) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Delegation Successful!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You have successfully delegated {amount} MON to {agent.name || 'this agent'}
            </p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
            <a 
              href={`https://monadscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan-400 hover:underline break-all flex items-center gap-1"
            >
              {hash.slice(0, 20)}...{hash.slice(-8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }
  
  // Error state
  if (delegateStep === 'error') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Info className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Delegation Failed</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {error?.message || 'An error occurred while delegating. Please try again.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border/50 hover:border-purple-500/50 transition-all text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setDelegateStep('input')}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
            >
              Try Again
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <HandCoins className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-foreground">Delegate A2A Capital</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Delegate funds to this AI agent into our smart contract
          </p>
        </div>
        
        {/* Agent Summary */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <AnimatedAgentAvatar
              agentId={agent.walletAddr || agent.name || agent.address}
              size="md"
              animation="pulse"
              gradientBorder
            />
            <div className="flex-1">
              <p className="font-semibold text-foreground">{agent.name || 'Unnamed Agent'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full border',
                  strategyColor.bg, strategyColor.border
                )}>
                  <span className={cn('font-medium', strategyColor.text)}>{agent.strategy}</span>
                </span>
                <span className="text-xs text-muted-foreground">Rank #{agent.rank}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Trust Score</p>
              <p className="text-lg font-bold text-foreground">{agent.trustScore}</p>
            </div>
          </div>
        </div>
        
        {/* Agent Performance */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">PnL</p>
            <p className={cn('text-lg font-bold', agent.pnl >= 0 ? 'text-success' : 'text-danger')}>
              {agent.pnl >= 0 ? '+' : ''}{formatPercentage(agent.pnlPercent)}
            </p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
            <p className="text-lg font-bold text-foreground">{formatPercentage(agent.winRate)}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Max DD</p>
            <p className="text-lg font-bold text-orange-400">-{formatPercentage(agent.maxDrawdown)}</p>
          </div>
        </div>
        
        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Delegation Amount</label>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isPending}
              className="w-full px-4 py-3 pr-20 rounded-xl bg-card border border-border/50 focus:border-cyan-500/50 focus:outline-none text-foreground text-lg disabled:opacity-50"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              MON
            </span>
          </div>
          {isBelowMin && (
            <p className="text-sm text-danger">Minimum delegation is 1,000 MON</p>
          )}
          {delegationsFull && (
            <p className="text-sm text-danger">This agent has reached the maximum of 5 delegators</p>
          )}
          <p className="text-xs text-muted-foreground">
            Minimum: 1,000 MON | Max delegators: 5 ({agent.activeDelegations ?? 0}/5 slots used)
          </p>
        </div>
        
        {/* Info Box */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground mb-1">How Delegation Works</p>
              <p className="text-muted-foreground">
                Your funds are sent to the ERC-8004 smart contract vault. The agent trades
                on your behalf and you earn proportional PnL based on your share of total capital.
                A 20% performance fee applies on profits only (no fee on losses).
                You can withdraw at any time, subject to the lockup policy.
              </p>
            </div>
          </div>
        </div>
        
        {/* Status Info */}
        {!isDeployed && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-400 font-medium">
              Capital Vault not deployed on this network. Please switch to Monad {network}.
            </p>
          </div>
        )}
        
        {!hasOnChainId && isDeployed && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
            <p className="text-sm text-purple-400 font-medium">
              This agent is not yet registered on-chain. Registration required before delegation.
            </p>
          </div>
        )}
        
        {/* Vault Address */}
        {vaultAddress && (
          <div className="text-xs text-muted-foreground text-center">
            Vault: <span className="font-mono">{vaultAddress.slice(0, 10)}...{vaultAddress.slice(-8)}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border/50 hover:border-purple-500/50 transition-all text-foreground font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelegate}
            disabled={!canDelegate}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-purple-600 hover:to-cyan-400 text-white font-semibold transition-all",
              !canDelegate && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Delegating...
              </span>
            ) : (
              'Delegate'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Podium for top 3 - Premium 3D design without medal overlay
function TopThreePodium({ agents }: { agents: LeaderboardAgent[] }) {
  const top3 = agents.slice(0, 3);
  // Order: position 0 = #2 (left), position 1 = #1 (center), position 2 = #3 (right)
  const podiumOrder = [1, 0, 2]; // Second, First, Third (for visual display)

  // Podium configurations
  const podiumConfig = [
    { // #2 - Silver (left)
      height: 'h-20',
      gradient: 'from-gray-400 via-gray-500 to-gray-600',
      glowColor: 'shadow-[0_0_30px_rgba(156,163,175,0.3)]',
      icon: <Shield className="w-6 h-6 text-gray-200" />,
      rank: '#2',
      avatarGlow: 'bg-gray-400'
    },
    { // #1 - Gold (center)
      height: 'h-28',
      gradient: 'from-yellow-400 via-amber-500 to-yellow-600',
      glowColor: 'shadow-[0_0_40px_rgba(251,191,36,0.4)]',
      icon: <Trophy className="w-8 h-8 text-yellow-200" />,
      rank: '#1',
      avatarGlow: 'bg-yellow-400'
    },
    { // #3 - Bronze (right)
      height: 'h-14',
      gradient: 'from-orange-400 via-orange-500 to-orange-700',
      glowColor: 'shadow-[0_0_25px_rgba(251,146,60,0.3)]',
      icon: <Target className="w-5 h-5 text-orange-200" />,
      rank: '#3',
      avatarGlow: 'bg-orange-400'
    },
  ];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-4 lg:gap-6 py-8 px-4">
      {podiumOrder.map((agentIndex, position) => {
        const agent = top3[agentIndex];
        const config = podiumConfig[position];
        if (!agent) return null;
        
        const strategyColor = getStrategyColor(agent.strategy);

        return (
          <motion.div
            key={agent.rank}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: position * 0.2, type: 'spring', stiffness: 100 }}
            className="flex flex-col items-center"
          >
            {/* Agent Avatar with floating animation - NO medal overlay */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: position * 0.2 + 0.3, type: 'spring', stiffness: 200 }}
              className="relative mb-4"
            >
              {/* Glow effect behind avatar */}
              <div className={cn(
                'absolute inset-0 rounded-full blur-xl opacity-50',
                config.avatarGlow
              )} />
              
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <AnimatedAgentAvatar
                  agentId={agent.walletAddr || agent.name || agent.address}
                  size={position === 1 ? 'xl' : 'lg'}
                  animation={position === 1 ? 'glow' : 'pulse'}
                  gradientBorder
                />
              </motion.div>
            </motion.div>

            {/* Agent Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: position * 0.2 + 0.4 }}
              className="text-center mb-3 w-24 sm:w-28 lg:w-36"
            >
              <p className="font-semibold text-foreground text-xs sm:text-sm truncate">
                {agent.name || 'N/A'}
              </p>
              {/* Strategy badge with color */}
              <span className={cn(
                'inline-block px-2 py-0.5 text-xs rounded-full border mt-1',
                strategyColor.bg, strategyColor.border
              )}>
                <span className={cn('font-medium', strategyColor.text)}>{agent.strategy}</span>
              </span>
              <div className="flex items-center justify-center gap-1 mt-1">
                {agent.pnlPercent >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-danger" />
                )}
                <span className={cn(
                  'text-xs font-bold',
                  agent.pnlPercent >= 0 ? 'text-success' : 'text-danger'
                )}>
                  {agent.pnlPercent >= 0 ? '+' : ''}{formatPercentage(agent.pnlPercent)}
                </span>
              </div>
            </motion.div>

            {/* Podium Block - Full 3D style */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: position * 0.2 + 0.5, type: 'spring', stiffness: 80 }}
              style={{ transformOrigin: 'bottom' }}
              className={cn(
                'w-24 sm:w-28 lg:w-36 rounded-t-xl relative overflow-hidden',
                config.height,
                config.glowColor
              )}
            >
              {/* Main gradient background */}
              <div className={cn(
                'absolute inset-0 bg-gradient-to-b opacity-90',
                config.gradient
              )} />
              
              {/* Top highlight */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/30" />
              
              {/* Side shine effect */}
              <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-white/20 to-transparent" />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1 pt-2">
                {config.icon}
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white drop-shadow-lg">
                  {config.rank}
                </span>
              </div>
              
              {/* Bottom border for depth */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20" />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Leaderboard table row
function LeaderboardRow({ 
  agent, 
  index,
  onView,
  onDelegate,
}: { 
  agent: LeaderboardAgent; 
  index: number;
  onView: (agent: LeaderboardAgent) => void;
  onDelegate: (agent: LeaderboardAgent) => void;
}) {
  const TrendIcon = agent.trending === 'up' ? ArrowUpRight : agent.trending === 'down' ? ArrowDownRight : Minus;
  const trendColors = { up: 'text-success', down: 'text-danger', stable: 'text-muted-foreground' };

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-border/50 hover:bg-card/50 transition-colors group"
    >
      {/* Rank */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-bold text-lg w-8',
            agent.rank <= 3 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            #{agent.rank}
          </span>
          <TrendIcon className={cn('w-4 h-4', trendColors[agent.trending])} />
        </div>
      </td>

      {/* Agent */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <AnimatedAgentAvatar
            agentId={agent.walletAddr || agent.name || agent.address}
            size="sm"
            animation="pulse"
            gradientBorder
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{agent.name || 'N/A'}</span>
              {agent.verified && (
                <Tooltip content="Verified Agent">
                  <BadgeCheck className="w-4 h-4 text-brand-primary" />
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">{formatAddress(agent.walletAddr || agent.address)}</span>
              {(() => {
                const colors = getStrategyColor(agent.strategy);
                return (
                  <span className={cn('px-2 py-0.5 text-xs rounded-full border', colors.bg, colors.border)}>
                    <span className={cn('font-medium', colors.text)}>
                      {agent.strategy}
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </td>

      {/* Trust Score */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-border/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-primary to-success"
              style={{ width: `${agent.trustScore}%` }}
            />
          </div>
          <span className="font-medium text-foreground">{agent.trustScore}</span>
        </div>
      </td>

      {/* PnL */}
      <td className="py-4 px-4 text-right">
        <p className={cn(
          'font-medium',
          agent.pnl >= 0 ? 'text-success' : 'text-danger'
        )}>
          {agent.pnl >= 0 ? '+' : ''}{formatCurrency(agent.pnl)}
        </p>
        <p className={cn(
          'text-sm',
          agent.pnlPercent >= 0 ? 'text-success/70' : 'text-danger/70'
        )}>
          {agent.pnlPercent >= 0 ? '+' : ''}{formatPercentage(agent.pnlPercent)}
        </p>
      </td>

      {/* Sharpe Ratio */}
      <td className="py-4 px-4 text-right">
        <span className={cn(
          'font-medium',
          agent.sharpeRatio >= 2 ? 'text-success' : agent.sharpeRatio >= 1 ? 'text-warning' : 'text-danger'
        )}>
          {agent.sharpeRatio.toFixed(2)}
        </span>
      </td>

      {/* Max Drawdown */}
      <td className="py-4 px-4 text-right">
        <span className={cn(
          'font-medium',
          agent.maxDrawdown <= 5 ? 'text-success' : agent.maxDrawdown <= 10 ? 'text-warning' : 'text-danger'
        )}>
          -{formatPercentage(agent.maxDrawdown)}
        </span>
      </td>

      {/* TVL */}
      <td className="py-4 px-4 text-right">
        <span className="font-medium text-foreground">{formatCurrency(agent.tvl)}</span>
      </td>

      {/* Win Rate */}
      <td className="py-4 px-4 text-right">
        <span className={cn(
          'font-medium',
          agent.winRate >= 70 ? 'text-success' : agent.winRate >= 50 ? 'text-warning' : 'text-danger'
        )}>
          {formatPercentage(agent.winRate)}
        </span>
      </td>

      {/* Actions */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onView(agent)}
            className="flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View
          </Button>
          <Button 
            size="sm" 
            onClick={() => onDelegate(agent)}
            className="flex items-center gap-1"
          >
            <HandCoins className="w-3 h-3" />
            Delegate
          </Button>
        </div>
      </td>
    </motion.tr>
  );
}

// Filter pills with strategy-specific colors
function FilterPills({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (filter: string) => void;
}) {
  const filters = [
    { id: 'all', label: 'All Agents', icon: Users },
    { id: 'momentum', label: 'Momentum', icon: TrendingUp },
    { id: 'yield', label: 'Yield', icon: Coins },
    { id: 'arbitrage', label: 'Arbitrage', icon: Zap },
    { id: 'dca', label: 'DCA', icon: BarChart3 },
    { id: 'grid', label: 'Grid', icon: Grid3X3 },
    { id: 'hedge', label: 'Hedge', icon: Shield },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selected === filter.id;
        const colors = getStrategyColor(filter.id);
        return (
          <button
            key={filter.id}
            onClick={() => onSelect(filter.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border',
              isSelected
                ? cn(colors.bg, colors.border, 'shadow-lg')
                : cn('bg-card border-border/50', colors.hover)
            )}
          >
            <Icon className={cn('w-4 h-4', isSelected ? colors.text : 'text-muted-foreground')} />
            <span className={cn(isSelected ? colors.text : 'text-muted-foreground')}>
              {filter.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Sort dropdown
function SortSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [
    { value: 'pnl', label: 'PnL (High to Low)' },
    { value: 'trust', label: 'Trust Score' },
    { value: 'sharpe', label: 'Sharpe Ratio' },
    { value: 'tvl', label: 'TVL' },
    { value: 'winrate', label: 'Win Rate' },
    { value: 'drawdown', label: 'Max Drawdown (Low)' },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full sm:w-auto min-w-0 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [&>option]:bg-[#0f0f1e] [&>option]:text-white cursor-pointer hover:border-cyan-500/50 transition-all truncate"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#0f0f1e] text-white">
          Sort by: {opt.label}
        </option>
      ))}
    </select>
  );
}

// Main Leaderboard Page content
function LeaderboardPageContent() {
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('pnl');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [viewMyRankOpen, setViewMyRankOpen] = useState(false);
  
  // View Agent and Delegate modal states
  const [selectedAgent, setSelectedAgent] = useState<LeaderboardAgent | null>(null);
  const [viewAgentOpen, setViewAgentOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAgents, setTotalAgents] = useState(0);
  
  // Data fetching state
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalAgents: 0,
    totalTvl: 0,
    totalPnl: 0,
    totalTrades: 0,
    avgTrustScore: 0,
    avgWinRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch leaderboard data from API
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortBy: sortBy,
        period: activeTab,
      });

      if (strategyFilter !== 'all') {
        params.append('strategy', strategyFilter);
      }

      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }
      
      const response = await fetch(`/api/leaderboard?${params}`);
      const data: LeaderboardResponse = await response.json();
      
      if (data.success) {
        // Map API response to LeaderboardAgent type
        const mappedAgents = data.data.agents.map((agent: LeaderboardAgent & { totalCapital?: number; totalPnl?: number; totalCapitalUsd?: number; totalPnlUsd?: number; totalTrades?: number; imageUrl?: string; user?: { address: string } }) => ({
          rank: agent.rank,
          name: agent.name || '',
          address: agent.user?.address || agent.address || '0x0000...0000',
          avatar: agent.imageUrl || '',
          strategy: agent.strategy || 'N/A',
          trustScore: agent.trustScore || 0,
          pnl: parseFloat(String(agent.totalPnlUsd || agent.pnl || 0)),
          pnlPercent: agent.pnlPercent || 0,
          sharpeRatio: agent.sharpeRatio || 0,
          maxDrawdown: agent.maxDrawdown || 0,
          tvl: parseFloat(String(agent.totalCapitalUsd || agent.tvl || 0)),
          trades: agent.totalTrades || agent.trades || 0,
          winRate: agent.winRate || 0,
          verified: agent.verified || false,
          trending: (agent.trending as 'up' | 'down' | 'stable') || 'stable',
          badges: agent.badges || [],
          // On-chain IDs for delegation
          anoaAgentId: agent.anoaAgentId ?? null,
          erc8004AgentId: agent.erc8004AgentId ?? null,
          walletAddr: agent.walletAddr ?? null,
        }));
        
        setAgents(mappedAgents);
        setTotalPages(data.data.pagination.totalPages);
        setTotalAgents(data.data.pagination.total);
        setGlobalStats(data.data.globalStats);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortBy, activeTab, strategyFilter, debouncedSearch]);
  
  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, activeTab, strategyFilter, debouncedSearch]);
  
  const handleViewAgent = (agent: LeaderboardAgent) => {
    setSelectedAgent(agent);
    setViewAgentOpen(true);
  };
  
  const handleDelegateAgent = (agent: LeaderboardAgent) => {
    setSelectedAgent(agent);
    setDelegateOpen(true);
  };

  // Search is now server-side — agents from API are already filtered
  
  // Generate pagination buttons
  const getPaginationButtons = () => {
    const buttons: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      buttons.push(1);
      
      if (currentPage > 3) {
        buttons.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!buttons.includes(i)) {
          buttons.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        buttons.push('...');
      }
      
      if (!buttons.includes(totalPages)) {
        buttons.push(totalPages);
      }
    }
    
    return buttons;
  };

  const tabs = [
    { id: 'all', label: 'All Time' },
    { id: '30d', label: '30 Days' },
    { id: '7d', label: '7 Days' },
    { id: '24h', label: '24 Hours' },
  ];

  return (
    <DashboardLayout showFooter={false}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-foreground"
            >
              Agent Leaderboard
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              Discover and delegate to top-performing AI trading agents
            </motion.p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setViewMyRankOpen(true)}>
            <Trophy className="w-4 h-4" />
            View My Rank
          </Button>
        </div>

        {/* Stats Overview - from API globalStats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Agents"
            value={globalStats.totalAgents.toLocaleString()}
            iconComponent={<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/20 to-cyan-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-yellow-400" /></div>}
          />
          <StatCard
            label="Total TVL"
            value={formatCurrency(parseFloat(String(globalStats.totalTvl || 0)))}
            iconComponent={<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400/20 to-purple-500/20 flex items-center justify-center"><Diamond className="w-6 h-6 text-purple-400" /></div>}
          />
          <StatCard
            label="Avg. Trust Score"
            value={(globalStats.avgTrustScore || 0).toFixed(1)}
            iconComponent={<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-cyan-500/20 flex items-center justify-center"><Shield className="w-6 h-6 text-cyan-400" /></div>}
          />
          <StatCard
            label="Total Trades"
            value={globalStats.totalTrades.toLocaleString()}
            iconComponent={<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400/20 to-green-500/20 flex items-center justify-center"><BarChart3 className="w-6 h-6 text-green-400" /></div>}
          />
        </div>

        {/* Top 3 Podium */}
        <Card variant="gradient" className="p-6 overflow-hidden">
          <div className="text-center mb-4 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-foreground">Top Performers</h2>
            </div>
            <p className="text-muted-foreground">The best Agent discovery this period</p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : agents.length >= 3 ? (
            <TopThreePodium agents={agents.slice(0, 3)} />
          ) : agents.length > 0 ? (
            <TopThreePodium agents={agents} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No agents registered yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Be the first to register an agent</p>
              </div>
            </div>
          )}
        </Card>

        {/* Filters & Search */}
        <Card variant="glass" className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <FilterPills selected={strategyFilter} onSelect={setStrategyFilter} />
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-5 h-5" />}
                className="w-full sm:w-48 lg:w-64"
              />
              <SortSelect value={sortBy} onChange={setSortBy} />
            </div>
          </div>
        </Card>

        {/* Time Period Tabs & Table */}
        <Card variant="glass" className="p-6">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Agent</th>
                  <th className="text-left py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Trust Score</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">PnL</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Sharpe</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Max DD</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">TVL</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Win Rate</th>
                  <th className="text-right py-3 px-4 text-sm font-medium bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {isLoading ? (
                    // Loading skeleton rows
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-b border-border/50">
                        <td className="py-4 px-4"><div className="h-4 w-8 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-muted/20 rounded-full animate-pulse" /><div className="h-4 w-32 bg-muted/20 rounded animate-pulse" /></div></td>
                        <td className="py-4 px-4"><div className="h-4 w-16 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-20 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-12 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-12 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-16 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-12 bg-muted/20 rounded animate-pulse" /></td>
                        <td className="py-4 px-4"><div className="h-4 w-24 bg-muted/20 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : agents.length > 0 ? (
                    agents.map((agent, index) => (
                      <LeaderboardRow 
                        key={agent.address + agent.rank} 
                        agent={agent} 
                        index={index}
                        onView={handleViewAgent}
                        onDelegate={handleDelegateAgent}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        No agents found. Be the first to register an agent!
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalAgents)} of {totalAgents} agents
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              {getPaginationButtons().map((btn, idx) => (
                typeof btn === 'number' ? (
                  <Button 
                    key={btn}
                    variant="outline" 
                    size="sm" 
                    className={currentPage === btn ? 'bg-brand-primary/10 border-brand-primary' : ''}
                    onClick={() => setCurrentPage(btn)}
                  >
                    {btn}
                  </Button>
                ) : (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                )
              ))}
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

        {/* Agent Trust Hierarchy */}
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-foreground">ANOA Agent Trust Hierarchy</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { title: 'Trading Agents', desc: 'Autonomous execution', Icon: LineChart, color: 'from-yellow-400/20 to-amber-500/20', iconColor: 'text-yellow-400' },
              { title: 'Risk Management', desc: 'Drawdown control', Icon: Scale, color: 'from-blue-400/20 to-indigo-500/20', iconColor: 'text-blue-400' },
              { title: 'Validation Layer', desc: 'On-chain verification', Icon: CheckCircle, color: 'from-green-400/20 to-emerald-500/20', iconColor: 'text-green-400' },
              { title: 'Yield Optimization', desc: 'LP & lending strategies', Icon: Coins, color: 'from-purple-400/20 to-violet-500/20', iconColor: 'text-purple-400' },
              { title: 'Reputation System', desc: 'Trust score tracking', Icon: Shield, color: 'from-red-400/20 to-red-500/20', iconColor: 'text-red-400' },
            ].map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'p-4 rounded-xl bg-gradient-to-br border border-border/50 text-center',
                  category.color
                )}
              >
                <category.Icon className={cn('w-8 h-8 mx-auto mb-2', category.iconColor)} />
                <h4 className="font-semibold text-foreground text-sm">{category.title}</h4>
                <p className="text-xs text-muted-foreground">{category.desc}</p>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Live Agent Metrics */}
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-foreground">Live Agent Performance Metrics</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {(() => {
              // Use globalStats from API
              const metrics = [
                { title: 'Total Trades', value: globalStats.totalTrades.toLocaleString(), Icon: Activity, color: 'from-cyan-400/20 to-blue-500/20', iconColor: 'text-cyan-400' },
                { title: 'Avg Win Rate', value: `${(globalStats.avgWinRate || 0).toFixed(1)}%`, Icon: Target, color: 'from-green-400/20 to-emerald-500/20', iconColor: 'text-green-400' },
                { title: 'Avg Trust Score', value: (globalStats.avgTrustScore || 0).toFixed(1), Icon: LineChart, color: 'from-purple-400/20 to-violet-500/20', iconColor: 'text-purple-400' },
                { title: 'Total PnL', value: formatCurrency(parseFloat(String(globalStats.totalPnl || 0))), Icon: TrendingDown, color: 'from-orange-400/20 to-red-500/20', iconColor: 'text-orange-400' },
                { title: 'Active Agents', value: `${globalStats.totalAgents}`, Icon: BadgeCheck, color: 'from-blue-400/20 to-indigo-500/20', iconColor: 'text-blue-400' },
              ];
              
              return metrics.map((metric, index) => (
                <motion.div
                  key={metric.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'p-4 rounded-xl bg-gradient-to-br border border-border/50 text-center',
                    metric.color
                  )}
                >
                  <metric.Icon className={cn('w-6 h-6 mx-auto mb-2', metric.iconColor)} />
                  <p className="text-xl font-bold text-foreground">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.title}</p>
                </motion.div>
              ));
            })()}
          </div>
        </Card>
      </div>
      
      {/* View My Rank Modal */}
      <ViewMyRankModal
        isOpen={viewMyRankOpen}
        onClose={() => setViewMyRankOpen(false)}
        agents={agents}
        totalAgents={totalAgents}
      />
      
      {/* View Agent Modal */}
      <ViewAgentModal
        isOpen={viewAgentOpen}
        onClose={() => setViewAgentOpen(false)}
        agent={selectedAgent}
      />
      
      {/* Delegate Modal */}
      <DelegateModal
        isOpen={delegateOpen}
        onClose={() => setDelegateOpen(false)}
        agent={selectedAgent}
      />
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function LeaderboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback message="Loading leaderboard..." />}>
        <LeaderboardPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
