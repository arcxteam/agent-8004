/**
 * Token Discovery Module
 *
 * Discovers tradable tokens from nad.fun platform by QUERYING ON-CHAIN EVENTS:
 * 1. CurveBuy/CurveSell events → find actively traded tokens (last 1 hour)
 * 2. CurveCreate events → find newly created tokens (last 6 hours)
 * 3. Enrich with market data from nad.fun API + Lens on-chain data
 * 4. Filter by volume, holders, lock status
 * 5. Rank by trade activity and bonding curve progress
 *
 * This replaces the old approach that only enriched pre-known addresses.
 * Now the agent autonomously discovers tokens from the Curve contract events.
 *
 * Reference: documents/nad-fun/indexer.md, documents/nad-fun/abi.md
 */

import { getMarketData, getTokenInfo } from '@/lib/nadfun-api';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig, CONTRACTS } from '@/config/chains';
import { curveAbi, lensAbi } from '@/config/contracts';
import { getRpcUrl } from '@/lib/config';
import { createFallbackTransport } from '@/config/rpc';
import { createPublicClient } from 'viem';
import type { Address } from 'viem';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiscoveredToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  holders: number;
  progress: number;       // 0-10000 basis points (bonding curve)
  isGraduated: boolean;
  isLocked: boolean;
  marketCap: number;
  createdAtBlock?: number; // Block number when token was created (from CurveCreate event)
}

// ─── Configuration ──────────────────────────────────────────────────────────

const DISCOVERY_CONFIG = {
  maxTokens: 5,                 // Return top 5 tokens (optimized for 10 req/min rate limit)
  maxEnrich: 8,                 // Max tokens to enrich via API (2 calls each = 16 API calls max)
  minVolume: 100,               // Minimum 24h volume in MON
  minHolders: 5,                // Minimum holder count
  lensCallTimeout: 8000,        // Timeout for on-chain calls (ms)
  apiCallTimeout: 10000,        // Timeout for API calls (ms)
  // Event query ranges (in blocks, ~0.5s per block on Monad)
  buyEventBlocks: 7200n,        // ~1 hour of blocks for CurveBuy/CurveSell
  createEventBlocks: 7200n,     // ~1 hour of blocks for CurveCreate
  eventChunkSize: 500n,         // Monad mainnet RPC limit ~500 blocks per getLogs
} as const;

// ─── Main Discovery Function ────────────────────────────────────────────────

/**
 * Discover tradable tokens from nad.fun platform.
 *
 * Strategy:
 * 1. Query CurveBuy + CurveSell events from Curve contract → actively traded tokens
 * 2. Query CurveCreate events → newly created tokens (potential early entries)
 * 3. Merge with any candidateAddresses provided (e.g., from scheduler defaults)
 * 4. Deduplicate and enrich with market data + on-chain Lens data
 * 5. Filter and rank by volume and bonding curve progress
 */
export async function discoverTradableTokens(
  candidateAddresses: string[] = []
): Promise<DiscoveredToken[]> {
  const { network } = getNetworkConfig();
  const contracts = CONTRACTS[network];
  const chain = network === 'mainnet'
    ? (await import('@/config/chains')).monadMainnet
    : (await import('@/config/chains')).monadTestnet;

  // Use fallback transport for event queries (multiple RPC endpoints for reliability)
  const eventClient = createPublicClient({
    chain,
    transport: createFallbackTransport(network),
  });

  // Use timeout client for Lens on-chain calls
  const rpcUrl = getRpcUrl(network);
  const lensClient = createTimeoutPublicClient(chain, rpcUrl, DISCOVERY_CONFIG.lensCallTimeout);

  // ── Step 1: Discover actively traded tokens via on-chain events ──
  let eventTokenAddresses: string[] = [];
  const tokenCreatedAtBlock = new Map<string, number>();

  try {
    const latestBlock = await eventClient.getBlockNumber();
    console.log(`[TokenDiscovery] Latest block: ${latestBlock}`);

    // Query CurveBuy + CurveSell events to find actively traded tokens
    const buyFromBlock = latestBlock > DISCOVERY_CONFIG.buyEventBlocks
      ? latestBlock - DISCOVERY_CONFIG.buyEventBlocks
      : 0n;

    const [buyEvents, sellEvents] = await Promise.all([
      getContractEventsChunked(
        eventClient,
        contracts.CURVE as Address,
        curveAbi,
        'CurveBuy',
        buyFromBlock,
        latestBlock,
        DISCOVERY_CONFIG.eventChunkSize
      ),
      getContractEventsChunked(
        eventClient,
        contracts.CURVE as Address,
        curveAbi,
        'CurveSell',
        buyFromBlock,
        latestBlock,
        DISCOVERY_CONFIG.eventChunkSize
      ),
    ]);

    // Count trades per token to rank by activity
    const tradeCount = new Map<string, number>();
    for (const event of [...buyEvents, ...sellEvents]) {
      const tokenAddr = (event.args as { token: string }).token?.toLowerCase();
      if (tokenAddr) {
        tradeCount.set(tokenAddr, (tradeCount.get(tokenAddr) || 0) + 1);
      }
    }

    console.log(`[TokenDiscovery] Found ${buyEvents.length} buys + ${sellEvents.length} sells across ${tradeCount.size} tokens`);

    // Query CurveCreate events for newly created tokens
    const createFromBlock = latestBlock > DISCOVERY_CONFIG.createEventBlocks
      ? latestBlock - DISCOVERY_CONFIG.createEventBlocks
      : 0n;

    const createEvents = await getContractEventsChunked(
      eventClient,
      contracts.CURVE as Address,
      curveAbi,
      'CurveCreate',
      createFromBlock,
      latestBlock,
      DISCOVERY_CONFIG.eventChunkSize
    );

    for (const event of createEvents) {
      const tokenAddr = (event.args as { token: string }).token?.toLowerCase();
      if (tokenAddr) {
        if (!tradeCount.has(tokenAddr)) {
          tradeCount.set(tokenAddr, 0); // New token, no trades yet but discovered
        }
        // Track creation block for anti-sniping awareness
        const blockNum = Number(event.blockNumber || 0);
        if (blockNum > 0) {
          tokenCreatedAtBlock.set(tokenAddr, blockNum);
        }
      }
    }

    console.log(`[TokenDiscovery] Found ${createEvents.length} newly created tokens`);

    // Sort by trade count descending, take top tokens (limited for API rate limit)
    eventTokenAddresses = [...tradeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, DISCOVERY_CONFIG.maxEnrich)
      .map(([addr]) => addr);

  } catch (err) {
    console.warn('[TokenDiscovery] Event query failed, falling back to candidates only:', err);
  }

  // ── Step 2: Merge with candidate addresses ──
  // Prioritize event-discovered tokens over static candidates
  // Limit total tokens to enrich (API rate limit: 10 req/min, 2 calls per token)
  const allAddresses = new Set([
    ...eventTokenAddresses,
    ...candidateAddresses.map(a => a.toLowerCase()),
  ]);

  // Limit enrichment to maxEnrich to respect API rate limits
  // Event tokens come first (already sorted by activity), then candidates fill remaining slots
  const uniqueAddresses = [...allAddresses].slice(0, DISCOVERY_CONFIG.maxEnrich);

  if (uniqueAddresses.length === 0) {
    console.log('[TokenDiscovery] No tokens found from events or candidates');
    return [];
  }

  console.log(`[TokenDiscovery] Evaluating ${uniqueAddresses.length} tokens (${eventTokenAddresses.length} from events + ${candidateAddresses.length} candidates)`);

  // ── Step 3: Enrich token data (API + on-chain) ──
  const results = await Promise.allSettled(
    uniqueAddresses.map(async (addr) => {
      const token = await enrichTokenData(addr, contracts.LENS, lensClient);
      if (token) {
        // Attach creation block if known (from CurveCreate event)
        token.createdAtBlock = tokenCreatedAtBlock.get(addr);
      }
      return token;
    })
  );

  // Collect successful results
  const tokens: DiscoveredToken[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      tokens.push(result.value);
    }
  }

  // ── Step 4: Filter by minimum thresholds ──
  const filtered = tokens.filter(t =>
    t.volume24h >= DISCOVERY_CONFIG.minVolume &&
    t.holders >= DISCOVERY_CONFIG.minHolders &&
    !t.isLocked // Cannot trade locked tokens
  );

  // ── Step 5: Sort by volume descending, then progress descending ──
  filtered.sort((a, b) => {
    if (b.volume24h !== a.volume24h) return b.volume24h - a.volume24h;
    return b.progress - a.progress;
  });

  // Return top N
  const topTokens = filtered.slice(0, DISCOVERY_CONFIG.maxTokens);
  console.log(`[TokenDiscovery] Found ${topTokens.length} tradable tokens (from ${uniqueAddresses.length} evaluated)`);

  return topTokens;
}

// ─── Event Query Helper ─────────────────────────────────────────────────────

/**
 * Query contract events in chunks to avoid RPC block range limits.
 * Paginates from `fromBlock` to `toBlock` in chunks of `chunkSize`.
 */
async function getContractEventsChunked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  contractAddress: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  eventName: string,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEvents: any[] = [];
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo = currentFrom + chunkSize > toBlock
      ? toBlock
      : currentFrom + chunkSize;

    try {
      const events = await publicClient.getContractEvents({
        address: contractAddress,
        abi,
        eventName,
        fromBlock: currentFrom,
        toBlock: currentTo,
      });
      allEvents.push(...events);
    } catch (err) {
      // If chunk fails (e.g., too many results), try smaller chunk
      console.warn(`[TokenDiscovery] Event chunk ${currentFrom}-${currentTo} failed:`, err);
    }

    currentFrom = currentTo + 1n;
  }

  return allEvents;
}

// ─── Token Enrichment ───────────────────────────────────────────────────────

/**
 * Enrich a single token address with API + on-chain data.
 * Returns null if token data cannot be fetched.
 */
async function enrichTokenData(
  tokenAddress: string,
  lensAddress: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any
): Promise<DiscoveredToken | null> {
  try {
    // Fetch API data and on-chain data in parallel
    const [tokenInfo, marketData, onChainData] = await Promise.all([
      getTokenInfo(tokenAddress).catch(() => null),
      getMarketData(tokenAddress).catch(() => null),
      fetchOnChainData(tokenAddress as Address, lensAddress, publicClient).catch(() => null),
    ]);

    // Require at least token info
    if (!tokenInfo) return null;

    return {
      address: tokenAddress,
      symbol: tokenInfo.symbol || 'UNKNOWN',
      name: tokenInfo.name || '',
      price: marketData ? parseFloat(marketData.priceUsd) || 0 : 0,
      volume24h: marketData ? parseFloat(marketData.volume24h) || 0 : 0,
      holders: marketData ? marketData.holders || 0 : 0,
      marketCap: marketData ? parseFloat(marketData.marketCap) || 0 : 0,
      progress: onChainData?.progress ?? tokenInfo.progress ?? 0,
      isGraduated: onChainData?.isGraduated ?? tokenInfo.graduated ?? false,
      isLocked: onChainData?.isLocked ?? false,
    };
  } catch (err) {
    console.warn(`[TokenDiscovery] Failed to enrich ${tokenAddress}:`, err);
    return null;
  }
}

/**
 * Fetch on-chain bonding curve data from Lens contract.
 */
async function fetchOnChainData(
  tokenAddress: Address,
  lensAddress: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any
): Promise<{ progress: number; isGraduated: boolean; isLocked: boolean }> {
  const [progress, isGraduated, isLocked] = await Promise.all([
    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'getProgress',
      args: [tokenAddress],
    }).catch(() => BigInt(0)),

    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'isGraduated',
      args: [tokenAddress],
    }).catch(() => false),

    publicClient.readContract({
      address: lensAddress,
      abi: lensAbi,
      functionName: 'isLocked',
      args: [tokenAddress],
    }).catch(() => false),
  ]);

  return {
    progress: Number(progress),
    isGraduated: Boolean(isGraduated),
    isLocked: Boolean(isLocked),
  };
}
