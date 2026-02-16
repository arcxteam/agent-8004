'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Monad mainnet contract addresses for all 10 default tokens
// CoinGecko supports fetching by contract address on Monad network
const MONAD_TOKEN_CONTRACTS: Record<string, string> = {
  'MON': '0x0000000000000000000000000000000000000000', // Native - use coingeckoId instead
  'WMON': '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
  'USDC': '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
  'USDT': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
  'aUSD': '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
  'earnAUSD': '0x103222f020e98Bba0AD9809A011FDF8e6F067496',
  'aprMON': '0x0c65A0BC65a5D819235B71F554D210D3F80E0852',
  'WBTC': '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
  'WETH': '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242',
  'CHOG': '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777',
};

// Token mappings for price lookup
// All tokens are available on CoinGecko by contract address on Monad network
const MONAD_TOKEN_MAPPINGS: Record<string, {
  coingeckoId?: string;
  cmcSlug?: string;
  contractAddress?: string;
  symbol: string;
  isNative?: boolean;
  isStablecoin?: boolean;
}> = {
  // By symbol
  'MON': { symbol: 'MON', coingeckoId: 'monad', cmcSlug: 'monad', isNative: true },
  'WMON': { symbol: 'WMON', contractAddress: MONAD_TOKEN_CONTRACTS['WMON'], cmcSlug: 'monad' },
  'aprMON': { symbol: 'aprMON', contractAddress: MONAD_TOKEN_CONTRACTS['aprMON'], cmcSlug: 'monad' },
  'USDC': { symbol: 'USDC', contractAddress: MONAD_TOKEN_CONTRACTS['USDC'], cmcSlug: 'usd-coin', isStablecoin: true },
  'USDT': { symbol: 'USDT', contractAddress: MONAD_TOKEN_CONTRACTS['USDT'], cmcSlug: 'tether', isStablecoin: true },
  'aUSD': { symbol: 'aUSD', contractAddress: MONAD_TOKEN_CONTRACTS['aUSD'], isStablecoin: true },
  'earnAUSD': { symbol: 'earnAUSD', contractAddress: MONAD_TOKEN_CONTRACTS['earnAUSD'], isStablecoin: true },
  'WETH': { symbol: 'WETH', contractAddress: MONAD_TOKEN_CONTRACTS['WETH'], cmcSlug: 'ethereum' },
  'WBTC': { symbol: 'WBTC', contractAddress: MONAD_TOKEN_CONTRACTS['WBTC'], cmcSlug: 'bitcoin' },
  'CHOG': { symbol: 'CHOG', contractAddress: MONAD_TOKEN_CONTRACTS['CHOG'] },
  
  // By contract address (for reverse lookup)
  [MONAD_TOKEN_CONTRACTS['WMON']]: { symbol: 'WMON', contractAddress: MONAD_TOKEN_CONTRACTS['WMON'], cmcSlug: 'monad' },
  [MONAD_TOKEN_CONTRACTS['USDC']]: { symbol: 'USDC', contractAddress: MONAD_TOKEN_CONTRACTS['USDC'], cmcSlug: 'usd-coin', isStablecoin: true },
  [MONAD_TOKEN_CONTRACTS['USDT']]: { symbol: 'USDT', contractAddress: MONAD_TOKEN_CONTRACTS['USDT'], cmcSlug: 'tether', isStablecoin: true },
  [MONAD_TOKEN_CONTRACTS['aUSD']]: { symbol: 'aUSD', contractAddress: MONAD_TOKEN_CONTRACTS['aUSD'], isStablecoin: true },
  [MONAD_TOKEN_CONTRACTS['earnAUSD']]: { symbol: 'earnAUSD', contractAddress: MONAD_TOKEN_CONTRACTS['earnAUSD'], isStablecoin: true },
  [MONAD_TOKEN_CONTRACTS['aprMON']]: { symbol: 'aprMON', contractAddress: MONAD_TOKEN_CONTRACTS['aprMON'], cmcSlug: 'monad' },
  [MONAD_TOKEN_CONTRACTS['WBTC']]: { symbol: 'WBTC', contractAddress: MONAD_TOKEN_CONTRACTS['WBTC'], cmcSlug: 'bitcoin' },
  [MONAD_TOKEN_CONTRACTS['WETH']]: { symbol: 'WETH', contractAddress: MONAD_TOKEN_CONTRACTS['WETH'], cmcSlug: 'ethereum' },
  [MONAD_TOKEN_CONTRACTS['CHOG']]: { symbol: 'CHOG', contractAddress: MONAD_TOKEN_CONTRACTS['CHOG'] },
};

// Emergency fallback - only if ALL APIs fail (network down, etc)
const EMERGENCY_FALLBACK_PRICES: Record<string, number> = {};

export interface TokenPrice {
  symbol: string;
  address: string | null;
  priceUsd: number;
  change24h: number;
  lastUpdated: Date;
}

interface PriceCache {
  data: Record<string, TokenPrice>;
  timestamp: number;
}

// Global cache
let priceCache: PriceCache | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

// API Keys
const COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';
const COINMARKETCAP_API_KEY = process.env.NEXT_PUBLIC_COINMARKETCAP_API_KEY || '';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';

// Fetch prices from CoinMarketCap by slug (fallback when CoinGecko fails)
async function fetchCoinMarketCapPrices(slugs: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  if (slugs.length === 0) return {};
  
  try {
    const slugParam = slugs.join(',');
    const response = await fetch(
      `${COINMARKETCAP_BASE_URL}/cryptocurrency/quotes/latest?slug=${slugParam}&convert=USD`,
      {
        method: 'GET',
        headers: {
          'Accepts': 'application/json',
          'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
        },
      }
    );
    
    if (!response.ok) {
      console.warn('CoinMarketCap price fetch failed:', response.status);
      return {};
    }
    
    const data = await response.json();
    const result: Record<string, { usd: number; usd_24h_change?: number }> = {};
    
    // CMC returns data keyed by ID, we need to map by slug
    if (data.data) {
      for (const [, coinData] of Object.entries(data.data) as [string, { slug: string; quote: { USD: { price: number; percent_change_24h: number } } }][]) {
        result[coinData.slug] = {
          usd: coinData.quote.USD.price,
          usd_24h_change: coinData.quote.USD.percent_change_24h,
        };
      }
    }
    
    return result;
  } catch (error) {
    console.warn('Failed to fetch CoinMarketCap prices:', error);
    return {};
  }
}

// Fetch token price by contract address on Monad network
async function fetchTokenPriceByContract(contractAddresses: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  try {
    const addresses = contractAddresses.join(',');
    const options = {
      method: 'GET',
      headers: {
        'x-cg-demo-api-key': COINGECKO_API_KEY,
      },
    };
    
    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/token_price/monad?contract_addresses=${addresses}&vs_currencies=usd&include_24hr_change=true`,
      options
    );
    
    if (!response.ok) {
      console.warn('CoinGecko contract price fetch failed:', response.status);
      return {};
    }
    
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch token prices by contract:', error);
    return {};
  }
}

// Fetch coin prices by CoinGecko ID
async function fetchCoinPrices(coinIds: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  if (coinIds.length === 0) return {};
  
  try {
    const ids = coinIds.join(',');
    const options = {
      method: 'GET',
      headers: {
        'x-cg-demo-api-key': COINGECKO_API_KEY,
      },
    };
    
    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      options
    );
    
    if (!response.ok) {
      console.warn('CoinGecko price fetch failed:', response.status);
      return {};
    }
    
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch coin prices:', error);
    return {};
  }
}

// Main hook for fetching and caching token prices
export function useTokenPrices(tokenAddresses: (string | null)[] = []) {
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrices = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (priceCache && (now - priceCache.timestamp) < CACHE_DURATION) {
      setPrices(priceCache.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result: Record<string, TokenPrice> = {};
      
      // Collect all contract addresses for ERC20 tokens (all 9 non-native tokens)
      // CoinGecko Monad network API works for ALL our tokens
      const contractAddresses: string[] = [];
      const coinIds: string[] = []; // For native MON
      const cmcSlugs: string[] = [];
      
      for (const addr of tokenAddresses) {
        const mapping = addr ? MONAD_TOKEN_MAPPINGS[addr] : MONAD_TOKEN_MAPPINGS['MON'];
        if (!mapping) continue;
        
        // For native MON, use coingeckoId
        if (mapping.isNative && mapping.coingeckoId) {
          coinIds.push(mapping.coingeckoId);
        }
        // For ERC20 tokens, use contract address
        else if (mapping.contractAddress) {
          contractAddresses.push(mapping.contractAddress);
        }
        // Collect CMC slugs for fallback
        if (mapping.cmcSlug) {
          cmcSlugs.push(mapping.cmcSlug);
        }
      }
      
      // Fetch from CoinGecko API - contract addresses work for ALL tokens on Monad
      const [coinPrices, contractPrices] = await Promise.all([
        fetchCoinPrices([...new Set(coinIds)]),
        fetchTokenPriceByContract([...new Set(contractAddresses)]),
      ]);
      
      // Check if we need CoinMarketCap fallback (if CoinGecko failed)
      const needCmcFallback = Object.keys(coinPrices).length === 0 && 
                               Object.keys(contractPrices).length === 0;
      
      // Fetch from CoinMarketCap as fallback only if CoinGecko failed
      let cmcPrices: Record<string, { usd: number; usd_24h_change?: number }> = {};
      if (needCmcFallback && cmcSlugs.length > 0) {
        cmcPrices = await fetchCoinMarketCapPrices([...new Set(cmcSlugs)]);
      }
      
      // Process results - prioritize CoinGecko contract prices
      for (const addr of tokenAddresses) {
        const addrKey = addr || 'MON';
        const mapping = addr ? MONAD_TOKEN_MAPPINGS[addr] : MONAD_TOKEN_MAPPINGS['MON'];
        
        if (!mapping) continue;
        
        let priceUsd = 0;
        let change24h = 0;
        
        // For native MON, use CoinGecko coin ID
        if (mapping.isNative && mapping.coingeckoId && coinPrices[mapping.coingeckoId]) {
          priceUsd = coinPrices[mapping.coingeckoId].usd;
          change24h = coinPrices[mapping.coingeckoId].usd_24h_change || 0;
        }
        // For ERC20 tokens, use contract price from CoinGecko
        else if (mapping.contractAddress) {
          const contractKey = mapping.contractAddress.toLowerCase();
          if (contractPrices[contractKey]) {
            priceUsd = contractPrices[contractKey].usd;
            change24h = contractPrices[contractKey].usd_24h_change || 0;
          }
        }
        
        // Fallback to CoinMarketCap if CoinGecko failed
        if (priceUsd === 0 && mapping.cmcSlug && cmcPrices[mapping.cmcSlug]) {
          priceUsd = cmcPrices[mapping.cmcSlug].usd;
          change24h = cmcPrices[mapping.cmcSlug].usd_24h_change || 0;
        }
        
        result[addrKey] = {
          symbol: mapping.symbol,
          address: addr,
          priceUsd,
          change24h,
          lastUpdated: new Date(),
        };
        
        // Also store by symbol for easy lookup
        result[mapping.symbol] = result[addrKey];
      }
      
      // Update cache
      priceCache = {
        data: result,
        timestamp: now,
      };
      
      setPrices(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch prices'));
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddresses]);

  // Fetch on mount and when addresses change
  useEffect(() => {
    fetchPrices();
    
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Get price for a specific token
  const getPrice = useCallback((addressOrSymbol: string | null): number => {
    const key = addressOrSymbol || 'MON';
    // Check direct key first
    if (prices[key]?.priceUsd) return prices[key].priceUsd;
    // Check by mapping symbol
    const mapping = MONAD_TOKEN_MAPPINGS[key];
    if (mapping?.symbol && prices[mapping.symbol]?.priceUsd) {
      return prices[mapping.symbol].priceUsd;
    }
    // Return emergency fallback for unlisted tokens only
    const symbol = mapping?.symbol || key;
    return EMERGENCY_FALLBACK_PRICES[symbol] || 0;
  }, [prices]);

  // Get 24h change for a specific token
  const getChange24h = useCallback((addressOrSymbol: string | null): number => {
    const key = addressOrSymbol || 'MON';
    if (prices[key]?.change24h !== undefined) return prices[key].change24h;
    const mapping = MONAD_TOKEN_MAPPINGS[key];
    if (mapping?.symbol && prices[mapping.symbol]?.change24h !== undefined) {
      return prices[mapping.symbol].change24h;
    }
    return 0;
  }, [prices]);

  return {
    prices,
    isLoading,
    error,
    getPrice,
    getChange24h,
    refetch: fetchPrices,
  };
}

// Simplified hook for getting a single token price
export function useTokenPrice(symbolOrAddress: string | null) {
  const { prices, isLoading, getPrice, getChange24h } = useTokenPrices([symbolOrAddress]);
  const priceData = symbolOrAddress ? prices[symbolOrAddress] : null;
  
  return {
    price: priceData,
    priceUsd: getPrice(symbolOrAddress),
    change24h: getChange24h(symbolOrAddress),
    isLoading,
  };
}

// Hook for getting multiple token prices at once
export function useMultipleTokenPrices(addresses: (string | null)[]) {
  const { prices, isLoading, error, getPrice, getChange24h, refetch } = useTokenPrices(addresses);
  
  const tokenPrices = useMemo(() => {
    return addresses.map(addr => ({
      address: addr,
      price: getPrice(addr),
      change24h: getChange24h(addr),
    }));
  }, [addresses, getPrice, getChange24h]);
  
  return {
    tokenPrices,
    prices,
    isLoading,
    error,
    refetch,
  };
}

// Export for use elsewhere
export { MONAD_TOKEN_CONTRACTS, MONAD_TOKEN_MAPPINGS };
