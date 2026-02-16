/**
 * Trade Judgement — OpenClaw-inspired Human-in-the-Loop Approval
 *
 * Implements the "judgement" pattern: agents propose trades, humans approve/reject.
 * This prevents autonomous agents from executing trades without oversight.
 *
 * Flow:
 * 1. Agent or A2A caller creates a trade proposal
 * 2. Proposal appears in dashboard for human review
 * 3. Human approves → trade executes via /api/trade
 * 4. Human rejects → proposal marked rejected with reason
 * 5. Proposal expires if not acted on within TTL
 */

import { prisma } from '@/lib/prisma';
import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getCurrentNetwork } from '@/lib/config';
import { getBaseUrl } from '@/lib/get-base-url';
import { getAgentAccount as getAgentWalletAccount } from '@/lib/agent-wallet';

// Default proposal TTL: 15 minutes
const DEFAULT_TTL_MS = 15 * 60 * 1000;

// EIP-712 domain for signed trade intents (dynamic chainId based on network)
const TRADE_INTENT_DOMAIN = {
  name: 'ANOA Trade Intent',
  version: '1',
  chainId: getCurrentNetwork() === 'mainnet' ? 143 : 10143,
} as const;

const TRADE_INTENT_TYPES = {
  TradeIntent: [
    { name: 'agentId', type: 'string' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'amount', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'slippageBps', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

// Incrementing nonce for EIP-712 signatures (resets on server restart)
let intentNonce = 0;

export interface CreateProposalParams {
  agentId: string;
  tokenAddress: string;
  amount: string;
  action: 'buy' | 'sell';
  slippageBps?: number;
  proposedBy?: string;
  ttlMs?: number;
  quoteData?: Record<string, unknown>;
}

export interface ApproveProposalParams {
  proposalId: string;
  approvedBy: string;
}

export interface RejectProposalParams {
  proposalId: string;
  reason: string;
}

/**
 * Create a new trade proposal (pending human approval)
 */
export async function createTradeProposal(params: CreateProposalParams) {
  const {
    agentId,
    tokenAddress,
    amount,
    action,
    slippageBps = 100,
    proposedBy,
    ttlMs = DEFAULT_TTL_MS,
    quoteData,
  } = params;

  // Validate action
  if (action !== 'buy' && action !== 'sell') {
    throw new Error('action must be "buy" or "sell"');
  }

  // Verify agent exists
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, status: true },
  });

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const expiresAt = new Date(Date.now() + ttlMs);

  // EIP-712: Sign trade intent using agent's HD-derived wallet
  let signedQuoteData = quoteData ? { ...quoteData } : {};

  try {
    const account = await getAgentWalletAccount(agentId);
    if (account) {
      const nonce = ++intentNonce;
      const expiresAtUnix = BigInt(Math.floor(expiresAt.getTime() / 1000));

      const message = {
        agentId,
        tokenAddress: tokenAddress as `0x${string}`,
        amount,
        action,
        slippageBps: BigInt(slippageBps),
        expiresAt: expiresAtUnix,
        nonce: BigInt(nonce),
      };

      const signature = await account.signTypedData({
        domain: TRADE_INTENT_DOMAIN,
        types: TRADE_INTENT_TYPES,
        primaryType: 'TradeIntent',
        message,
      });

      signedQuoteData = {
        ...signedQuoteData,
        eip712Signature: signature,
        eip712Signer: account.address,
        eip712Nonce: nonce,
        eip712ExpiresAt: Number(expiresAtUnix),
      };
    }
  } catch (err) {
    // EIP-712 signing failure is non-blocking — proposal still created
    console.warn('EIP-712 signing failed:', err instanceof Error ? err.message : err);
  }

  const proposal = await prisma.tradeProposal.create({
    data: {
      agentId,
      tokenAddress,
      amount,
      action,
      slippageBps,
      proposedBy: proposedBy || 'system',
      quoteData: Object.keys(signedQuoteData).length > 0
        ? JSON.parse(JSON.stringify(signedQuoteData))
        : undefined,
      expiresAt,
    },
  });

  return {
    id: proposal.id,
    agentId,
    agentName: agent.name,
    tokenAddress,
    amount,
    action,
    slippageBps,
    status: proposal.status,
    proposedBy: proposal.proposedBy,
    expiresAt: proposal.expiresAt.toISOString(),
    createdAt: proposal.createdAt.toISOString(),
  };
}

/**
 * Approve a trade proposal and trigger execution
 */
export async function approveTradeProposal(params: ApproveProposalParams) {
  const { proposalId, approvedBy } = params;

  const proposal = await prisma.tradeProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  if (proposal.status !== 'PENDING') {
    throw new Error(`Proposal is not pending (current: ${proposal.status})`);
  }

  if (new Date() > proposal.expiresAt) {
    // Auto-expire
    await prisma.tradeProposal.update({
      where: { id: proposalId },
      data: { status: 'EXPIRED' },
    });
    throw new Error('Proposal has expired');
  }

  // EIP-712: Verify signature if present
  const qd = (proposal.quoteData as Record<string, unknown>) || {};
  if (qd.eip712Signature && qd.eip712Signer) {
    try {
      const expiresAtUnix = BigInt(qd.eip712ExpiresAt as number);
      const nowUnix = BigInt(Math.floor(Date.now() / 1000));

      if (nowUnix > expiresAtUnix) {
        throw new Error('EIP-712 signed intent has expired');
      }

      const message = {
        agentId: proposal.agentId,
        tokenAddress: proposal.tokenAddress as `0x${string}`,
        amount: proposal.amount,
        action: proposal.action,
        slippageBps: BigInt(proposal.slippageBps),
        expiresAt: expiresAtUnix,
        nonce: BigInt(qd.eip712Nonce as number),
      };

      const valid = await verifyTypedData({
        address: qd.eip712Signer as `0x${string}`,
        domain: TRADE_INTENT_DOMAIN,
        types: TRADE_INTENT_TYPES,
        primaryType: 'TradeIntent',
        message,
        signature: qd.eip712Signature as `0x${string}`,
      });

      if (!valid) {
        await prisma.tradeProposal.update({
          where: { id: proposalId },
          data: { status: 'REJECTED', rejectedReason: 'EIP-712 signature verification failed' },
        });
        throw new Error('EIP-712 signature verification failed — proposal rejected');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('EIP-712')) throw err;
      console.warn('EIP-712 verification error:', err instanceof Error ? err.message : err);
    }
  }

  // Mark as approved
  await prisma.tradeProposal.update({
    where: { id: proposalId },
    data: {
      status: 'APPROVED',
      approvedBy,
    },
  });

  // Execute the trade via internal API call
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenAddress: proposal.tokenAddress,
        amount: proposal.amount,
        action: proposal.action,
        agentId: proposal.agentId,
        slippageBps: proposal.slippageBps,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();

    if (data.success) {
      await prisma.tradeProposal.update({
        where: { id: proposalId },
        data: {
          status: 'EXECUTED',
          executionId: data.data?.executionId || null,
        },
      });
      return { success: true, proposal: proposalId, execution: data.data };
    } else {
      // Trade failed but proposal was approved
      await prisma.tradeProposal.update({
        where: { id: proposalId },
        data: {
          status: 'APPROVED', // Keep approved, execution failed
          rejectedReason: `Execution failed: ${data.error}`,
        },
      });
      return { success: false, proposal: proposalId, error: data.error };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Execution failed';
    await prisma.tradeProposal.update({
      where: { id: proposalId },
      data: { rejectedReason: `Execution error: ${msg}` },
    });
    throw new Error(`Trade execution failed: ${msg}`);
  }
}

/**
 * Reject a trade proposal
 */
export async function rejectTradeProposal(params: RejectProposalParams) {
  const { proposalId, reason } = params;

  const proposal = await prisma.tradeProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  if (proposal.status !== 'PENDING') {
    throw new Error(`Proposal is not pending (current: ${proposal.status})`);
  }

  const updated = await prisma.tradeProposal.update({
    where: { id: proposalId },
    data: {
      status: 'REJECTED',
      rejectedReason: reason,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    rejectedReason: reason,
  };
}

/**
 * Get trade proposals for an agent
 */
export async function getTradeProposals(
  agentId?: string,
  status?: string,
  limit = 20
) {
  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
  if (status) where.status = status;

  const proposals = await prisma.tradeProposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      agent: {
        select: { id: true, name: true, strategy: true },
      },
    },
  });

  // Auto-expire old proposals
  const now = new Date();
  const expired = proposals.filter(
    (p) => p.status === 'PENDING' && p.expiresAt < now
  );
  if (expired.length > 0) {
    await prisma.tradeProposal.updateMany({
      where: { id: { in: expired.map((p) => p.id) } },
      data: { status: 'EXPIRED' },
    });
  }

  return proposals.map((p) => ({
    id: p.id,
    agentId: p.agentId,
    agentName: p.agent.name,
    agentStrategy: p.agent.strategy,
    tokenAddress: p.tokenAddress,
    amount: p.amount,
    action: p.action,
    slippageBps: p.slippageBps,
    status: expired.some((e) => e.id === p.id) ? 'EXPIRED' : p.status,
    proposedBy: p.proposedBy,
    approvedBy: p.approvedBy,
    rejectedReason: p.rejectedReason,
    executionId: p.executionId,
    expiresAt: p.expiresAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));
}
