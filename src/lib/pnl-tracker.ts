/**
 * PnL Tracker - Stablecoin-denominated P&L calculation
 *
 * Converts MON-denominated trade results to USD using live price feeds.
 * Priority: CoinGecko -> CoinMarketCap -> Cached price.
 * Updates agent stats in Prisma after each trade execution.
 */

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1';
const MON_PRICE_CACHE_MS = 60_000; // 1 minute cache

let cachedMonPrice: { price: number; timestamp: number } | null = null;

/**
 * Get current MON/USD price — live from API
 *
 * Fallback chain:
 * 1. Memory cache (60s)
 * 2. CoinGecko API (primary)
 * 3. CoinMarketCap API (secondary)
 * 4. Stale cache (if available)
 * 5. Throw error (no hardcoded price)
 */
export async function getMonUsdPrice(): Promise<number> {
  // Return cached if fresh
  if (cachedMonPrice && Date.now() - cachedMonPrice.timestamp < MON_PRICE_CACHE_MS) {
    return cachedMonPrice.price;
  }

  // Primary: CoinGecko
  try {
    const cgKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
    const headers: Record<string, string> = {};
    if (cgKey) headers['x-cg-demo-api-key'] = cgKey;

    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=monad&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000), headers }
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.monad?.usd;
      if (typeof price === 'number' && price > 0) {
        cachedMonPrice = { price, timestamp: Date.now() };
        return price;
      }
    }
  } catch (err) {
    console.warn('CoinGecko MON price fetch failed:', err);
  }

  // Secondary: CoinMarketCap
  try {
    const cmcKey = process.env.NEXT_PUBLIC_COINMARKETCAP_API_KEY;
    if (cmcKey) {
      const res = await fetch(
        `${COINMARKETCAP_API}/cryptocurrency/quotes/latest?slug=monad&convert=USD`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': cmcKey,
            'Accepts': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const entries = Object.values(data?.data || {}) as Array<{
          quote: { USD: { price: number } };
        }>;
        if (entries.length > 0) {
          const price = entries[0]?.quote?.USD?.price;
          if (typeof price === 'number' && price > 0) {
            cachedMonPrice = { price, timestamp: Date.now() };
            return price;
          }
        }
      }
    }
  } catch (err) {
    console.warn('CoinMarketCap MON price fetch failed:', err);
  }

  // Fallback: use stale cached price if available
  if (cachedMonPrice) return cachedMonPrice.price;

  // All APIs failed, no cache — throw (DO NOT use hardcoded fallback price — real money!)
  throw new Error(
    'MON price unavailable: Both CoinGecko and CoinMarketCap failed and no cache available.'
  );
}

/**
 * Calculate PnL in USD from trade amounts.
 *
 * For nad.fun bonding curve trades (MON-denominated):
 *   BUY:  amountInMon = MON spent,  amountOutMon = 0 (tokens, not MON)
 *   SELL: amountInMon = 0 (tokens), amountOutMon = MON received
 *
 * For LiFi trades where output is non-MON (e.g., USDC, WETH):
 *   Pass tokenPriceUsd to properly convert non-MON amounts.
 *   BUY from MON:    amountInMon = MON spent, PnL = -(MON * monPrice)
 *   SELL to non-MON:  amountOutMon = token amount, tokenPriceUsd = USD price per token
 *
 * PnL is calculated per-trade:
 *   BUY:  PnL = -amountInMon * monPrice (capital outflow)
 *   SELL: PnL = +amountOutMon * (tokenPriceUsd ?? monPrice) (capital inflow)
 *
 * Over a full buy+sell cycle, total PnL = (-MON_spent) + (+MON_received) = net profit/loss.
 */
export async function calculatePnlUsd(
  amountInMon: number,
  amountOutMon: number,
  action: 'buy' | 'sell',
  tokenPriceUsd?: number,
): Promise<{ pnlMon: number; pnlUsd: number; monPrice: number }> {
  const monPrice = await getMonUsdPrice();

  // BUY: capital deployed (negative) — always MON-denominated input
  // SELL: capital received (positive) — may be MON or non-MON output
  if (action === 'buy') {
    const pnlMon = -amountInMon;
    const pnlUsd = pnlMon * monPrice;
    return { pnlMon, pnlUsd, monPrice };
  } else {
    // SELL: output may be non-MON (e.g., USDC, WETH)
    const outPricePerUnit = tokenPriceUsd ?? monPrice;
    const pnlUsd = amountOutMon * outPricePerUnit;
    // Convert back to MON-equivalent for pnlMon
    const pnlMon = monPrice > 0 ? pnlUsd / monPrice : amountOutMon;
    return { pnlMon, pnlUsd, monPrice };
  }
}

/**
 * Format PnL for display
 */
export function formatPnl(pnlUsd: number): string {
  const sign = pnlUsd >= 0 ? '+' : '';
  return `${sign}$${pnlUsd.toFixed(4)}`;
}
