'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Monad token list API endpoint
const MONAD_TOKEN_LIST_URL = 'https://raw.githubusercontent.com/monad-crypto/token-list/refs/heads/main/tokenlist-mainnet.json';

export interface MonadToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  extensions?: {
    coinGeckoId?: string;
    bridgeInfo?: {
      protocol: string;
      bridgeAddress: string;
    };
    crossChainAddresses?: Record<string, { address: string; symbol?: string }>;
  };
}

interface TokenListResponse {
  name: string;
  logoURI: string;
  keywords: string[];
  timestamp: string;
  tokens: MonadToken[];
}

// Default tokens to show if API fails (our 10 default tokens)
const DEFAULT_TOKENS: MonadToken[] = [
  {
    chainId: 143,
    address: '0x0000000000000000000000000000000000000000',
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
    logoURI: '/icons/mon.png',
    extensions: { coinGeckoId: 'monad' },
  },
  {
    chainId: 143,
    address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    name: 'Wrapped Monad',
    symbol: 'WMON',
    decimals: 18,
    logoURI: '/icons/wmon.png',
    extensions: { coinGeckoId: 'monad' },
  },
  {
    chainId: 143,
    address: '0x0c65A0BC65a5D819235B71F554D210D3F80E0852',
    name: 'Apriori MON',
    symbol: 'aprMON',
    decimals: 18,
    logoURI: '/icons/aprmon.png',
    extensions: { coinGeckoId: 'monad' },
  },
  {
    chainId: 143,
    address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoURI: '/icons/usdc.png',
    extensions: { coinGeckoId: 'usd-coin' },
  },
  {
    chainId: 143,
    address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logoURI: '/icons/usdt.png',
    extensions: { coinGeckoId: 'tether' },
  },
  {
    chainId: 143,
    address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    name: 'Agora USD',
    symbol: 'aUSD',
    decimals: 6,
    logoURI: '/icons/ausd.png',
    extensions: { coinGeckoId: 'agora-dollar' },
  },
  {
    chainId: 143,
    address: '0x103222f020e98Bba0AD9809A011FDF8e6F067496',
    name: 'Earn aUSD',
    symbol: 'earnAUSD',
    decimals: 6,
    logoURI: '/icons/earnausd.png',
  },
  {
    chainId: 143,
    address: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242',
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    logoURI: '/icons/weth.png',
    extensions: { coinGeckoId: 'ethereum' },
  },
  {
    chainId: 143,
    address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    decimals: 8,
    logoURI: '/icons/wbtc.png',
    extensions: { coinGeckoId: 'bitcoin' },
  },
  {
    chainId: 143,
    address: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777',
    name: 'Chog',
    symbol: 'CHOG',
    decimals: 18,
    logoURI: '/icons/chog.png',
    extensions: { coinGeckoId: 'chog' },
  },
];

// Cache tokens in memory for performance
let cachedTokens: MonadToken[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch and use Monad mainnet token list
 * 
 * Features:
 * - Fetches from official Monad token list
 * - Caches tokens in memory
 * - Provides search/filter functions
 * - Falls back to default 10 tokens if API fails
 */
export function useMonadTokenList() {
  const [tokens, setTokens] = useState<MonadToken[]>(DEFAULT_TOKENS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTokenList = useCallback(async (forceRefresh = false) => {
    // Use cache if available and not expired
    const now = Date.now();
    if (!forceRefresh && cachedTokens && now - lastFetchTime < CACHE_DURATION) {
      setTokens(cachedTokens);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch(MONAD_TOKEN_LIST_URL, {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 5 minutes
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token list: ${response.status}`);
      }

      const data: TokenListResponse = await response.json();

      if (data.tokens && Array.isArray(data.tokens)) {
        // Filter for Monad mainnet (chainId 143)
        const monadTokens = data.tokens.filter(t => t.chainId === 143);
        
        // Merge with default tokens (prefer API data but keep our icons for defaults)
        const merged = mergeTokenLists(monadTokens, DEFAULT_TOKENS);
        
        // Update cache
        cachedTokens = merged;
        lastFetchTime = now;
        
        setTokens(merged);
        setLastUpdated(new Date(data.timestamp));
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching token list:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch token list'));
      // Keep using default tokens on error
      setTokens(DEFAULT_TOKENS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenList();
  }, [fetchTokenList]);

  // Helper: Find token by address
  const getTokenByAddress = useCallback((address: string): MonadToken | undefined => {
    const normalizedAddress = address.toLowerCase();
    return tokens.find(t => t.address.toLowerCase() === normalizedAddress);
  }, [tokens]);

  // Helper: Find token by symbol
  const getTokenBySymbol = useCallback((symbol: string): MonadToken | undefined => {
    return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  }, [tokens]);

  // Helper: Search tokens by name or symbol
  const searchTokens = useCallback((query: string): MonadToken[] => {
    if (!query) return tokens;
    const lowerQuery = query.toLowerCase();
    return tokens.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) || 
      t.symbol.toLowerCase().includes(lowerQuery) ||
      t.address.toLowerCase().includes(lowerQuery)
    );
  }, [tokens]);

  // Memoized token count
  const tokenCount = useMemo(() => tokens.length, [tokens]);

  return {
    tokens,
    isLoading,
    error,
    lastUpdated,
    tokenCount,
    refetch: fetchTokenList,
    getTokenByAddress,
    getTokenBySymbol,
    searchTokens,
  };
}

/**
 * Merge API token list with default tokens
 * - Uses API data when available
 * - Keeps our custom icons for default tokens
 * - Adds any new tokens from API
 */
function mergeTokenLists(apiTokens: MonadToken[], defaults: MonadToken[]): MonadToken[] {
  const result: MonadToken[] = [];
  const addressMap = new Map<string, MonadToken>();

  // Add all API tokens first
  for (const token of apiTokens) {
    addressMap.set(token.address.toLowerCase(), token);
  }

  // Process default tokens - use our icons but API data if available
  for (const defaultToken of defaults) {
    const apiToken = addressMap.get(defaultToken.address.toLowerCase());
    if (apiToken) {
      // Merge: use API data but keep our local icons
      result.push({
        ...apiToken,
        logoURI: defaultToken.logoURI, // Keep our PNG icons
      });
      addressMap.delete(defaultToken.address.toLowerCase());
    } else {
      // Token not in API, use default
      result.push(defaultToken);
    }
  }

  // Add remaining API tokens that we don't have as defaults
  for (const token of addressMap.values()) {
    result.push(token);
  }

  return result;
}

/**
 * Get token price using CoinGecko contract API
 * This function can be used standalone or with useMonadTokenList
 */
export async function fetchTokenPrice(contractAddress: string): Promise<number | null> {
  try {
    // Handle native MON (address 0x0)
    if (contractAddress === '0x0000000000000000000000000000000000000000') {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd',
        { headers: { 'x-cg-demo-api-key': process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '' } }
      );
      const data = await response.json();
      return data?.monad?.usd ?? null;
    }

    // Fetch by contract address
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/monad?contract_addresses=${contractAddress}&vs_currencies=usd`,
      { headers: { 'x-cg-demo-api-key': 'CG-cTraNZPUEmnQV5bD8yuQ3Nbs' } }
    );
    const data = await response.json();
    return data?.[contractAddress.toLowerCase()]?.usd ?? null;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return null;
  }
}
