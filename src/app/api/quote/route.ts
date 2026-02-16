import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { getNetworkConfig, getContractsByChainId } from '@/config/chains';
import { lensAbi, curveAbi } from '@/config/contracts';
import { getLiFiQuote, isLiFiSupportedToken } from '@/lib/lifi-client';
import { getRpcUrl } from '@/lib/config';

// Use dynamic network config with explicit RPC URL
const { chain } = getNetworkConfig();
const client = createPublicClient({
  chain,
  transport: http(getRpcUrl()),
});

// GET /api/quote - Get quote for buying/selling tokens
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenAddress = searchParams.get('token') as `0x${string}`;
  const amount = searchParams.get('amount');
  const action = searchParams.get('action') || 'buy';
  const chainId = parseInt(searchParams.get('chainId') || String(chain.id));

  try {
    if (!tokenAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: token, amount' },
        { status: 400 }
      );
    }

    const contracts = getContractsByChainId(chainId);
    const amountIn = parseEther(amount);
    const isBuy = action === 'buy';

    // Get quote from Lens contract
    const quoteResult = await client.readContract({
      address: contracts.LENS,
      abi: lensAbi,
      functionName: 'getAmountOut',
      args: [tokenAddress, amountIn, isBuy],
    });

    // Result is [router, amountOut]
    const [router, amountOut] = quoteResult as [string, bigint];

    // Get curve info for price calculation
    const curveInfo = await client.readContract({
      address: contracts.CURVE,
      abi: curveAbi,
      functionName: 'curves',
      args: [tokenAddress],
    });

    // Calculate price impact
    const priceImpact = calculatePriceImpact(amountIn, amountOut, isBuy);

    return NextResponse.json({
      success: true,
      data: {
        router,
        amountIn: formatEther(amountIn),
        amountOut: formatEther(amountOut),
        priceImpact: priceImpact.toFixed(2),
        action,
        curveInfo: {
          realMonReserve: formatEther((curveInfo as unknown as bigint[])[0] || BigInt(0)),
          realTokenReserve: formatEther((curveInfo as unknown as bigint[])[1] || BigInt(0)),
          virtualMonReserve: formatEther((curveInfo as unknown as bigint[])[2] || BigInt(0)),
          virtualTokenReserve: formatEther((curveInfo as unknown as bigint[])[3] || BigInt(0)),
        },
      },
    });
  } catch (error) {
    // Fallback to LiFi quote if nad.fun Lens fails (token may not be on bonding curve)
    try {
      if (tokenAddress && amount && isLiFiSupportedToken(tokenAddress)) {
        const fromToken = action === 'buy' ? 'MON' : tokenAddress;
        const toToken = action === 'buy' ? tokenAddress : 'MON';

        const lifiQuote = await getLiFiQuote({
          fromToken,
          toToken,
          amount: amount!,
          fromAddress: '0x0000000000000000000000000000000000000000', // Quote only, no real address needed
          slippageBps: 100,
        });

        return NextResponse.json({
          success: true,
          data: {
            router: 'lifi',
            amountIn: lifiQuote.action.fromAmount,
            amountOut: lifiQuote.estimate.toAmount,
            amountOutMin: lifiQuote.estimate.toAmountMin,
            priceImpact: '0',
            action,
            source: 'lifi',
            estimatedGas: lifiQuote.transactionRequest?.gasLimit,
            executionDuration: lifiQuote.estimate.executionDuration,
          },
        });
      }
    } catch (lifiError) {
      console.error('LiFi quote also failed:', lifiError);
    }

    console.error('Error getting quote:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}

// POST /api/quote - Get quote for swap
export async function POST(request: NextRequest) {
  let tokenAddress: string | undefined;
  let amount: string | undefined;
  let action = 'buy';

  try {
    const body = await request.json();
    tokenAddress = body.tokenAddress;
    amount = body.amount;
    action = body.action || 'buy';
    const chainId = body.chainId || chain.id;

    if (!tokenAddress || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tokenAddress, amount' },
        { status: 400 }
      );
    }

    const contracts = getContractsByChainId(chainId);
    const amountIn = parseEther(amount.toString());
    const isBuy = action === 'buy';

    // Get quote from Lens contract
    const quoteResult = await client.readContract({
      address: contracts.LENS,
      abi: lensAbi,
      functionName: 'getAmountOut',
      args: [tokenAddress as `0x${string}`, amountIn, isBuy],
    });

    const [router, amountOut] = quoteResult as [string, bigint];

    // Calculate minimum output with slippage
    const slippageBps = body.slippage || 100; // 1% default
    const minAmountOut = amountOut * BigInt(10000 - slippageBps) / BigInt(10000);

    return NextResponse.json({
      success: true,
      data: {
        router,
        amountIn: formatEther(amountIn),
        amountOut: formatEther(amountOut),
        minAmountOut: formatEther(minAmountOut),
        action,
        slippage: slippageBps / 100,
      },
    });
  } catch (error) {
    // Fallback to LiFi quote if nad.fun Lens fails (token may not be on bonding curve)
    try {
      if (tokenAddress && amount && isLiFiSupportedToken(tokenAddress)) {
        const fromToken = action === 'buy' ? 'MON' : tokenAddress;
        const toToken = action === 'buy' ? tokenAddress : 'MON';

        const lifiQuote = await getLiFiQuote({
          fromToken,
          toToken,
          amount: amount!,
          fromAddress: '0x0000000000000000000000000000000000000000', // Quote only, no real address needed
          slippageBps: 100,
        });

        return NextResponse.json({
          success: true,
          data: {
            router: 'lifi',
            amountIn: lifiQuote.action.fromAmount,
            amountOut: lifiQuote.estimate.toAmount,
            amountOutMin: lifiQuote.estimate.toAmountMin,
            priceImpact: '0',
            action,
            source: 'lifi',
            estimatedGas: lifiQuote.transactionRequest?.gasLimit,
            executionDuration: lifiQuote.estimate.executionDuration,
          },
        });
      }
    } catch (lifiError) {
      console.error('LiFi quote also failed:', lifiError);
    }

    console.error('Error getting quote:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}

// Helper function to calculate price impact
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculatePriceImpact(amountIn: bigint, amountOut: bigint, _isBuy: boolean): number {
  if (amountIn === BigInt(0) || amountOut === BigInt(0)) return 0;
  
  // Simplified price impact calculation
  const ratio = Number(amountOut) / Number(amountIn);
  const expectedRatio = 1; // This would come from spot price
  
  return Math.abs((ratio / expectedRatio - 1) * 100);
}
