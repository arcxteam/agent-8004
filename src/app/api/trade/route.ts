/**
 * Trading Execution API
 *
 * Server-side trade execution via agent wallet (AGENT_PRIVATE_KEY).
 * Supports two execution paths:
 * 1. nad.fun bonding curve — for tokens listed on nad.fun (Lens + Router contracts)
 * 2. LiFi DEX aggregator — for standard ERC20 portfolio tokens (WMON, USDC, USDT, etc.)
 *
 * Protected by x402 micropayments ($0.001 USDC per trade) when PAY_TO_ADDRESS is set.
 *
 * POST /api/trade
 * Body: { tokenAddress, amount, action, agentId?, slippageBps?, router? }
 *   - router: 'nadfun' | 'lifi' (default: auto-detect)
 *
 * Flow:
 * 1. Validate input (+ x402 payment check if configured)
 * 2. Create Execution record (EXECUTING)
 * 3. Auto-detect router (nad.fun vs LiFi) or use specified router
 * 4. Get quote and execute swap
 * 5. Update Execution to SUCCESS/FAILED
 * 6. Calculate PnL in USD
 * 7. Update agent metrics (Sharpe, drawdown, win rate)
 * 8. Submit reputation feedback (non-blocking)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  encodeFunctionData,
  parseSignature,
} from 'viem';
import { getNetworkConfig, CAPITAL_VAULT } from '@/config/chains';
import { lensAbi, routerAbi, erc20Abi, dexRouterAbi, bondingCurveRouterAbi, capitalVaultAbi } from '@/config/contracts';
import { prisma } from '@/lib/prisma';
import { getRpcUrl } from '@/lib/config';
import { calculatePnlUsd } from '@/lib/pnl-tracker';
import { calculateAllMetrics } from '@/lib/risk-metrics';
import { getLiFiQuote, executeLiFiSwap, isLiFiSupportedToken, resolveTokenAddress } from '@/lib/lifi-client';
import { getRelayQuote, executeRelaySwap, isRelaySupportedToken } from '@/lib/relay-client';
import { withX402 } from '@x402/next';
import { createX402Server, getRouteConfig } from '@/lib/x402-server';
import { getAgentAccount, getAgentWallet } from '@/lib/agent-wallet';
import { getBaseUrl } from '@/lib/get-base-url';
import { recordTradeOutcome, reflectOnTrade } from '@/lib/trade-memory';

// Get agent-specific wallet (HD-derived per agent, or legacy fallback)
async function getAgentAccountForTrade(agentId?: string) {
  return getAgentAccount(agentId);
}

async function postHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      tokenAddress,
      amount,
      action,
      agentId,
      slippageBps = 100, // 1% default
      router: routerPreference,
      toTokenAddress,
      exactOut = false,
    } = body as {
      tokenAddress?: string;
      amount?: string;
      action?: 'buy' | 'sell';
      agentId?: string;
      slippageBps?: number;
      router?: 'nadfun' | 'lifi' | 'relay' | 'auto';
      toTokenAddress?: string; // For LiFi: destination token (e.g., swap USDC→WETH)
      exactOut?: boolean;      // For DexRouter: use exactOutBuy/exactOutSell (precise token amounts)
    };

    // 1. Validate input
    if (!tokenAddress || !amount || !action) {
      return NextResponse.json(
        { success: false, error: 'tokenAddress, amount, and action (buy/sell) required' },
        { status: 400 }
      );
    }

    if (action !== 'buy' && action !== 'sell') {
      return NextResponse.json(
        { success: false, error: 'action must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    let account;
    try {
      account = await getAgentAccountForTrade(agentId);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Agent wallet not configured. Set AGENT_PRIVATE_KEY in .env' },
        { status: 503 }
      );
    }

    const { chain, contracts } = getNetworkConfig();
    const token = tokenAddress as `0x${string}`;

    const publicClient = createPublicClient({
      chain,
      transport: http(getRpcUrl()),
    });

    const walletClient = createWalletClient({
      chain,
      transport: http(getRpcUrl()),
      account,
    });

    // Validate trade amount is positive
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Trade amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Check wallet balance before executing trade
    // Reserve 5.0 MON for gas fees — MUST match strategy-engine.ts GAS_RESERVE_MON
    // Agent should NEVER spend below this threshold to avoid getting stuck without gas
    const GAS_RESERVE_MON = parseEther('5.0');

    if (action === 'buy') {
      // Buying tokens with MON — check MON balance WITH gas reserve
      const monBalance = await publicClient.getBalance({ address: account.address });
      const requiredAmount = parseEther(amount);
      const requiredWithReserve = requiredAmount + GAS_RESERVE_MON;
      if (monBalance < requiredWithReserve) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient MON balance. Have: ${formatEther(monBalance)} MON, Need: ${amount} MON + 5.0 MON gas reserve`,
          },
          { status: 400 }
        );
      }
    } else {
      // Selling tokens for MON — check token balance
      // Use correct decimals for the token (6 for USDC/USDT/AUSD, 8 for WBTC, 18 for others)
      try {
        const tokenBalance = await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account.address],
        });
        let tokenDecimals = 18;
        try {
          const resolved = resolveTokenAddress(tokenAddress);
          tokenDecimals = resolved.decimals;
        } catch {
          // Not a known LiFi token — default to 18 decimals (nad.fun tokens are 18)
        }
        const requiredAmount = parseUnits(amount, tokenDecimals);
        if ((tokenBalance as bigint) < requiredAmount) {
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient token balance. Have: ${formatUnits(tokenBalance as bigint, tokenDecimals)}, Need: ${amount}`,
            },
            { status: 400 }
          );
        }
      } catch (balanceErr) {
        // Balance check failed — block trade to prevent on-chain revert and gas waste
        const msg = balanceErr instanceof Error ? balanceErr.message : 'Unknown error';
        return NextResponse.json(
          { success: false, error: `Token balance check failed: ${msg}. Cannot proceed with sell.` },
          { status: 503 }
        );
      }
    }

    // 2. Create Execution record
    const execution = await prisma.execution.create({
      data: {
        agentId: agentId || 'system',
        type: action === 'buy' ? 'BUY' : 'SELL',
        params: { tokenAddress, amount, action, slippageBps, router: routerPreference || 'auto', toTokenAddress },
        status: 'EXECUTING',
      },
    });

    try {
      // 3. Determine which router to use
      const useRelay = routerPreference === 'relay' || (
        routerPreference !== 'nadfun' && routerPreference !== 'lifi' && isRelaySupportedToken(tokenAddress)
        && !isLiFiSupportedToken(tokenAddress) // Prefer LiFi for tokens it also supports (more tested path)
      );
      const useLiFi = !useRelay && (routerPreference === 'lifi' || (
        routerPreference !== 'nadfun' && isLiFiSupportedToken(tokenAddress)
      ));

      let txHash!: `0x${string}`;
      let amountInStr!: string;
      let amountOutStr!: string;
      let routerUsed!: string;
      let pnlUsd!: number;
      let monPrice: number | undefined;
      let gasUsed: bigint | undefined;

      if (useRelay) {
        // ===== RELAY PROTOCOL DEX AGGREGATOR PATH =====
        // Solver-based swap via Relay SDK. Supports all MONAD_TOKENS.
        // With retry mechanism: re-quote on failure (max 2 attempts)
        const fromToken = action === 'buy' ? 'MON' : tokenAddress;
        const toToken = action === 'buy' ? tokenAddress : (toTokenAddress || 'MON');
        const MAX_RELAY_ATTEMPTS = 2;
        let relayQuote!: Awaited<ReturnType<typeof getRelayQuote>>;
        let relayResult!: Awaited<ReturnType<typeof executeRelaySwap>>;

        for (let attempt = 1; attempt <= MAX_RELAY_ATTEMPTS; attempt++) {
          relayQuote = await getRelayQuote(fromToken, toToken, amount, account.address);

          try {
            relayResult = await executeRelaySwap(relayQuote, walletClient);
            break; // Success
          } catch (swapErr) {
            if (attempt >= MAX_RELAY_ATTEMPTS) throw swapErr;
            console.warn(`[Trade] Relay swap attempt ${attempt} failed, retrying:`, swapErr);
          }
        }

        txHash = relayResult.txHash as `0x${string}`;
        amountInStr = relayResult.fromAmount;
        amountOutStr = relayResult.toAmount;
        routerUsed = 'relay';

        // Calculate PnL
        const toTokenAddr = action === 'buy' ? tokenAddress : (toTokenAddress || 'MON');
        const isOutputMon = toTokenAddr === 'MON' || toTokenAddr.toLowerCase() === '0x0000000000000000000000000000000000000000';
        const amountInMon = action === 'buy' ? Number(relayResult.fromAmount) : 0;
        const amountOutMon = action === 'sell' ? Number(relayResult.toAmount) : 0;

        let toTokenPriceUsd: number | undefined;
        if (action === 'sell' && !isOutputMon && relayQuote.outputPriceUsd) {
          toTokenPriceUsd = relayQuote.outputPriceUsd;
        }

        const pnlResult = await calculatePnlUsd(
          amountInMon || Number(relayResult.fromAmount),
          amountOutMon || Number(relayResult.toAmount),
          action,
          toTokenPriceUsd,
        );
        pnlUsd = pnlResult.pnlUsd;
        monPrice = pnlResult.monPrice;
      } else if (useLiFi) {
        // ===== LIFI DEX AGGREGATOR PATH =====
        // For standard ERC20 tokens: WMON, USDC, USDT, WBTC, WETH, CHOG, etc.
        // With retry mechanism: re-quote with higher slippage on failure (max 2 attempts)
        const fromToken = action === 'buy' ? 'MON' : tokenAddress;
        const toToken = action === 'buy' ? tokenAddress : (toTokenAddress || 'MON');
        const MAX_LIFI_ATTEMPTS = 2;
        let lifiQuote!: Awaited<ReturnType<typeof getLiFiQuote>>;
        let swapResult!: Awaited<ReturnType<typeof executeLiFiSwap>>;

        for (let attempt = 1; attempt <= MAX_LIFI_ATTEMPTS; attempt++) {
          const effectiveSlippage = attempt === 1
            ? slippageBps
            : Math.min(slippageBps + Math.floor(slippageBps * 0.5), 2000); // +50% slippage on retry, capped at 20%

          lifiQuote = await getLiFiQuote({
            fromToken,
            toToken,
            amount,
            fromAddress: account.address,
            slippageBps: effectiveSlippage,
          });

          try {
            swapResult = await executeLiFiSwap(lifiQuote, walletClient, publicClient);
            break; // Success — exit retry loop
          } catch (swapErr) {
            if (attempt >= MAX_LIFI_ATTEMPTS) throw swapErr;
            console.warn(`[Trade] LiFi swap attempt ${attempt} failed, retrying with higher slippage:`, swapErr);
          }
        }

        txHash = swapResult.txHash as `0x${string}`;
        amountInStr = swapResult.fromAmount;
        amountOutStr = swapResult.toAmount;
        routerUsed = 'lifi';
        gasUsed = swapResult.gasUsed;

        // Calculate PnL for LiFi trades
        // Determine if output token is non-MON (e.g., USDC, USDT, WETH)
        const toTokenAddr = action === 'buy' ? tokenAddress : (toTokenAddress || 'MON');
        const isOutputMon = toTokenAddr === 'MON' || toTokenAddr.toLowerCase() === '0x0000000000000000000000000000000000000000';
        const amountInMon = action === 'buy' ? Number(swapResult.fromAmount) : 0;
        const amountOutMon = action === 'sell' ? Number(swapResult.toAmount) : 0;

        // For SELL to non-MON, extract priceUSD from LiFi quote to avoid wrong PnL
        let toTokenPriceUsd: number | undefined;
        if (action === 'sell' && !isOutputMon && lifiQuote.action?.toToken?.priceUSD) {
          toTokenPriceUsd = Number(lifiQuote.action.toToken.priceUSD);
          if (isNaN(toTokenPriceUsd) || toTokenPriceUsd <= 0) toTokenPriceUsd = undefined;
        }

        const pnlResult = await calculatePnlUsd(
          amountInMon || Number(swapResult.fromAmount),
          amountOutMon || Number(swapResult.toAmount),
          action,
          toTokenPriceUsd,
        );
        pnlUsd = pnlResult.pnlUsd;
        monPrice = pnlResult.monPrice;
      } else {
        // ===== NAD.FUN BONDING CURVE PATH =====
        // For tokens on nad.fun bonding curves
        let amountIn: bigint;
        let amountOut: bigint;
        let router: string;

        // Determine if this is an ExactOut trade via DexRouter
        const isDexExactOut = exactOut;

        // --- QUOTE PHASE (once — no retry needed) ---
        if (isDexExactOut) {
          // ExactOut mode: user specifies desired output amount
          // Use Lens.getAmountIn() to calculate required input
          const desiredOut = parseEther(amount);

          const quoteResult = await publicClient.readContract({
            address: contracts.LENS,
            abi: lensAbi,
            functionName: 'getAmountIn',
            args: [token, desiredOut, action === 'buy'],
          });
          [router, amountIn] = quoteResult as [string, bigint];
          amountOut = desiredOut;

          if (!router || router === '0x0000000000000000000000000000000000000000') {
            throw new Error(`Lens returned invalid router for token ${token}. Token may not exist on nad.fun.`);
          }
          if (amountIn === 0n) {
            throw new Error(`Lens returned 0 amountIn for exactOut ${amount} on token ${token}.`);
          }

          // ExactOut only works on DexRouter (graduated tokens)
          const isDexRouter = (router as string).toLowerCase() === contracts.DEX_ROUTER.toLowerCase();
          if (!isDexRouter) {
            throw new Error(`exactOut is only supported for graduated tokens (DexRouter). Token ${token} is still on BondingCurveRouter.`);
          }

          console.log(`[Trade] ExactOut ${action.toUpperCase()} via DexRouter: ${token}, desiredOut=${formatEther(desiredOut)}, requiredIn=${formatEther(amountIn)}`);
        } else if (action === 'buy') {
          amountIn = parseEther(amount);

          const quoteResult = await publicClient.readContract({
            address: contracts.LENS,
            abi: lensAbi,
            functionName: 'getAmountOut',
            args: [token, amountIn, true],
          });
          [router, amountOut] = quoteResult as [string, bigint];

          if (!router || router === '0x0000000000000000000000000000000000000000') {
            throw new Error(`Lens returned invalid router for token ${token}. Token may not exist on nad.fun.`);
          }
          if (amountOut === 0n) {
            throw new Error(`Lens returned 0 amountOut for ${amount} MON on token ${token}. Liquidity may be depleted.`);
          }

          const isBondingCurveBuy = (router as string).toLowerCase() === contracts.BONDING_CURVE_ROUTER.toLowerCase();
          console.log(`[Trade] BUY via ${isBondingCurveBuy ? 'BondingCurveRouter' : 'DexRouter'}: ${token}`);
        } else {
          amountIn = parseEther(amount);

          const quoteResult = await publicClient.readContract({
            address: contracts.LENS,
            abi: lensAbi,
            functionName: 'getAmountOut',
            args: [token, amountIn, false],
          });
          [router, amountOut] = quoteResult as [string, bigint];

          if (!router || router === '0x0000000000000000000000000000000000000000') {
            throw new Error(`Lens returned invalid router for token ${token}. Token may not exist on nad.fun.`);
          }
          if (amountOut === 0n) {
            throw new Error(`Lens returned 0 amountOut for selling ${amount} tokens of ${token}. Liquidity may be depleted.`);
          }

          const isBondingCurveSell = (router as string).toLowerCase() === contracts.BONDING_CURVE_ROUTER.toLowerCase();
          console.log(`[Trade] SELL via ${isBondingCurveSell ? 'BondingCurveRouter' : 'DexRouter'}: ${token}`);
        }

        // Determine which ABI to use based on router address
        const isBondingCurveRouter = (router as string).toLowerCase() === contracts.BONDING_CURVE_ROUTER.toLowerCase();
        const activeRouterAbi = isBondingCurveRouter ? bondingCurveRouterAbi : dexRouterAbi;

        // --- EXECUTION PHASE (with retry: max 2 attempts) ---
        // Retry once on failure with +50% slippage tolerance.
        // Does NOT retry Lens validation errors (already thrown above).
        const MAX_TX_ATTEMPTS = 2;
        let lastTxErr: Error | null = null;

        for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
          try {
            const effectiveSlippage = attempt === 1
              ? slippageBps
              : Math.min(Math.round(slippageBps * 1.5), 2000); // Max 20% on retry
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

            if (isDexExactOut) {
              // ExactOut mode: use DexRouter.exactOutBuy or exactOutSell
              const amountInMax = amountIn + (amountIn * BigInt(effectiveSlippage)) / 10000n;

              if (action === 'buy') {
                const callData = encodeFunctionData({
                  abi: dexRouterAbi,
                  functionName: 'exactOutBuy',
                  args: [{ amountInMax, amountOut, token, to: account.address, deadline }],
                });
                txHash = await walletClient.sendTransaction({
                  to: router as `0x${string}`,
                  data: callData,
                  value: amountInMax, // Send max MON, refund excess
                });
              } else {
                // ExactOut Sell — try sellPermit first
                try {
                  const [tokenName, nonce] = await Promise.all([
                    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'name' }),
                    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'nonces', args: [account.address] }),
                  ]);
                  const sig = await account.signTypedData({
                    domain: { name: tokenName as string, version: '1', chainId: chain.id, verifyingContract: token },
                    types: { Permit: [
                      { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
                      { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
                    ] },
                    primaryType: 'Permit',
                    message: { owner: account.address, spender: router as `0x${string}`, value: amountInMax, nonce: nonce as bigint, deadline },
                  });
                  const { v, r, s } = parseSignature(sig);
                  const callData = encodeFunctionData({
                    abi: dexRouterAbi,
                    functionName: 'exactOutSellPermit',
                    args: [{ amountInMax, amountOut, amountAllowance: amountInMax, token, to: account.address, deadline, v: Number(v), r, s }],
                  });
                  txHash = await walletClient.sendTransaction({ to: router as `0x${string}`, data: callData });
                  console.log('[Trade] exactOutSellPermit succeeded (1 tx)');
                } catch (permitErr) {
                  console.warn('[Trade] exactOutSellPermit failed, fallback to approve+exactOutSell:', permitErr);
                  const approveTx = await walletClient.writeContract({
                    address: token, abi: erc20Abi, functionName: 'approve',
                    args: [router as `0x${string}`, amountInMax],
                  });
                  await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
                  const callData = encodeFunctionData({
                    abi: dexRouterAbi,
                    functionName: 'exactOutSell',
                    args: [{ amountInMax, amountOut, token, to: account.address, deadline }],
                  });
                  txHash = await walletClient.sendTransaction({ to: router as `0x${string}`, data: callData });
                }
              }
            } else if (action === 'buy') {
              const amountOutMin = (amountOut * BigInt(10000 - effectiveSlippage)) / 10000n;

              const callData = encodeFunctionData({
                abi: activeRouterAbi,
                functionName: 'buy',
                args: [{ amountOutMin, token, to: account.address, deadline }],
              });

              txHash = await walletClient.sendTransaction({
                to: router as `0x${string}`,
                data: callData,
                value: amountIn,
              });
            } else {
              const amountOutMin = (amountOut * BigInt(10000 - effectiveSlippage)) / 10000n;

              // Try sellPermit first (1 tx, saves ~50% gas)
              try {
                const [tokenName, nonce] = await Promise.all([
                  publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'name' }),
                  publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'nonces', args: [account.address] }),
                ]);

                const sig = await account.signTypedData({
                  domain: {
                    name: tokenName as string,
                    version: '1',
                    chainId: chain.id,
                    verifyingContract: token,
                  },
                  types: {
                    Permit: [
                      { name: 'owner', type: 'address' },
                      { name: 'spender', type: 'address' },
                      { name: 'value', type: 'uint256' },
                      { name: 'nonce', type: 'uint256' },
                      { name: 'deadline', type: 'uint256' },
                    ],
                  },
                  primaryType: 'Permit',
                  message: {
                    owner: account.address,
                    spender: router as `0x${string}`,
                    value: amountIn,
                    nonce: nonce as bigint,
                    deadline,
                  },
                });

                const { v, r, s } = parseSignature(sig);

                const callData = encodeFunctionData({
                  abi: activeRouterAbi,
                  functionName: 'sellPermit',
                  args: [{
                    amountIn,
                    amountOutMin,
                    amountAllowance: amountIn,
                    token,
                    to: account.address,
                    deadline,
                    v: Number(v),
                    r,
                    s,
                  }],
                });

                txHash = await walletClient.sendTransaction({
                  to: router as `0x${string}`,
                  data: callData,
                });
                console.log('[Trade] sellPermit succeeded (1 tx)');
              } catch (permitErr) {
                console.warn('[Trade] sellPermit failed, falling back to approve+sell:', permitErr);

                const approveTx = await walletClient.writeContract({
                  address: token,
                  abi: erc20Abi,
                  functionName: 'approve',
                  args: [router as `0x${string}`, amountIn],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });

                const callData = encodeFunctionData({
                  abi: activeRouterAbi,
                  functionName: 'sell',
                  args: [{ amountIn, amountOutMin, token, to: account.address, deadline }],
                });

                txHash = await walletClient.sendTransaction({
                  to: router as `0x${string}`,
                  data: callData,
                });
              }
            }

            // Wait for receipt (60s timeout)
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

            if (receipt.status === 'reverted') {
              throw new Error('Transaction reverted');
            }

            // Success — set outputs and break
            gasUsed = receipt.gasUsed;
            lastTxErr = null;
            break;
          } catch (txErr) {
            lastTxErr = txErr instanceof Error ? txErr : new Error('TX execution failed');
            if (attempt < MAX_TX_ATTEMPTS) {
              console.warn(`[Trade] Attempt ${attempt} failed, retrying with higher slippage:`, lastTxErr.message);
            }
          }
        }

        if (lastTxErr) {
          throw lastTxErr;
        }

        // Calculate PnL in USD
        // BUY: amountIn is MON spent, amountOut is tokens received (not MON)
        // SELL: amountIn is tokens sold (not MON), amountOut is MON received
        const amountInMon = action === 'buy' ? Number(formatEther(amountIn)) : 0;
        const amountOutMon = action === 'sell' ? Number(formatEther(amountOut)) : 0;
        const pnlResult = await calculatePnlUsd(amountInMon, amountOutMon, action);
        pnlUsd = pnlResult.pnlUsd;
        monPrice = pnlResult.monPrice;
        amountInStr = formatEther(amountIn);
        amountOutStr = formatEther(amountOut);
        routerUsed = router;
      }

      // Update Execution to SUCCESS
      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          txHash,
          pnl: pnlUsd,
          gasUsed: gasUsed,
          result: {
            txHash,
            router: routerUsed,
            amountIn: amountInStr,
            amountOut: amountOutStr,
            pnlUsd,
            monPrice,
            gasUsed: gasUsed?.toString(),
          },
          completedAt: new Date(),
        },
      });

      // 8. Update agent metrics (non-blocking)
      if (agentId && agentId !== 'system') {
        updateAgentMetrics(agentId, pnlUsd).catch((err) =>
          console.warn('Failed to update agent metrics:', err)
        );

        // Sync totalCapital after trade (adjust by PnL)
        syncAgentCapital(agentId, pnlUsd).catch((err) =>
          console.warn('Failed to sync agent capital:', err)
        );

        // 9. Submit reputation feedback (non-blocking)
        submitTradeReputationFeedback(agentId, pnlUsd, txHash).catch((err) =>
          console.warn('Failed to submit reputation feedback:', err)
        );

        // 10. Distribute PnL proportionally to active delegators
        distributePnlToDelegators(agentId, pnlUsd).catch((err) =>
          console.warn('Failed to distribute PnL to delegators:', err)
        );

        // 11. Create validation artifact (non-blocking)
        createTradeValidation(execution.id, agentId).catch((err) =>
          console.warn('Failed to create validation artifact:', err)
        );

        // 12. Record trading fee on vault (non-blocking, gated by vault deployment)
        recordTradingFee(agentId, tokenAddress, amountInStr).catch((err) =>
          console.warn('Failed to record trading fee:', err)
        );

        // 13. Record trade outcome in memory for AI learning (non-blocking)
        const tradeMemory = recordTradeOutcome(agentId, {
          id: execution.id,
          agentId,
          type: action === 'buy' ? 'BUY' : 'SELL',
          params: { tokenAddress, amount, action, slippageBps, router: routerUsed },
          result: { txHash, router: routerUsed, amountIn: amountInStr, amountOut: amountOutStr, pnlUsd, monPrice },
          pnl: pnlUsd,
          status: 'SUCCESS',
          executedAt: execution.executedAt || new Date(),
          completedAt: new Date(),
          errorMsg: null,
        });

        // 13b. AI-powered reflection on trade outcome (non-blocking, async)
        reflectOnTrade(agentId, tradeMemory).catch(() => {
          // Reflection failure is non-blocking
        });
      }

      // 14. Update TokenHolding cost basis (non-blocking)
      updateTokenHolding(
        account.address,
        tokenAddress,
        action,
        action === 'buy' ? amountOutStr : amountInStr,  // BUY: tokens received, SELL: tokens sold
        action === 'buy' ? parseFloat(amountInStr) : parseFloat(amountOutStr),  // BUY: MON spent, SELL: MON received
      ).catch((err) =>
        console.warn('Failed to update token holding:', err)
      );

      return NextResponse.json({
        success: true,
        data: {
          executionId: execution.id,
          txHash,
          action,
          tokenAddress,
          router: routerUsed,
          amountIn: amountInStr,
          amountOut: amountOutStr,
          pnlUsd: pnlUsd.toFixed(4),
          monPrice,
          gasUsed: gasUsed?.toString(),
        },
      });
    } catch (execError: unknown) {
      // Update Execution to FAILED
      const errorMsg = execError instanceof Error ? execError.message : 'Unknown execution error';
      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMsg,
          completedAt: new Date(),
        },
      });

      // Submit negative reputation feedback for failed trade (non-blocking)
      if (agentId && agentId !== 'system') {
        submitTradeReputationFeedback(agentId, -1, undefined, errorMsg).catch((err) =>
          console.warn('Failed to submit failure feedback:', err)
        );

        // Record failed trade in memory for AI learning
        recordTradeOutcome(agentId, {
          id: execution.id,
          agentId,
          type: action === 'buy' ? 'BUY' : 'SELL',
          params: { tokenAddress, amount, action, slippageBps },
          result: null,
          pnl: 0,
          status: 'FAILED',
          executedAt: execution.executedAt || new Date(),
          completedAt: new Date(),
          errorMsg,
        });
      }

      return NextResponse.json(
        { success: false, error: errorMsg, executionId: execution.id },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

/**
 * Update agent metrics after trade (Sharpe, drawdown, win rate, PnL)
 */
async function updateAgentMetrics(agentId: string, pnlUsd: number) {
  // Fetch all executions for this agent
  const executions = await prisma.execution.findMany({
    where: { agentId, status: 'SUCCESS' },
    select: { pnl: true, status: true, executedAt: true },
    orderBy: { executedAt: 'asc' },
  });

  const metricsInput = executions.map((e) => ({
    pnl: e.pnl ? Number(e.pnl) : null,
    status: e.status,
    executedAt: e.executedAt,
  }));

  const metrics = calculateAllMetrics(metricsInput);

  // Update agent stats
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      totalTrades: metrics.totalTrades,
      totalPnl: { increment: pnlUsd },
    },
  });
}

/**
 * Sync agent's totalCapital after trade execution.
 * For buy: capital decreases by amountIn (MON spent).
 * For sell: capital increases by amountOut (MON received).
 * We use the PnL (already in USD) to keep a running total.
 */
async function syncAgentCapital(agentId: string, pnlUsd: number) {
  // Adjust totalCapital by PnL amount (approximation in MON terms)
  // Since pnlUsd = pnlMon * monPrice, and totalCapital is stored in MON-equivalent,
  // we increment by pnlMon. However, we only have pnlUsd here, so we use it as-is
  // for the totalPnl field. The totalCapital adjusts via the Decimal increment.
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      // totalPnl is already incremented in updateAgentMetrics
      // Here we adjust totalCapital based on realized PnL
      totalCapital: { increment: pnlUsd },
    },
  });
}

/**
 * Distribute trade PnL proportionally to all active delegators.
 * Uses pro-rata model: each delegator gets (delegation / totalCapital) * tradePnl.
 * Performance fee (default 20%) is deducted from delegator profits only (not losses).
 */
async function distributePnlToDelegators(agentId: string, tradePnl: number) {
  if (tradePnl === 0) return;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { totalCapital: true, performanceFeeBps: true, onChainId: true, walletIndex: true },
  });
  if (!agent) return;

  const activeDelegations = await prisma.delegation.findMany({
    where: { agentId, status: 'ACTIVE' },
  });
  if (activeDelegations.length === 0) return;

  const totalCapital = parseFloat(agent.totalCapital?.toString() || '0');
  if (totalCapital <= 0) return;

  const feeBps = agent.performanceFeeBps ?? 2000;
  const feeRate = feeBps / 10000;

  // Batch update all delegations in a single transaction
  const updates = activeDelegations.map((d) => {
    const delegationAmount = parseFloat(d.amount.toString());
    const share = (delegationAmount / totalCapital) * tradePnl;
    // Performance fee only on profits, not losses
    const netShare = share > 0 ? share * (1 - feeRate) : share;
    return prisma.delegation.update({
      where: { id: d.id },
      data: { accumulatedPnl: { increment: netShare } },
    });
  });

  await prisma.$transaction(updates);

  // Record PnL on-chain via vault operator (non-blocking, graceful fail)
  try {
    const { recordPnlOnChain, depositProfitsOnChain } = await import('@/lib/vault-operator');

    // Filter delegations that have on-chain mapping
    const onChainDelegations = activeDelegations.filter(
      (d) => d.onChainDelegationId != null
    );

    if (onChainDelegations.length > 0) {
      const delegationIds = onChainDelegations.map((d) =>
        BigInt(d.onChainDelegationId!.toString())
      );
      const pnlAmounts = onChainDelegations.map((d) => {
        const delegationAmount = parseFloat(d.amount.toString());
        const share = (delegationAmount / totalCapital) * tradePnl;
        const netShare = share > 0 ? share * (1 - feeRate) : share;
        // Convert to wei (18 decimals)
        return BigInt(Math.round(netShare * 1e18));
      });

      await recordPnlOnChain(delegationIds, pnlAmounts);
    }

    // If profitable, deposit profits to vault from agent wallet
    if (tradePnl > 0 && agent.onChainId && agent.walletIndex != null) {
      const totalDelegatorShare = onChainDelegations.reduce((sum, d) => {
        const delegationAmount = parseFloat(d.amount.toString());
        const share = (delegationAmount / totalCapital) * tradePnl;
        return sum + share * (1 - feeRate);
      }, 0);

      if (totalDelegatorShare > 0) {
        const { returnFundsToVault } = await import('@/lib/vault-operator');
        const agentAccount = getAgentWallet(agent.walletIndex).account;
        await returnFundsToVault(
          BigInt(agent.onChainId),
          BigInt(Math.round(totalDelegatorShare * 1e18)),
          agentAccount
        );
      }
    }
  } catch (err) {
    // On-chain recording is best-effort — DB is already updated
    console.warn('Failed to record PnL on-chain (DB already updated):', err);
  }
}

/**
 * Submit reputation feedback after trade execution
 */
async function submitTradeReputationFeedback(
  agentId: string,
  pnlUsd: number,
  txHash?: string,
  errorMsg?: string
) {
  const isSuccess = pnlUsd >= 0 && !errorMsg;
  const score = isSuccess ? Math.min(100, Math.round(50 + pnlUsd * 10)) : Math.max(0, 30);

  // Get agent's wallet address for feedback attribution
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { walletAddr: true, erc8004AgentId: true, onChainId: true },
  });
  const clientAddr = agent?.walletAddr || 'unknown';

  // Save to Prisma
  await prisma.feedback.create({
    data: {
      agentId,
      clientAddr,
      value: BigInt(Math.round(pnlUsd * 100)),
      valueDecimals: 2,
      score,
      tag1: 'trade_execution',
      tag2: isSuccess ? 'success' : 'failure',
      endpoint: txHash || undefined,
      createdAt: new Date(),
    },
  });

  // Submit on-chain via agent0-sdk (non-blocking, may fail if no private key)
  try {
    const { submitFeedback } = await import('@/lib/agent0-service');

    if (agent?.onChainId || agent?.erc8004AgentId) {
      const chainAgentId = agent.onChainId || `10143:${agent.erc8004AgentId}`;
      await submitFeedback({
        agentId: chainAgentId,
        agentDbId: agentId,
        value: Math.round(pnlUsd * 100),
        tag1: 'trade_execution',
        tag2: isSuccess ? 'success' : 'failure',
        endpoint: txHash || '',
      });
    }
  } catch (err) {
    console.warn('On-chain feedback submission failed (non-critical):', err);
  }
}

/**
 * GET /api/trade - Get recent executions
 */
async function getHandler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '20');

  const executions = await prisma.execution.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { executedAt: 'desc' },
    take: Math.min(limit, 100),
    select: {
      id: true,
      agentId: true,
      type: true,
      params: true,
      result: true,
      pnl: true,
      txHash: true,
      status: true,
      executedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ success: true, data: executions });
}

/**
 * Update TokenHolding with cost basis tracking after trade execution.
 * BUY: upsert → add balance, update avgBuyPrice (weighted average), increase totalCost.
 * SELL: update → subtract balance, calculate realizedPnl from avgBuyPrice.
 */
async function updateTokenHolding(
  walletAddr: string,
  tokenAddr: string,
  action: 'buy' | 'sell',
  tokenAmount: string,    // Amount of tokens bought or sold (not MON)
  monSpent: number,       // MON spent (buy) or MON received (sell)
) {
  const tokenAddrLower = tokenAddr.toLowerCase();
  const walletAddrLower = walletAddr.toLowerCase();
  const tradeTokens = parseFloat(tokenAmount);

  if (isNaN(tradeTokens) || tradeTokens <= 0) return;

  if (action === 'buy') {
    // Calculate price per token for this trade (MON per token)
    const pricePerToken = monSpent / tradeTokens;

    const existing = await prisma.tokenHolding.findUnique({
      where: { walletAddr_tokenAddr: { walletAddr: walletAddrLower, tokenAddr: tokenAddrLower } },
    });

    if (existing) {
      // Weighted average: (oldCost + newCost) / (oldBalance + newBalance)
      const oldBalance = parseFloat(existing.balance.toString());
      const oldTotalCost = parseFloat(existing.totalCost?.toString() || '0');
      const newTotalCost = oldTotalCost + monSpent;
      const newBalance = oldBalance + tradeTokens;
      const newAvgPrice = newBalance > 0 ? newTotalCost / newBalance : pricePerToken;

      await prisma.tokenHolding.update({
        where: { walletAddr_tokenAddr: { walletAddr: walletAddrLower, tokenAddr: tokenAddrLower } },
        data: {
          balance: newBalance,
          avgBuyPrice: newAvgPrice,
          totalCost: newTotalCost,
        },
      });
    } else {
      await prisma.tokenHolding.create({
        data: {
          walletAddr: walletAddrLower,
          tokenAddr: tokenAddrLower,
          balance: tradeTokens,
          avgBuyPrice: pricePerToken,
          totalCost: monSpent,
          realizedPnl: 0,
        },
      });
    }
  } else {
    // SELL: reduce balance, calculate realized PnL
    const existing = await prisma.tokenHolding.findUnique({
      where: { walletAddr_tokenAddr: { walletAddr: walletAddrLower, tokenAddr: tokenAddrLower } },
    });

    if (existing) {
      const oldBalance = parseFloat(existing.balance.toString());
      const avgBuyPrice = parseFloat(existing.avgBuyPrice?.toString() || '0');
      const oldRealizedPnl = parseFloat(existing.realizedPnl.toString());

      // Realized PnL for this sell = (sellPrice - avgBuyPrice) * tokensSold
      const sellPricePerToken = tradeTokens > 0 ? monSpent / tradeTokens : 0;
      const tradePnl = (sellPricePerToken - avgBuyPrice) * tradeTokens;

      const newBalance = Math.max(0, oldBalance - tradeTokens);
      // Reduce totalCost proportionally
      const costReduction = avgBuyPrice * tradeTokens;
      const oldTotalCost = parseFloat(existing.totalCost?.toString() || '0');
      const newTotalCost = Math.max(0, oldTotalCost - costReduction);

      await prisma.tokenHolding.update({
        where: { walletAddr_tokenAddr: { walletAddr: walletAddrLower, tokenAddr: tokenAddrLower } },
        data: {
          balance: newBalance,
          totalCost: newTotalCost,
          realizedPnl: oldRealizedPnl + tradePnl,
          // avgBuyPrice stays the same (FIFO-equivalent for weighted average)
        },
      });
    }
    // If no existing holding found for sell, skip (shouldn't happen in normal flow)
  }
}

/**
 * Record trading fee on-chain via vault (non-blocking, gated by vault deployment).
 * Only executes if CAPITAL_VAULT address is configured.
 */
async function recordTradingFee(agentId: string, tokenAddress: string, amountInStr: string) {
  const { network } = getNetworkConfig();
  const vaultAddr = CAPITAL_VAULT[network];
  if (!vaultAddr) return; // Vault not deployed yet — skip silently

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { onChainId: true, erc8004AgentId: true },
  });
  if (!agent?.onChainId && !agent?.erc8004AgentId) return;

  const onChainAgentId = agent.erc8004AgentId
    ? BigInt(agent.erc8004AgentId.toString())
    : BigInt(0);
  if (onChainAgentId === 0n) return;

  const tradeAmount = parseEther(amountInStr);
  // address(0) for native MON trades, token address for ERC20
  const feeTokenAddr = tokenAddress as `0x${string}`;

  const { recordTradingFeeOnChain } = await import('@/lib/vault-operator');
  await recordTradingFeeOnChain(onChainAgentId, feeTokenAddr, tradeAmount);
  console.log(`[Trade] Trading fee recorded on vault for agent ${agentId}`);
}

/**
 * Create validation artifact after successful trade execution
 */
async function createTradeValidation(executionId: string, agentId: string) {
  const baseUrl = getBaseUrl();
  await fetch(`${baseUrl}/api/validations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executionId, agentId }),
    signal: AbortSignal.timeout(10000),
  });
}

// ─── x402 Micropayment Protection ────────────────────────────────────────────
// Charge $0.001 USDC per trade execution via x402 protocol.
// Only active when PAY_TO_ADDRESS is set; dev mode remains free.

const PAY_TO = process.env.PAY_TO_ADDRESS;
let x402Server: ReturnType<typeof createX402Server> | null = null;
let routeConfig: ReturnType<typeof getRouteConfig> | null = null;

if (PAY_TO) {
  try {
    x402Server = createX402Server();
    routeConfig = getRouteConfig(PAY_TO, '$0.001', '/api/trade', 'ANOA Trade Execution');
  } catch (err) {
    console.warn('x402 trade server init failed, POST will be unprotected:', err);
  }
}

export const POST = (PAY_TO && x402Server && routeConfig)
  ? withX402(postHandler, routeConfig, x402Server)
  : postHandler;

export const GET = getHandler;
