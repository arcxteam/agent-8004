/**
 * Close Agent API
 *
 * POST /api/agents/[id]/close — Stop agent and calculate final PnL
 *
 * Body: { userAddress: string }
 * - Verifies ownership via userAddress matching agent's owner
 * - Sets agent status to STOPPED
 * - Calculates final PnL from all executions
 * - Returns agent wallet address for fund sweep
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { userAddress } = body as { userAddress?: string };

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

    // Check if already stopped
    if (agent.status === 'STOPPED') {
      return NextResponse.json(
        { success: false, error: 'Agent is already stopped' },
        { status: 400 }
      );
    }

    // Calculate final PnL from all executions
    const executionStats = await prisma.execution.aggregate({
      where: { agentId, status: 'SUCCESS' },
      _sum: { pnl: true },
      _count: true,
    });

    const failedCount = await prisma.execution.count({
      where: { agentId, status: 'FAILED' },
    });

    // Update agent status to STOPPED
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'STOPPED',
        isActive: false,
      },
    });

    // Settle all active delegations — mark as WITHDRAWN
    const settledResult = await prisma.delegation.updateMany({
      where: { agentId, status: 'ACTIVE' },
      data: { status: 'WITHDRAWN' },
    });

    // Fetch settled delegations with PnL for response
    const settledDelegations = await prisma.delegation.findMany({
      where: { agentId },
      select: {
        id: true,
        amount: true,
        accumulatedPnl: true,
        status: true,
        user: { select: { address: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId: updatedAgent.id,
        name: updatedAgent.name,
        status: updatedAgent.status,
        walletAddr: updatedAgent.walletAddr,
        finalStats: {
          totalPnl: updatedAgent.totalPnl ? Number(updatedAgent.totalPnl) : 0,
          totalCapital: updatedAgent.totalCapital ? Number(updatedAgent.totalCapital) : 0,
          totalTrades: executionStats._count,
          failedTrades: failedCount,
          executionPnlSum: executionStats._sum.pnl ? Number(executionStats._sum.pnl) : 0,
        },
        delegationsSettled: settledResult.count,
        delegations: settledDelegations.map((d) => ({
          id: d.id,
          delegator: d.user.address,
          amount: Number(d.amount),
          accumulatedPnl: Number(d.accumulatedPnl),
          status: d.status,
        })),
      },
    });
  } catch (error) {
    console.error('Error closing agent:', error);
    const msg = error instanceof Error ? error.message : 'Failed to close agent';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
