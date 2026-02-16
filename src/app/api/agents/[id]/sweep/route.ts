/**
 * Sweep Agent Funds API
 *
 * POST /api/agents/[id]/sweep — Auto-sell all token holdings, then transfer MON to owner
 *
 * Body: { userAddress: string, recipient?: string }
 * Flow:
 * 1. Verify ownership via userAddress matching agent's owner
 * 2. Auto-sell ALL token holdings (ERC20 tokens) via POST /api/trade
 * 3. Wait for all sells to complete
 * 4. Transfer ALL remaining MON (minus gas) to recipient (default: owner)
 * 5. Return tx hash and amount swept
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { prisma } from '@/lib/prisma';
import { getAgentAccount } from '@/lib/agent-wallet';
import { getRpcUrl, getCurrentNetwork } from '@/lib/config';
import { monadMainnet, monadTestnet } from '@/config/chains';
import { erc20Abi } from '@/config/contracts';
import { getBaseUrl } from '@/lib/get-base-url';

// Pick chain based on network
const currentChain = getCurrentNetwork() === 'mainnet' ? monadMainnet : monadTestnet;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { userAddress, recipient } = body as {
      userAddress?: string;
      recipient?: string;
    };

    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'userAddress required for ownership verification' },
        { status: 400 }
      );
    }

    // Fetch agent with owner info
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        user: { select: { address: true } },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    // Verify ownership
    if (agent.user.address.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Not authorized: you are not the owner of this agent' },
        { status: 403 }
      );
    }

    if (!agent.walletAddr || agent.walletIndex === null) {
      return NextResponse.json(
        { success: false, error: 'Agent has no HD wallet (legacy agent)' },
        { status: 400 }
      );
    }

    // Get agent's HD wallet account (server-side, from AGENT_MASTER_SEED)
    const agentAccount = await getAgentAccount(agentId);

    // Create public client to check balance and estimate gas
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(getRpcUrl(getCurrentNetwork())),
    });

    // ── Step 1: Auto-sell all token holdings ──
    const sellResults: Array<{ token: string; symbol: string; success: boolean; txHash?: string; error?: string }> = [];

    // Query TokenHoldings from Prisma for this agent wallet
    const holdings = await prisma.tokenHolding.findMany({
      where: { walletAddr: agent.walletAddr.toLowerCase() },
    });

    if (holdings.length > 0) {
      const baseUrl = getBaseUrl();

      for (const holding of holdings) {
        const tokenBalance = parseFloat(holding.balance.toString());
        if (tokenBalance <= 0) continue;

        // Verify on-chain balance before selling
        let onChainBalance: bigint;
        try {
          onChainBalance = await publicClient.readContract({
            address: holding.tokenAddr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [agent.walletAddr as `0x${string}`],
          }) as bigint;
        } catch {
          sellResults.push({ token: holding.tokenAddr, symbol: '?', success: false, error: 'Balance check failed' });
          continue;
        }

        if (onChainBalance <= 0n) {
          sellResults.push({ token: holding.tokenAddr, symbol: '?', success: false, error: 'Zero on-chain balance' });
          continue;
        }

        // Sell full balance via /api/trade
        try {
          const sellAmount = formatEther(onChainBalance);
          const tradeResponse = await fetch(`${baseUrl}/api/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenAddress: holding.tokenAddr,
              amount: sellAmount,
              action: 'sell',
              agentId,
              slippageBps: 200, // 2% slippage for sweep (higher tolerance)
            }),
            signal: AbortSignal.timeout(90_000),
          });

          const tradeResult = await tradeResponse.json();
          if (tradeResponse.ok && tradeResult.success) {
            sellResults.push({
              token: holding.tokenAddr,
              symbol: tradeResult.data?.tokenSymbol || '?',
              success: true,
              txHash: tradeResult.data?.txHash,
            });
          } else {
            sellResults.push({
              token: holding.tokenAddr,
              symbol: '?',
              success: false,
              error: tradeResult.error || 'Sell failed',
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sell error';
          sellResults.push({ token: holding.tokenAddr, symbol: '?', success: false, error: msg });
        }
      }
    }

    // ── Step 2: Sweep all remaining MON to owner ──
    const balance = await publicClient.getBalance({
      address: agent.walletAddr as `0x${string}`,
    });

    if (balance === 0n) {
      return NextResponse.json({
        success: true,
        data: {
          agentId: agent.id,
          agentWallet: agent.walletAddr,
          amountSwept: '0',
          tokensSold: sellResults,
          message: 'Agent wallet has zero MON balance after token sells',
        },
      });
    }

    // Estimate gas for a simple MON transfer
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = 21000n; // Standard ETH/MON transfer
    const gasCost = gasLimit * gasPrice;

    // Calculate amount to sweep (balance - gas cost with safety margin)
    const safetyMargin = gasCost / 5n; // 20% buffer
    const sweepAmount = balance - gasCost - safetyMargin;

    if (sweepAmount <= 0n) {
      return NextResponse.json({
        success: false,
        error: `Balance too low to sweep. Balance: ${formatEther(balance)} MON, Gas cost: ~${formatEther(gasCost)} MON`,
        tokensSold: sellResults,
      }, { status: 400 });
    }

    // Determine recipient (default: owner's wallet)
    const sweepTo = (recipient || userAddress) as `0x${string}`;

    // Create wallet client with agent's HD key
    const walletClient = createWalletClient({
      account: agentAccount,
      chain: currentChain,
      transport: http(getRpcUrl(getCurrentNetwork())),
    });

    // Send sweep transaction
    const txHash = await walletClient.sendTransaction({
      to: sweepTo,
      value: sweepAmount,
      gas: gasLimit,
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 30_000,
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId: agent.id,
        agentWallet: agent.walletAddr,
        recipient: sweepTo,
        amountSwept: formatEther(sweepAmount),
        amountSweptWei: sweepAmount.toString(),
        previousBalance: formatEther(balance),
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status,
        tokensSold: sellResults,
      },
    });
  } catch (error) {
    console.error('Error sweeping agent funds:', error);
    const msg = error instanceof Error ? error.message : 'Failed to sweep funds';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
