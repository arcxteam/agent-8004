import { NextRequest, NextResponse } from 'next/server';
import { formatEther } from 'viem';
import { getCurrentNetwork } from '@/lib/config';

const ETHERSCAN_API_BASE = 'https://api.etherscan.io/v2/api';

// Chain ID: 143 for Monad mainnet, 10143 for testnet
function getChainId(): number {
  return getCurrentNetwork() === 'mainnet' ? 143 : 10143;
}

interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  functionName: string;
  methodId: string;
}

// Simple in-memory cache (5 min TTL)
let txCache: { key: string; data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// GET /api/portfolio/transactions?address=0x...&page=1&offset=20
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const page = searchParams.get('page') || '1';
    const offset = searchParams.get('offset') || '20';

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: address' },
        { status: 400 }
      );
    }

    const apiKey = process.env.MONAD_EXPLORER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Explorer API key not configured' },
        { status: 500 }
      );
    }

    const cacheKey = `${address.toLowerCase()}-${page}-${offset}`;

    // Check cache
    if (txCache && txCache.key === cacheKey && Date.now() - txCache.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, ...(txCache.data as object), cached: true });
    }

    const chainId = getChainId();
    const url = `${ETHERSCAN_API_BASE}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${apiKey}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // 5 min
    });

    if (!response.ok) {
      throw new Error(`Etherscan API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== '1' || !Array.isArray(data.result)) {
      // status "0" with message "No transactions found" is not an error
      if (data.message === 'No transactions found') {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page: parseInt(page),
        });
      }
      throw new Error(data.message || 'Etherscan API returned error');
    }

    const addrLower = address.toLowerCase();

    // Map Etherscan response to our Transaction format
    const transactions = (data.result as EtherscanTx[]).map((tx, index) => {
      const valueWei = BigInt(tx.value);
      const valueEth = parseFloat(formatEther(valueWei));
      const isOutgoing = tx.from.toLowerCase() === addrLower;

      // Determine transaction type from method/context
      let type = 'transfer';
      const fn = tx.functionName?.toLowerCase() || '';
      const methodId = tx.methodId?.toLowerCase() || '';
      if (fn.includes('swap') || fn.includes('multicall') || fn.includes('execute')) type = 'swap';
      else if (fn.includes('deposit') || fn.includes('stake') || fn.includes('delegate')) type = 'deposit';
      else if (fn.includes('withdraw') || fn.includes('unstake')) type = 'withdraw';
      else if (fn.includes('redeem') || fn.includes('claim')) type = 'reward';
      else if (fn.includes('approve')) type = 'transfer';
      else if (methodId === '0x6e553f65') type = 'deposit'; // deposit(uint256,address)
      else if (methodId === '0x492e47d2') type = 'reward';  // redeem(uint256[],address)
      else if (valueWei > BigInt(0) && !tx.functionName) type = 'transfer';

      return {
        id: index + 1,
        type,
        from: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
        to: tx.to ? `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : 'Contract Creation',
        amount: `${isOutgoing ? '-' : '+'}${valueEth > 0 ? valueEth.toFixed(4) : '0'} MON`,
        value: `${valueEth > 0 ? valueEth.toFixed(4) : '0'} MON`,
        time: formatTimestamp(parseInt(tx.timeStamp)),
        hash: `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`,
        fullHash: tx.hash,
        status: tx.isError === '0' && tx.txreceipt_status === '1' ? 'confirmed' : 'failed',
        timestamp: parseInt(tx.timeStamp),
        fromFull: tx.from,
        toFull: tx.to || '',
        functionName: tx.functionName || '',
      };
    });

    const result = {
      data: transactions,
      total: transactions.length,
      page: parseInt(page),
    };

    // Cache result
    txCache = { key: cacheKey, data: result, timestamp: Date.now() };

    return NextResponse.json({ success: true, ...result, cached: false });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions from explorer' },
      { status: 500 }
    );
  }
}

function formatTimestamp(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
