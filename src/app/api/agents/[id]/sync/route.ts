/**
 * Agent Balance Sync API — Reconcile on-chain balance to DB
 *
 * POST /api/agents/[id]/sync
 *
 * Queries the agent's actual on-chain wallet balance + token holdings
 * and updates the DB totalCapital to match reality.
 * This fixes drift caused by direct transfers, gas costs, or any
 * on-chain activity not tracked through the trade execution pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTimeoutPublicClient } from '@/lib/rpc-client';
import { getNetworkConfig } from '@/config/chains';
import { getRpcUrl } from '@/lib/config';
import { getHoldings } from '@/lib/nadfun-api';
import { getERC20Holdings } from '@/lib/lifi-client';
import { getMonUsdPrice } from '@/lib/pnl-tracker';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch agent from DB
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        walletAddr: true,
        totalCapital: true,
        totalPnl: true,
        status: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (!agent.walletAddr) {
      return NextResponse.json(
        { success: false, error: 'Agent has no wallet address' },
        { status: 400 }
      );
    }

    // Set up RPC client
    const { network } = getNetworkConfig();
    const rpcUrl = getRpcUrl(network);
    const chain = network === 'mainnet'
      ? (await import('@/config/chains')).monadMainnet
      : (await import('@/config/chains')).monadTestnet;
    const publicClient = createTimeoutPublicClient(chain, rpcUrl, 8000);

    // Query on-chain balance + holdings (nad.fun bonding curve + ERC-20 tokens)
    const [balance, nadfunHoldings, erc20Holdings] = await Promise.all([
      publicClient.getBalance({ address: agent.walletAddr as `0x${string}` }),
      getHoldings(agent.walletAddr).catch(() => ({ holdings: [] })),
      getERC20Holdings(publicClient, agent.walletAddr).catch(() => ({ holdings: [] })),
    ]);

    // Merge nad.fun + ERC-20 holdings, deduplicate by token address
    const holdingsMap = new Map<string, typeof nadfunHoldings.holdings[0]>();
    for (const h of nadfunHoldings.holdings) {
      holdingsMap.set(h.token.toLowerCase(), h);
    }
    for (const h of erc20Holdings.holdings) {
      const key = h.token.toLowerCase();
      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, h);
      }
    }
    const mergedHoldings = Array.from(holdingsMap.values());

    const walletBalanceMon = Number(balance) / 1e18;

    // Approximate holdings value in MON
    let holdingsValueMon = 0;
    if (mergedHoldings.length > 0) {
      for (const h of mergedHoldings) {
        holdingsValueMon += parseFloat(h.value || '0');
      }
    }

    const totalOnChainValue = walletBalanceMon + holdingsValueMon;
    const previousCapital = parseFloat(agent.totalCapital?.toString() || '0');
    const drift = totalOnChainValue - previousCapital;

    // Update DB
    const updated = await prisma.agent.update({
      where: { id },
      data: { totalCapital: totalOnChainValue },
    });

    // Get MON price for USD display
    let monPrice = 0;
    try {
      monPrice = await getMonUsdPrice();
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        walletAddr: agent.walletAddr,
        previous: {
          totalCapitalMon: previousCapital,
          totalCapitalUsd: previousCapital * monPrice,
        },
        current: {
          walletBalanceMon,
          holdingsValueMon,
          totalOnChainValueMon: totalOnChainValue,
          totalOnChainValueUsd: totalOnChainValue * monPrice,
        },
        drift: {
          mon: drift,
          usd: drift * monPrice,
        },
        holdings: mergedHoldings,
        monPrice,
      },
    });
  } catch (error) {
    console.error('Error syncing agent balance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync agent balance' },
      { status: 500 }
    );
  }
}
