/**
 * Strategy Evaluation API
 *
 * POST /api/agents/[id]/evaluate
 *
 * Triggers a strategy evaluation for a specific agent.
 * Fetches market data, runs the agent's configured strategy,
 * and optionally creates a TradeProposal (via OpenClaw) if
 * a strong signal is found.
 *
 * Body (optional):
 *   { tokens?: string[], autoPropose?: boolean }
 *
 * Response:
 *   { success, data: EvaluationResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  evaluateStrategy,
  getDefaultEvaluationTokens,
  type AgentContext,
  type StrategyType,
  type RiskLevel,
} from '@/lib/strategy-engine';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Parse optional body
    let tokens: string[] | undefined;
    let autoPropose = true;
    try {
      const body = await request.json();
      tokens = body.tokens;
      if (typeof body.autoPropose === 'boolean') {
        autoPropose = body.autoPropose;
      }
    } catch {
      // Empty body is fine — use defaults
    }

    // Fetch agent
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        strategy: true,
        riskParams: true,
        totalCapital: true,
        totalPnl: true,
        maxDrawdown: true,
        walletAddr: true,
        status: true,
        name: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: `Agent is not active (status: ${agent.status})` },
        { status: 400 }
      );
    }

    // Build agent context
    const riskParams = (agent.riskParams as Record<string, unknown>) || {};
    const agentContext: AgentContext = {
      id: agent.id,
      strategy: agent.strategy as StrategyType,
      riskLevel: (riskParams.riskLevel as RiskLevel) || 'medium',
      totalCapital: Number(agent.totalCapital) || 0,
      totalPnl: Number(agent.totalPnl) || 0,
      maxDrawdown: agent.maxDrawdown || 0,
      walletAddr: agent.walletAddr || undefined,
    };

    // Use provided tokens or defaults
    const tokenAddresses = tokens && tokens.length > 0
      ? tokens
      : getDefaultEvaluationTokens();

    // Run evaluation
    const result = await evaluateStrategy(agentContext, tokenAddresses, autoPropose);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        agentName: agent.name,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Evaluation failed';
    console.error('Strategy evaluation error:', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
