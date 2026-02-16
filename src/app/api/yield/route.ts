import { NextResponse } from 'next/server';

// Cache configuration - 12 hours in milliseconds
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

// Cache storage
interface CacheEntry {
  data: YieldStrategyResponse[];
  timestamp: number;
}

let cache: CacheEntry | null = null;

// External API endpoints
const APRIORI_API = 'https://stake-api-prod.apr.io/info?apr_period=1';
const APRIORI_ORACLE_API = 'https://stake-api-prod.apr.io/oracle_info';
const UPSHIFT_API = 'https://api.upshift.finance/v1/tokenized_vaults/0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA';

// Contract addresses
const APRMON_CONTRACT = '0x0c65A0BC65a5D819235B71F554D210D3F80E0852';
const EARNAUSD_CONTRACT = '0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA';
// earnAUSD receipt token contract (used for user balance queries)
export const EARNAUSD_RECEIPT_CONTRACT = '0x103222f020e98Bba0AD9809A011FDF8e6F067496';

// Response types
interface AprioriInfoResponse {
  apr: number;
  apy: number;
  boost: number;
  stakers: number;
  tvl: string; // in wei
  vault_contract_address: string;
}

interface AprioriOracleResponse {
  latest_update_epoch: number;
  latest_update_started_at: number;
  update_interval: number;
}

interface UpshiftVaultResponse {
  address: string;
  vault_name: string | null;
  chain: number;
  description: string | null;
  status: string;
  risk: string | null;
  receipt_token_symbol: string | null;
  reported_apy: {
    apy: number | null;
    underlying_apy: number | null;
    liquid_apy: number | null;
    rewards_compounded: number | null;
    rewards_claimable: number | null;
    explainer: string | null;
  } | null;
  historical_apy: {
    '1': number;
    '7': number;
    '30': number;
  } | null;
  campaign_apy: number | null;
  pnl_per_share: {
    '1': number;
    '7': number;
    '30': number;
  } | null;
  max_drawdown: number | null;
  metrics_last_updated: string | null;
  historical_snapshots: Array<{
    total_assets: number;
    total_shares: number;
    asset_share_ratio: number;
    underlying_price: number;
    snapshot_datetime: string;
    tvl: number;
  }>;
  rewards: Array<{
    text: string | null;
    multiplier: number | null;
  }>;
  tvl: number | null;
}

export interface YieldStrategyResponse {
  id: string;
  name: string;
  protocol: string;
  icon: string;
  apy: number;
  apr?: number;
  tvl: number;
  tvlFormatted: string;
  risk: 'low' | 'medium' | 'high';
  tokens: string[];
  description: string;
  minDeposit: number;
  lockPeriod?: string;
  featured: boolean;
  contractAddress: string;
  receiptToken?: string;
  lastUpdated: string;
  source: 'apriori' | 'upshift' | 'agent-protocol';
  sharePrice?: number;
  apyBreakdown?: {
    '1d': number;
    '7d': number;
    '30d': number;
  };
  campaignApy?: number;
  maxDrawdown?: number;
  additionalInfo?: {
    stakers?: number;
    boost?: number;
    oracleEpoch?: number;
    rewards?: string[];
  };
}

// Helper to format TVL
function formatTvl(tvlWei: string, decimals: number = 18): { value: number; formatted: string } {
  const value = parseFloat(tvlWei) / Math.pow(10, decimals);
  const formatted = value >= 1_000_000_000
    ? `$${(value / 1_000_000_000).toFixed(2)}B`
    : value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000
    ? `$${(value / 1_000).toFixed(2)}K`
    : `$${value.toFixed(2)}`;
  return { value, formatted };
}

// Fetch aPriori MON Liquid Staking data
async function fetchAprioriData(): Promise<YieldStrategyResponse | null> {
  try {
    const [infoResponse, oracleResponse] = await Promise.all([
      fetch(APRIORI_API, { next: { revalidate: 43200 } }), // 12 hours
      fetch(APRIORI_ORACLE_API, { next: { revalidate: 43200 } }),
    ]);

    if (!infoResponse.ok) {
      console.error('aPriori API error:', infoResponse.status);
      return null;
    }

    const info: AprioriInfoResponse = await infoResponse.json();
    const oracle: AprioriOracleResponse = oracleResponse.ok 
      ? await oracleResponse.json() 
      : { latest_update_epoch: 0, latest_update_started_at: 0, update_interval: 0 };

    const tvlData = formatTvl(info.tvl, 18);

    return {
      id: 'mon-staking',
      name: 'MONAD Liquid Staking',
      protocol: 'By aPriori',
      icon: 'coins',
      apy: parseFloat(info.apy.toFixed(2)),
      apr: parseFloat(info.apr.toFixed(2)),
      tvl: tvlData.value,
      tvlFormatted: tvlData.formatted,
      risk: 'low',
      tokens: ['MON', 'aprMON'],
      description: 'Stake MON and receive aprMON while earning staking rewards. Maintain liquidity with your staked assets.',
      minDeposit: 1,
      featured: true,
      contractAddress: APRMON_CONTRACT,
      receiptToken: 'aprMON',
      lastUpdated: new Date().toISOString(),
      source: 'apriori',
      additionalInfo: {
        stakers: info.stakers,
        boost: parseFloat(info.boost.toFixed(2)),
        oracleEpoch: oracle.latest_update_epoch,
      },
    };
  } catch (error) {
    console.error('Error fetching aPriori data:', error);
    return null;
  }
}

// Fetch Upshift aUSD vault data
async function fetchUpshiftData(): Promise<YieldStrategyResponse | null> {
  try {
    // Use cache: 'no-store' response Upshift API > 
    // 15MB due to historical snapshots, so we want to avoid caching at CDN/edge level and handle it in-memory instead
    const response = await fetch(UPSHIFT_API, { cache: 'no-store' });

    if (!response.ok) {
      console.error('Upshift API error:', response.status);
      return null;
    }

    // Parse the full JSON — Upshift API returns ~15MB due to 58K historical_snapshots
    const vault: UpshiftVaultResponse = await response.json();

    // Extract only what we need, then let GC reclaim the 15MB
    const historicalApy = vault.historical_apy;
    const campaignApyRaw = vault.campaign_apy;
    const tvl = vault.tvl ?? 0;
    const maxDrawdownRaw = vault.max_drawdown;
    const metricsUpdated = vault.metrics_last_updated;
    const rewards = vault.rewards?.map(r => r.text).filter(Boolean) as string[];

    // Get share price from very last snapshot only, then drop the array
    const snapshots = vault.historical_snapshots;
    const sharePrice = (snapshots && snapshots.length > 0)
      ? snapshots[snapshots.length - 1].asset_share_ratio
      : 1.0;

    // Explicitly dereference to help GC free ~15MB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = vault as any;
    delete v.historical_snapshots;
    delete v.daily_pnl_per_share;
    delete v.composability_integrations;

    // historical_apy: annualized APY from share price changes (decimal form)
    const apy30d = historicalApy ? historicalApy['30'] * 100 : 0;
    const apy7d = historicalApy ? historicalApy['7'] * 100 : 0;
    const apy1d = historicalApy ? historicalApy['1'] * 100 : 0;

    // Campaign/Merkl APY — already in percentage form (e.g., 5.98 = 5.98%)
    const campaignApyPct = campaignApyRaw ?? 0;

    // Total APY = 30D base APY + campaign/Merkl rewards (matches official Upshift website)
    const totalApy = parseFloat((apy30d + campaignApyPct).toFixed(2));

    // Max drawdown (decimal form, convert to percentage)
    const maxDrawdown = maxDrawdownRaw ? parseFloat((maxDrawdownRaw * 100).toFixed(2)) : undefined;

    return {
      id: 'upshift-ausd',
      name: 'earnAUSD Liquid Yield',
      protocol: 'By Upshift',
      icon: 'dollar',
      apy: totalApy,
      tvl,
      tvlFormatted: `$${(tvl / 1_000_000).toFixed(2)}M`,
      risk: 'low',
      tokens: ['aUSD', 'USDC'],
      description: 'The primary liquid yield token on Monad. Deposit aUSD/USDC to receive earnAUSD. Systematically allocating across top DeFi opportunities including lending and basis trades.',
      minDeposit: 0,
      featured: true,
      contractAddress: EARNAUSD_CONTRACT,
      receiptToken: 'earnAUSD',
      lastUpdated: metricsUpdated || new Date().toISOString(),
      source: 'upshift',
      sharePrice: parseFloat(sharePrice.toFixed(6)),
      apyBreakdown: {
        '1d': parseFloat(apy1d.toFixed(2)),
        '7d': parseFloat(apy7d.toFixed(2)),
        '30d': parseFloat(apy30d.toFixed(2)),
      },
      campaignApy: campaignApyPct > 0 ? parseFloat(campaignApyPct.toFixed(2)) : undefined,
      maxDrawdown,
      additionalInfo: {
        rewards,
      },
    };
  } catch (error) {
    console.error('Error fetching Upshift data:', error);
    return null;
  }
}

// Agent Protocol strategies - Coming Soon (will be integrated with ANOA agents)
function getAgentProtocolStrategies(): YieldStrategyResponse[] {
  return [
    {
      id: 'momentum-vault',
      name: 'Momentum Strategy',
      protocol: 'Agent Protocol',
      icon: 'trending',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'high',
      tokens: ['MON', 'WMON'],
      description: 'AI-powered momentum trading strategy. Higher risk for potentially higher returns. Coming Soon.',
      minDeposit: 500,
      lockPeriod: '7 days',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
    {
      id: 'grid-trading',
      name: 'Grid Trading Bot',
      protocol: 'Agent Protocol',
      icon: 'grid',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'medium',
      tokens: ['MON', 'USDC', 'aUSD'],
      description: 'Automated grid trading in ranging markets. Best for sideways market conditions. Coming Soon.',
      minDeposit: 250,
      lockPeriod: '3 days',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
    {
      id: 'dca-accumulator',
      name: 'DCA Accumulator',
      protocol: 'Agent Protocol',
      icon: 'target',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'low',
      tokens: ['USDC', 'aUSD', 'MON'],
      description: 'Dollar cost averaging into MON positions. Systematic buying reduces timing risk. Coming Soon.',
      minDeposit: 50,
      lockPeriod: 'No Lockup',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
    {
      id: 'arbitrage-flash',
      name: 'Flash Arbitrage',
      protocol: 'Agent Protocol',
      icon: 'zap',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'high',
      tokens: ['MON', 'WMON', 'aUSD'],
      description: 'High-frequency arbitrage across DEXes. Requires significant capital for best returns. Coming Soon.',
      minDeposit: 1000,
      lockPeriod: '1 day',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
    {
      id: 'yield-optimization',
      name: 'Yield Optimization',
      protocol: 'Agent Protocol',
      icon: 'percent',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'low',
      tokens: ['aUSD', 'USDC', 'earnAUSD'],
      description: 'AI-driven yield farming across Monad DeFi protocols. Automatically rebalances between lending, LP, and vault strategies for optimal risk-adjusted returns. Coming Soon.',
      minDeposit: 100,
      lockPeriod: '3 days',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
    {
      id: 'hedging-strategy',
      name: 'Hedging Strategy',
      protocol: 'Agent Protocol',
      icon: 'shield',
      apy: 0, // Coming Soon
      tvl: 0,
      tvlFormatted: 'N/A',
      risk: 'medium',
      tokens: ['MON', 'aUSD', 'WMON'],
      description: 'Delta-neutral hedging using long/short positions to protect portfolio value during market volatility. Minimizes downside risk while capturing yield. Coming Soon.',
      minDeposit: 500,
      lockPeriod: '7 days',
      featured: false,
      contractAddress: '0x0000000000000000000000000000000000000000',
      lastUpdated: new Date().toISOString(),
      source: 'agent-protocol',
    },
  ];
}

// Check if cache is valid
function isCacheValid(): boolean {
  if (!cache) return false;
  const now = Date.now();
  return now - cache.timestamp < CACHE_DURATION_MS;
}

// GET /api/yield - Get all yield strategies with real-time data
export async function GET() {
  try {
    // Return cached data if valid
    if (isCacheValid() && cache) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cache.timestamp) / 1000 / 60), // minutes
        nextRefresh: new Date(cache.timestamp + CACHE_DURATION_MS).toISOString(),
      });
    }

    // Fetch real-time data from external APIs
    const [aprioriData, upshiftData] = await Promise.all([
      fetchAprioriData(),
      fetchUpshiftData(),
    ]);

    // Combine with agent protocol strategies
    const agentStrategies = getAgentProtocolStrategies();
    
    const strategies: YieldStrategyResponse[] = [];

    // Add real-time data first (featured)
    if (upshiftData) strategies.push(upshiftData);
    if (aprioriData) strategies.push(aprioriData);

    // Add fallback for failed fetches — show with 0 APY to indicate unavailable data
    if (!upshiftData) {
      strategies.push({
        id: 'upshift-ausd',
        name: 'earnAUSD Liquid Yield',
        protocol: 'By Upshift',
        icon: 'dollar',
        apy: 0,
        tvl: 0,
        tvlFormatted: 'N/A',
        risk: 'low',
        tokens: ['aUSD', 'USDC'],
        description: 'The primary liquid yield token on Monad. Deposit aUSD/USDC to receive earnAUSD. Systematically allocating across top DeFi opportunities.',
        minDeposit: 0,
        featured: true,
        contractAddress: EARNAUSD_CONTRACT,
        receiptToken: 'earnAUSD',
        lastUpdated: new Date().toISOString(),
        source: 'upshift',
      });
    }

    if (!aprioriData) {
      strategies.push({
        id: 'mon-staking',
        name: 'MONAD Liquid Staking',
        protocol: 'By aPriori',
        icon: 'coins',
        apy: 0,
        tvl: 0,
        tvlFormatted: 'N/A',
        risk: 'low',
        tokens: ['MON', 'aprMON'],
        description: 'Stake MON and receive aprMON while earning staking rewards. Maintain liquidity with your staked assets.',
        minDeposit: 0,
        featured: true,
        contractAddress: APRMON_CONTRACT,
        receiptToken: 'aprMON',
        lastUpdated: new Date().toISOString(),
        source: 'apriori',
      });
    }

    // Add agent protocol strategies
    strategies.push(...agentStrategies);

    // Update cache
    cache = {
      data: strategies,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      data: strategies,
      cached: false,
      nextRefresh: new Date(cache.timestamp + CACHE_DURATION_MS).toISOString(),
    });
  } catch (error) {
    console.error('Error in yield API:', error);
    
    // Return cached data even if expired on error
    if (cache) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true,
        stale: true,
        error: 'Failed to refresh data, returning stale cache',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch yield data' },
      { status: 500 }
    );
  }
}

// POST /api/yield/refresh - Force refresh the cache
export async function POST() {
  // Clear cache to force refresh
  cache = null;
  
  // Call GET to fetch fresh data
  return GET();
}
