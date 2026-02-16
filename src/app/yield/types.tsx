import Image from 'next/image';
import {
  TrendingUp,
  Target,
  Zap,
  Grid3X3,
  Shield,
  Pyramid,
} from 'lucide-react';

// ==========================================
// Types & Interfaces
// ==========================================

// Vault/Strategy type
export interface YieldStrategy {
  id: string;
  name: string;
  protocol: string;
  icon: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  tokens: string[];
  description: string;
  minDeposit: number;
  minDepositUnit?: 'usd' | 'native'; // 'usd' for stablecoins, 'native' for MON
  lockPeriod?: string;
  featured?: boolean;
  sharePrice?: number;
  apyBreakdown?: {
    '1d': number;
    '7d': number;
    '30d': number;
  };
  campaignApy?: number;
}

// User deposits - derived from connected wallet on-chain balances
export interface UserDeposit {
  strategy: string;
  amount: number;      // token amount (aprMON or earnAUSD)
  amountUsd: number;   // USD value of deposit
  earned: number;      // earned in token terms
  earnedUsd: number;   // earned in USD
  depositDate: string;
}

// API response type
export interface YieldApiResponse {
  success: boolean;
  data: YieldStrategy[];
  cached?: boolean;
  cacheAge?: number;
  nextRefresh?: string;
  error?: string;
}

// ==========================================
// Constants
// ==========================================

// Token logo mapping
export const tokenLogos: Record<string, string> = {
  'aUSD': '/icons/aUSD-monad.png',
  'USDC': '/icons/usdc-monad.png',
  'MON': '/icons/monad.png',
  'aprMON': '/icons/aprmon.png',
  'WMON': '/icons/wmon.png',
  'earnAUSD': '/icons/earnAUSD-monad.png',
};

// Strategy icon mapping - using Image for real protocols, Lucide for Agent Protocol
export const strategyIcons: Record<string, React.ReactNode> = {
  'upshift-ausd': <Image src="/icons/earnAUSD-monad.png" alt="earnAUSD" width={54} height={54} className="rounded-lg" />,
  'mon-staking': <Image src="/icons/aprmon.png" alt="aprMON" width={54} height={54} className="rounded-lg" />,
  'momentum-vault': <TrendingUp className="w-6 h-6 text-yellow-400" />,
  'grid-trading': <Grid3X3 className="w-6 h-6 text-blue-400" />,
  'dca-accumulator': <Target className="w-6 h-6 text-cyan-400" />,
  'arbitrage-flash': <Zap className="w-6 h-6 text-orange-400" />,
  'yield-optimization': <Pyramid className="w-6 h-6 text-green-400" />,
  'hedging-strategy': <Shield className="w-6 h-6 text-purple-400" />,
};

// Fallback yield strategies (used when API fails)
export const fallbackStrategies: YieldStrategy[] = [
  {
    id: 'upshift-ausd',
    name: 'earnAUSD Liquid Yield',
    protocol: 'By Upshift',
    icon: 'dollar',
    apy: 0, // Will be replaced by live API data
    tvl: 0,
    risk: 'low',
    tokens: ['aUSD', 'USDC'],
    description: 'The primary liquid yield token on Monad. Deposit aUSD/USDC to receive earnAUSD. Systematically allocating across top DeFi opportunities including lending and basis trades.',
    minDeposit: 0,
    minDepositUnit: 'usd',
    featured: true,
  },
  {
    id: 'mon-staking',
    name: 'MONAD Liquid Staking',
    protocol: 'By aPriori',
    icon: 'coins',
    apy: 0, // Will be replaced by live API data
    tvl: 0,
    risk: 'low',
    tokens: ['MON', 'aprMON'],
    description: 'Stake MON and receive aprMON while earning staking rewards. Maintain liquidity with your staked assets.',
    minDeposit: 1,
    minDepositUnit: 'native',
    featured: true,
  },
  {
    id: 'momentum-vault',
    name: 'Momentum Strategy',
    protocol: 'Agent Protocol',
    icon: 'trending',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'high',
    tokens: ['MON', 'WMON'],
    description: 'AI-powered momentum trading strategy. Higher risk for potentially higher returns. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'native',
    lockPeriod: '7 days',
  },
  {
    id: 'grid-trading',
    name: 'Grid Trading Bot',
    protocol: 'Agent Protocol',
    icon: 'grid',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'medium',
    tokens: ['MON', 'USDC', 'aUSD'],
    description: 'Automated grid trading in ranging markets. Best for sideways market conditions. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'usd',
    lockPeriod: '3 days',
  },
  {
    id: 'dca-accumulator',
    name: 'DCA Accumulator',
    protocol: 'Agent Protocol',
    icon: 'target',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'low',
    tokens: ['USDC', 'aUSD', 'MON'],
    description: 'Dollar cost averaging into MON positions. Systematic buying reduces timing risk. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'usd',
    lockPeriod: 'No Lockup',
  },
  {
    id: 'arbitrage-flash',
    name: 'Flash Arbitrage',
    protocol: 'Agent Protocol',
    icon: 'zap',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'high',
    tokens: ['MON', 'WMON', 'aUSD'],
    description: 'High-frequency arbitrage across DEXes. Requires significant capital for best returns. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'native',
    lockPeriod: '1 day',
  },
  {
    id: 'yield-optimization',
    name: 'Yield Optimization',
    protocol: 'Agent Protocol',
    icon: 'percent',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'low',
    tokens: ['aUSD', 'USDC', 'earnAUSD'],
    description: 'AI-driven yield farming across Monad DeFi protocols. Automatically rebalances between lending, LP, and vault strategies for optimal risk-adjusted returns. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'usd',
    lockPeriod: '3 days',
  },
  {
    id: 'hedging-strategy',
    name: 'Hedging Strategy',
    protocol: 'Agent Protocol',
    icon: 'shield',
    apy: 0, // Coming Soon
    tvl: 0,
    risk: 'medium',
    tokens: ['MON', 'aUSD', 'WMON'],
    description: 'Delta-neutral hedging using long/short positions to protect portfolio value during market volatility. Minimizes downside risk while capturing yield. Coming Soon.',
    minDeposit: 0,
    minDepositUnit: 'native',
    lockPeriod: '7 days',
  },
];
