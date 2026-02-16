'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import {
  TrendingUp,
  BarChart3,
  Shield,
  Lock,
  AlertTriangle,
  Bot,
  RefreshCw,
  CheckCircle,
  Layers,
  Pyramid,
  CircleDollarSign,
} from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import {
  useAprMonBalance,
  useEarnAusdBalance,
  useMonBalance,
  useAusdBalance,
  useUsdcBalance,
} from '@/hooks/useYield';
import { useTokenPrice } from '@/hooks/useTokenPrices';
import type { YieldStrategy, UserDeposit } from './types';
import { tokenLogos, strategyIcons } from './types';

// ==========================================
// RiskBadge
// ==========================================

export function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-red-500/20 text-red-500 border-red-500/30',
  };
  const labels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };
  return <Badge className={cn('text-xs whitespace-nowrap', styles[risk])}>{labels[risk]}</Badge>;
}

// ==========================================
// StrategyCard
// ==========================================

export function StrategyCard({
  strategy,
  onDeposit,
  onWithdraw,
  userDeposit,
}: {
  strategy: YieldStrategy;
  onDeposit: (strategy: YieldStrategy) => void;
  onWithdraw: (type: 'aprMON' | 'earnAUSD') => void;
  userDeposit?: UserDeposit;
}) {
  // Check if this is a Coming Soon strategy (Agent Protocol with 0 APY)
  const isComingSoon = strategy.protocol === 'Agent Protocol' && strategy.apy === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        variant={strategy.featured ? 'gradient' : 'glass'}
        className={cn(
          'p-6 h-full relative overflow-hidden',
          strategy.featured && 'border-brand-primary/50',
          isComingSoon && 'opacity-75'
        )}
      >
        {/* Featured badge */}
        {strategy.featured && (
          <div className="absolute top-0 right-0">
            <div className="bg-gradient-to-r from-brand-primary to-brand-accent text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              Featured
            </div>
          </div>
        )}

        {/* Coming Soon badge */}
        {isComingSoon && (
          <div className="absolute top-0 right-0">
            <div className="bg-gradient-to-r from-purple-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              Coming Soon
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center">
              {strategyIcons[strategy.id] || <Layers className="w-6 h-6 text-brand-primary" />}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{strategy.name}</h3>
              <p className="text-sm text-muted-foreground">{strategy.protocol}</p>
            </div>
          </div>
          <RiskBadge risk={strategy.risk} />
        </div>

        {/* APY */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">APY</p>
          {isComingSoon ? (
            <p className="text-3xl font-bold text-muted-foreground">N/A</p>
          ) : (
            <p className="text-3xl font-bold text-success">{formatPercentage(strategy.apy)}</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">TVL</p>
            <p className="font-semibold text-foreground">
              {isComingSoon ? 'N/A' : formatCurrency(strategy.tvl)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Min Deposit</p>
            <p className="font-semibold text-foreground">
              {strategy.minDeposit === 0
                ? 'No minimum'
                : strategy.minDepositUnit === 'native'
                  ? `${strategy.minDeposit} MON`
                  : formatCurrency(strategy.minDeposit)}
            </p>
          </div>
        </div>

        {/* Tokens */}
        <div className="flex flex-wrap gap-2 mb-4">
          {strategy.tokens.map((token) => (
            <Badge key={token} className="bg-purple-500/20 text-purple-300 border-purple-500/30 flex items-center gap-1.5">
              {tokenLogos[token] && (
                <Image src={tokenLogos[token]} alt={token} width={14} height={14} className="rounded-full" />
              )}
              {token}
            </Badge>
          ))}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{strategy.description}</p>

        {/* Lock Period */}
        {strategy.lockPeriod && (
          <div className="flex items-center gap-2 mb-4 text-sm text-warning">
            <Lock className="w-4 h-4" />
            <span>Lock period: {strategy.lockPeriod}</span>
          </div>
        )}

        {/* User Deposit Info */}
        {userDeposit && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Deposit</span>
              <span className="font-semibold text-foreground">{formatCurrency(userDeposit.amountUsd)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Earned</span>
              <span className="font-semibold text-success">+{formatCurrency(userDeposit.earnedUsd)}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isComingSoon ? (
            <button
              className="w-full px-4 py-2 rounded-lg border border-orange-500/30 bg-gradient-to-r from-cyan-500/10 to-orange-500/10 hover:from-cyan-500/20 hover:to-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all duration-300 cursor-not-allowed opacity-75"
              disabled
            >
              <span className="bg-gradient-to-r from-purple-500 to-red-500 font-semibold bg-clip-text text-transparent">
                Coming Soon
              </span>
            </button>
          ) : userDeposit ? (
            <>
              <button
                className="flex-1 px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300"
                onClick={() => onWithdraw(strategy.id === 'mon-staking' ? 'aprMON' : 'earnAUSD')}
              >
                <span className="bg-gradient-to-r from-cyan-500 to-orange-500 font-semibold bg-clip-text text-transparent">
                  Withdraw
                </span>
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-300 text-white font-semibold"
                onClick={() => onDeposit(strategy)}
              >
                Deposit
              </button>
            </>
          ) : (
            <button
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-purple-800 hover:from-purple-800 hover:to-cyan-600 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-300 text-white font-semibold"
              onClick={() => onDeposit(strategy)}
            >
              Deposit Now
            </button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ==========================================
// YieldOverview — Portfolio stats cards
// ==========================================

export function YieldOverview({ strategies }: { strategies: YieldStrategy[] }) {
  const { address, isConnected } = useAccount();

  // Fetch user's yield token balances (positions)
  const { data: aprMonBalance } = useAprMonBalance(address);
  const { data: earnAusdBalance } = useEarnAusdBalance(address);

  // Fetch user's input token balances (available to deposit)
  const { data: monBalance } = useMonBalance(address);
  const { data: ausdBalance } = useAusdBalance(address);
  const { data: usdcBalance } = useUsdcBalance(address);

  // Get real MON price from CoinGecko
  const { price: monPriceData } = useTokenPrice('MON');
  const monPriceUsd = monPriceData?.priceUsd || 0;

  // Get positions in terms of original tokens
  const monDeposited = aprMonBalance ? parseFloat(formatEther(aprMonBalance)) : 0;
  const stableDeposited = earnAusdBalance ? parseFloat(formatUnits(earnAusdBalance, 6)) : 0;

  // Calculate total deposited value in USD
  const monDepositedUsd = monDeposited * monPriceUsd;
  const stableDepositedUsd = stableDeposited; // aUSD/USDC are pegged to $1
  const totalDeposited = monDepositedUsd + stableDepositedUsd;

  // Get live APY from fetched strategies instead of hardcoded values
  const aprMonApy = strategies.find(s => s.id === 'mon-staking')?.apy ?? 0;
  const earnAusdApy = strategies.find(s => s.id === 'upshift-ausd')?.apy ?? 0;
  const avgApy = totalDeposited > 0
    ? ((monDepositedUsd * aprMonApy) + (stableDepositedUsd * earnAusdApy)) / totalDeposited
    : 0;

  // Estimated annual earnings
  const estimatedEarnings = totalDeposited * (avgApy / 100);

  // Format position breakdown (show simple text)
  const getPositionBreakdown = () => {
    if (monDeposited > 0 && stableDeposited > 0) return 'Monad + Stablecoins';
    if (monDeposited > 0) return 'MON deposited';
    if (stableDeposited > 0) return 'Stablecoins deposited';
    return 'No deposits yet';
  };

  const stats = isConnected ? [
    {
      label: 'Total Deposited',
      value: totalDeposited > 0 ? formatCurrency(totalDeposited) : '$0.00',
      Icon: CircleDollarSign,
      color: 'text-cyan-400',
      change: getPositionBreakdown()
    },
    {
      label: 'Est. Annual Earnings',
      value: estimatedEarnings > 0 ? `+${formatCurrency(estimatedEarnings)}` : '$0.00',
      Icon: TrendingUp,
      color: 'text-green-400',
      change: estimatedEarnings > 0 ? 'Based on current APY' : 'Deposit to start earning'
    },
    {
      label: 'Avg. APY',
      value: avgApy > 0 ? `${avgApy.toFixed(2)}%` : '0%',
      Icon: BarChart3,
      color: 'text-purple-400',
      change: avgApy > 0 ? 'Weighted by deposits' : 'Deposit to earn'
    },
    {
      label: 'Auto-Compound',
      value: 'Enabled',
      Icon: RefreshCw,
      color: 'text-orange-400',
      change: 'Rewards compound'
    },
  ] : [
    { label: 'Total Deposited', value: '--', Icon: CircleDollarSign, color: 'text-cyan-400', change: 'Connect wallet to view' },
    { label: 'Est. Annual Earnings', value: '--', Icon: TrendingUp, color: 'text-green-400', change: 'Connect wallet to view' },
    { label: 'Avg. APY', value: '--', Icon: BarChart3, color: 'text-purple-400', change: 'Connect wallet to view' },
    { label: 'Auto-Compound', value: '--', Icon: RefreshCw, color: 'text-orange-400', change: 'Connect wallet to view' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card variant="glass" className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.change}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center">
                <stat.Icon className={cn('w-6 h-6', stat.color)} />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ==========================================
// UpshiftBanner — Featured earnAUSD banner
// ==========================================

export function UpshiftBanner({ apy, tvl, sharePrice, isLoading, onDeposit }: { apy: number; tvl: number; sharePrice?: number; isLoading: boolean; onDeposit: () => void }) {
  return (
    <Card variant="gradient" className="p-6 relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-brand-primary/20 to-transparent rounded-full blur-3xl" />
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center shadow-glow overflow-hidden">
            <Image src="/icons/aUSD-monad.png" alt="aUSD" width={150} height={150} className="rounded-lg" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AUSD Vault</h2>
            <p className="text-muted-foreground">
              Deposit aUSD or USDC to receive earnAUSD and earn optimized DeFi yields
            </p>
            {tvl > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                TVL: {formatCurrency(tvl)} | Share Price: ${sharePrice ? sharePrice.toFixed(4) : '—'}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">aUSD Vault APY</p>
          {isLoading ? (
            <div className="h-12 w-24 bg-white/10 animate-pulse rounded-lg" />
          ) : (
            <p className="text-4xl font-bold text-success">{formatPercentage(apy)}</p>
          )}
          <div className="flex gap-2 mt-1 justify-end">
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Auto-Compounding</Badge>
            <Badge className="bg-purple-500/20 text-red-500 border-purple-500/30">4 Days Withdrawal</Badge>
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-4">
        <button
          onClick={onDeposit}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-300 text-white font-semibold flex items-center gap-2"
        >
          <Image src="/icons/aUSD-monad.png" alt="aUSD" width={20} height={20} className="rounded-lg" />
          Deposit Now
        </button>
        <button
          className="px-6 py-2.5 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-green-500/10 hover:from-cyan-500/20 hover:to-green-500/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300"
          onClick={() => window.open('https://app.upshift.finance/pools/143/0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA', '_blank')}
        >
          <span className="bg-gradient-to-r from-cyan-400 to-green-400 font-semibold bg-clip-text text-transparent">
            View on Upshift
          </span>
        </button>
      </div>
    </Card>
  );
}

// ==========================================
// Info Cards — Risk Levels & Yield Generation
// ==========================================

export function YieldInfoCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          Risk Levels Explained
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Low</span>
            <p className="text-sm text-muted-foreground">
              Stable strategies with minimal risk. Includes stablecoin vaults and liquid staking.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Medium</span>
            <p className="text-sm text-muted-foreground">
              Moderate risk strategies. May include impermanent loss exposure or market volatility.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">High</span>
            <p className="text-sm text-muted-foreground">
              Higher risk for potentially higher returns. Includes leveraged positions and active trading.
            </p>
          </div>
        </div>
      </Card>

      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary" />
          How Yields Are Generated
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Bot size={20} className="text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">AI Trading Agents</p>
              <p className="text-sm text-muted-foreground">
                Autonomous agents execute optimized trading strategies verified EIP-8004 & EIP-712.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCw size={15} className="text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Auto-Compounding</p>
              <p className="text-sm text-muted-foreground">
                Rewards are automatically reinvested to maximize your returns.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle size={15} className="text-green-400 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Validated Performance</p>
              <p className="text-sm text-muted-foreground">
                All agent performance is independently validated on-chain.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
