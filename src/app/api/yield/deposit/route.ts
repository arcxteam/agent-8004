import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API endpoint for tracking yield deposits
 * 
 * This endpoint is called after a successful deposit transaction to log it in the database.
 * The blockchain is the source of truth, this is for analytics and user history.
 * 
 * POST /api/yield/deposit
 * Body: {
 *   walletAddress: string,
 *   strategyId: 'apriori-mon' | 'upshift-ausd',
 *   protocol: 'APRIORI' | 'UPSHIFT',
 *   action: 'DEPOSIT',
 *   tokenIn: string (address),
 *   tokenOut: string (address),
 *   amountIn: string,
 *   sharesOut?: string,
 *   txHash: string,
 *   chainId?: number
 * }
 */

interface DepositRequest {
  walletAddress: string;
  strategyId: string;
  protocol: 'APRIORI' | 'UPSHIFT';
  action: 'DEPOSIT';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  sharesOut?: string;
  txHash: string;
  chainId?: number;
}

// Contract addresses for validation
const VALID_CONTRACTS = {
  APRMON: '0x0c65A0BC65a5D819235B71F554D210D3F80E0852',
  UPSHIFT_VAULT: '0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA',
  EARNAUSD: '0x103222f020e98Bba0AD9809A011FDF8e6F067496',
  AUSD: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DepositRequest;
    
    // Validate required fields
    if (!body.walletAddress || !body.strategyId || !body.protocol || !body.txHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate wallet address format
    if (!body.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }
    
    // Validate tx hash format
    if (!body.txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }
    
    // Validate protocol
    if (!['APRIORI', 'UPSHIFT'].includes(body.protocol)) {
      return NextResponse.json(
        { error: 'Invalid protocol' },
        { status: 400 }
      );
    }
    
    // Validate strategyId matches protocol
    const validStrategyMapping: Record<string, string> = {
      'apriori-mon': 'APRIORI',
      'mon-staking': 'APRIORI',
      'upshift-ausd': 'UPSHIFT',
    };
    
    if (validStrategyMapping[body.strategyId] !== body.protocol) {
      return NextResponse.json(
        { error: 'Strategy does not match protocol' },
        { status: 400 }
      );
    }
    
    // Log the deposit (placeholder until Prisma is connected)
    console.log('[Yield Deposit]', {
      timestamp: new Date().toISOString(),
      wallet: body.walletAddress,
      protocol: body.protocol,
      strategy: body.strategyId,
      tokenIn: body.tokenIn,
      amountIn: body.amountIn,
      txHash: body.txHash,
    });
    
    // Database insert
    const deposit = await prisma.yieldDeposit.create({
      data: {
        walletAddr: body.walletAddress.toLowerCase(),
        strategyId: body.strategyId,
        protocol: body.protocol,
        action: body.action || 'DEPOSIT',
        tokenIn: body.tokenIn.toLowerCase(),
        tokenOut: body.tokenOut.toLowerCase(),
        amountIn: body.amountIn,
        sharesOut: body.sharesOut || null,
        txHash: body.txHash.toLowerCase(),
        status: 'PENDING', // Will be updated by indexer
        chainId: body.chainId || 143, // Monad mainnet
      },
    });
    
    return NextResponse.json({
      success: true,
      depositId: deposit.id,
      message: 'Deposit logged successfully',
    });
    
  } catch (error) {
    console.error('[Yield Deposit Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/yield/deposit?wallet=0x...
 * 
 * Get deposit history for a wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }
    
    // Validate wallet address format
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }
    
    // Database query
    const deposits = await prisma.yieldDeposit.findMany({
      where: {
        walletAddr: wallet.toLowerCase(),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
    
    return NextResponse.json({
      deposits,
      total: deposits.length,
    });
    
  } catch (error) {
    console.error('[Yield Deposit GET Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
