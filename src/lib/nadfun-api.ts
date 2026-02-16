/**
 * nad.fun Agent API Client
 *
 * Wrapper for nad.fun REST API for market data, chart data, and swap history.
 * Supports both testnet (dev-api.nad.fun) and mainnet (api.nadapp.net).
 *
 * Rate limit: 10 req/min tanpa API key (publik), 100 req/min dengan key.
 * Throttle queue otomatis mengatur jarak antar request.
 *
 * Reference: documents/nad-fun/agent-api.md
 */

import { getCurrentNetwork } from '@/lib/config';

const API_URLS = {
  testnet: 'https://dev-api.nad.fun',
  mainnet: 'https://api.nadapp.net',
} as const;

function getApiUrl(): string {
  const network = getCurrentNetwork();
  return API_URLS[network];
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = process.env.NAD_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

// ─── Rate Limit Throttle ─────────────────────────────────────────────────────
// Tanpa API key: 10 req/min = 1 req per 6s
// Dengan API key: 100 req/min = 1 req per 600ms

const MIN_INTERVAL_NO_KEY = 6500;  // 6.5s between requests (safe margin)
const MIN_INTERVAL_WITH_KEY = 650; // 650ms between requests
let lastRequestTime = 0;

// Simple in-memory cache (5 minute TTL)
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  // Purge old entries if cache grows too large
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expires < now) cache.delete(k);
    }
  }
}

async function throttle(): Promise<void> {
  const minInterval = process.env.NAD_API_KEY ? MIN_INTERVAL_WITH_KEY : MIN_INTERVAL_NO_KEY;
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < minInterval) {
    await new Promise(r => setTimeout(r, minInterval - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchApi<T>(path: string, retries = 3): Promise<T> {
  // Check cache first
  const cached = getCached<T>(path);
  if (cached !== null) return cached;

  const url = `${getApiUrl()}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Throttle: wait between requests to respect rate limit
      await throttle();

      const res = await fetch(url, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 429 && attempt < retries) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
        console.warn(`[nadfun] Rate limited on ${path}, retrying after ${retryAfter}s (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (res.status >= 500 && attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[nadfun] Server error ${res.status} on ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`nad.fun API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setCache(path, data);
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt);
      console.warn(`[nadfun] Fetch error on ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error(`nad.fun API failed after ${retries + 1} attempts: ${path}`);
}

// Timeframe mapping: our labels → nad.fun API numeric values (minutes or '1D')
// Confirmed supported: 1, 5, 60, 1D
// Extended: 15 (15m), 240 (4h) — requested but may not return data, handled gracefully
const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '6h': '360',
  '24h': '1D',
};

// Reverse map: nad.fun API values → our labels
const TIMEFRAME_REVERSE: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  '360': '6h',
  '1D': '24h',
};

// Resolution mapping for chart data
const RESOLUTION_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
};

/**
 * Get market data for a token (price, volume, holders, market cap)
 *
 * API: GET /agent/market/:token_id
 * Returns: { market_info: { price_usd, holder_count, volume, ... } }
 */
export async function getMarketData(tokenAddress: string) {
  const raw = await fetchApi<{
    market_info: {
      market_type?: string;
      price_usd?: string;
      holder_count?: number;
      volume?: string;
      ath_price?: string;
      market_cap?: string;
      liquidity?: string;
      price?: string;
    };
  }>(`/agent/market/${tokenAddress}`);

  const info = raw.market_info || {};
  return {
    token: tokenAddress,
    price: info.price || '0',
    priceUsd: info.price_usd || '0',
    volume24h: info.volume || '0',
    holders: info.holder_count || 0,
    marketCap: info.market_cap || '0',
    liquidity: info.liquidity || '0',
  };
}

/**
 * Get token metrics (price changes over different timeframes)
 *
 * API: GET /agent/metrics/:token_id?timeframes=5,60,360,1D
 * Returns: { metrics: [{ timeframe, percent, transactions, volume, makers }] }
 */
export async function getTokenMetrics(
  tokenAddress: string,
  timeframes: string[] = ['5m', '1h', '6h', '24h']
) {
  // Convert our timeframe labels to API numeric params
  const apiTimeframes = timeframes
    .map(tf => TIMEFRAME_MAP[tf] || tf)
    .join(',');

  const raw = await fetchApi<{
    metrics: Array<{
      timeframe: string;
      percent?: number;
      transactions?: number;
      volume?: string;
      makers?: number;
    }>;
  }>(`/agent/metrics/${tokenAddress}?timeframes=${apiTimeframes}`);

  // Transform from array to keyed object using our labels
  const metrics: Record<string, {
    priceChange: string;
    volumeChange: string;
    txCount: number;
  }> = {};

  for (const m of (raw.metrics || [])) {
    const label = TIMEFRAME_REVERSE[String(m.timeframe)] || String(m.timeframe);
    metrics[label] = {
      priceChange: String(m.percent || 0),
      volumeChange: String(m.volume || '0'),
      txCount: m.transactions || 0,
    };
  }

  return { token: tokenAddress, metrics };
}

/**
 * Get swap history for a token
 *
 * API: GET /agent/swap-history/:token_id?limit=20&page=1
 * Returns: { swaps: [{ swap_info: { event_type, native_amount, token_amount, transaction_hash, ... } }], total_count }
 */
export async function getSwapHistory(
  tokenAddress: string,
  limit = 20,
  page = 1
) {
  const raw = await fetchApi<{
    swaps: Array<{
      swap_info: {
        event_type?: string;
        native_amount?: string;
        token_amount?: string;
        transaction_hash?: string;
        account_id?: string;
        timestamp?: number;
      };
    }>;
    total_count: number;
  }>(`/agent/swap-history/${tokenAddress}?limit=${limit}&page=${page}`);

  return {
    swaps: (raw.swaps || []).map(s => {
      const info = s.swap_info || {};
      return {
        txHash: info.transaction_hash || '',
        account: info.account_id || '',
        type: (info.event_type || 'buy').toLowerCase() as 'buy' | 'sell',
        amountIn: info.native_amount || '0',
        amountOut: info.token_amount || '0',
        timestamp: info.timestamp || 0,
      };
    }),
    total: raw.total_count || 0,
  };
}

/**
 * Get OHLCV chart data for a token
 *
 * API: GET /agent/chart/:token_id?resolution=60&from=...&to=...
 * Returns: { t: number[], o: number[], h: number[], l: number[], c: number[], v: number[], s: string }
 */
export async function getChartData(
  tokenAddress: string,
  interval = '1h',
  limit = 100
) {
  const resolution = RESOLUTION_MAP[interval] || '60';
  const now = Math.floor(Date.now() / 1000);
  // Calculate 'from' based on limit and resolution
  const resSeconds = resolution === '1D' ? 86400 : parseInt(resolution) * 60;
  const from = now - (limit * resSeconds);

  const raw = await fetchApi<{
    t: number[];
    o: number[];
    h: number[];
    l: number[];
    c: number[];
    v: number[];
    s: string;
  }>(`/agent/chart/${tokenAddress}?resolution=${resolution}&from=${from}&to=${now}&countback=${limit}`);

  // Transform parallel arrays into candles array
  const candles: Array<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }> = [];

  const timestamps = raw.t || [];
  for (let i = 0; i < timestamps.length; i++) {
    candles.push({
      timestamp: timestamps[i],
      open: String(raw.o?.[i] ?? 0),
      high: String(raw.h?.[i] ?? 0),
      low: String(raw.l?.[i] ?? 0),
      close: String(raw.c?.[i] ?? 0),
      volume: String(raw.v?.[i] ?? 0),
    });
  }

  return { candles };
}

/**
 * Get holdings for a wallet address
 *
 * API: GET /agent/holdings/:account_id?page=1&limit=20
 * Returns: { tokens: [{ token_info, balance_info, market_info }], total_count }
 */
export async function getHoldings(accountAddress: string) {
  const raw = await fetchApi<{
    tokens: Array<{
      token_info?: {
        address?: string;
        name?: string;
        symbol?: string;
      };
      balance_info?: {
        balance?: string;
      };
      market_info?: {
        price_usd?: string;
      };
    }>;
    total_count: number;
  }>(`/agent/holdings/${accountAddress}?page=1&limit=100`);

  return {
    holdings: (raw.tokens || []).map(t => ({
      token: t.token_info?.address || '',
      name: t.token_info?.name || '',
      symbol: t.token_info?.symbol || '',
      balance: t.balance_info?.balance || '0',
      value: t.market_info?.price_usd || '0',
    })),
  };
}

/**
 * Get token metadata (name, symbol, image, creator, etc.)
 *
 * API: GET /agent/token/:token_id
 * Returns: { token_info: { name, symbol, image_uri, description, is_graduated, creator, progress, ... } }
 */
export async function getTokenInfo(tokenAddress: string) {
  const raw = await fetchApi<{
    token_info: {
      address?: string;
      name?: string;
      symbol?: string;
      image_uri?: string;
      description?: string;
      creator?: string;
      is_graduated?: boolean;
      progress?: number;
    };
  }>(`/agent/token/${tokenAddress}`);

  const info = raw.token_info || {};
  return {
    address: info.address || tokenAddress,
    name: info.name || '',
    symbol: info.symbol || '',
    image: info.image_uri || '',
    description: info.description || '',
    creator: info.creator || '',
    graduated: info.is_graduated || false,
    progress: info.progress || 0,
  };
}
