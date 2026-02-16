/**
 * Trade Proposals API — OpenClaw Judgement Pattern
 *
 * Human-in-the-loop approval workflow for agent trades.
 *
 * POST   /api/trade/proposals — Create a new trade proposal
 * GET    /api/trade/proposals — List proposals (optional: ?agentId=&status=&limit=)
 * PATCH  /api/trade/proposals — Approve or reject a proposal
 *
 * Flow: Agent proposes → Human reviews → Approve (→ execute) or Reject
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createTradeProposal,
  approveTradeProposal,
  rejectTradeProposal,
  getTradeProposals,
} from '@/lib/trade-judgement';

/**
 * POST /api/trade/proposals — Create trade proposal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, tokenAddress, amount, action, slippageBps, proposedBy } = body as {
      agentId?: string;
      tokenAddress?: string;
      amount?: string;
      action?: 'buy' | 'sell';
      slippageBps?: number;
      proposedBy?: string;
    };

    if (!agentId || !tokenAddress || !amount || !action) {
      return NextResponse.json(
        { success: false, error: 'agentId, tokenAddress, amount, and action required' },
        { status: 400 }
      );
    }

    const proposal = await createTradeProposal({
      agentId,
      tokenAddress,
      amount,
      action,
      slippageBps,
      proposedBy,
    });

    return NextResponse.json({ success: true, data: proposal });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create proposal';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

/**
 * GET /api/trade/proposals — List proposals
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agentId') || undefined;
  const status = searchParams.get('status') || undefined;
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    const proposals = await getTradeProposals(agentId, status, limit);
    return NextResponse.json({ success: true, data: proposals });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list proposals';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/trade/proposals — Approve or reject a proposal
 *
 * Body: { proposalId, decision: "approve" | "reject", approvedBy?, reason? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, decision, approvedBy, reason } = body as {
      proposalId?: string;
      decision?: 'approve' | 'reject';
      approvedBy?: string;
      reason?: string;
    };

    if (!proposalId || !decision) {
      return NextResponse.json(
        { success: false, error: 'proposalId and decision (approve/reject) required' },
        { status: 400 }
      );
    }

    if (decision === 'approve') {
      if (!approvedBy) {
        return NextResponse.json(
          { success: false, error: 'approvedBy (wallet address) required for approval' },
          { status: 400 }
        );
      }
      const result = await approveTradeProposal({ proposalId, approvedBy });
      return NextResponse.json({ success: true, data: result });
    } else if (decision === 'reject') {
      const result = await rejectTradeProposal({
        proposalId,
        reason: reason || 'Rejected by human reviewer',
      });
      return NextResponse.json({ success: true, data: result });
    } else {
      return NextResponse.json(
        { success: false, error: 'decision must be "approve" or "reject"' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to process proposal';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
