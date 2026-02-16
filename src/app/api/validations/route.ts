/**
 * Validation Artifacts API
 *
 * Creates and retrieves ERC-8004 validation artifacts for trade executions.
 * Artifacts are hashed with keccak256, stored in Prisma, and optionally uploaded to R2.
 *
 * POST /api/validations — Create validation artifact from execution
 * GET  /api/validations — List validations per agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toHex } from 'viem';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/validations — Create a validation artifact
 *
 * Body: { executionId?, agentId, type?, data? }
 * - If executionId provided: creates artifact from execution record
 * - Otherwise: creates artifact from provided data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, agentId, type = 'trade-intent', data } = body as {
      executionId?: string;
      agentId: string;
      type?: string;
      data?: Record<string, unknown>;
    };

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId required' },
        { status: 400 }
      );
    }

    let artifactData: Record<string, unknown>;

    if (executionId) {
      // Build artifact from execution record
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
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

      if (!execution) {
        return NextResponse.json(
          { success: false, error: `Execution not found: ${executionId}` },
          { status: 404 }
        );
      }

      artifactData = {
        type: 'trade-execution',
        executionId: execution.id,
        agentId: execution.agentId,
        tradeType: execution.type,
        params: execution.params,
        result: execution.result,
        pnl: execution.pnl ? Number(execution.pnl) : null,
        txHash: execution.txHash,
        status: execution.status,
        executedAt: execution.executedAt.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        timestamp: Date.now(),
      };
    } else if (data) {
      artifactData = {
        type,
        agentId,
        ...data,
        timestamp: Date.now(),
      };
    } else {
      return NextResponse.json(
        { success: false, error: 'Either executionId or data required' },
        { status: 400 }
      );
    }

    // Hash the artifact
    const artifactJson = JSON.stringify(artifactData, null, 2);
    const requestHash = keccak256(toHex(artifactJson));

    // Check for duplicate
    const existing = await prisma.validation.findUnique({
      where: { requestHash },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        note: 'Validation artifact already exists',
      });
    }

    // Store in Prisma
    const validation = await prisma.validation.create({
      data: {
        agentId,
        requestHash,
        validatorAddr: agentId
          ? (await prisma.agent.findUnique({ where: { id: agentId }, select: { walletAddr: true } }))?.walletAddr || 'system'
          : 'system',
        requestUri: null,
        tag: type,
        score: artifactData.pnl != null && Number(artifactData.pnl) > 0 ? 80 : 50,
        status: 'validated',
        completedAt: new Date(),
      },
    });

    // Try to upload to R2 (non-blocking)
    uploadToR2(agentId, type, artifactData, validation.id).catch((err) =>
      console.warn('R2 upload failed (non-critical):', err)
    );

    return NextResponse.json({
      success: true,
      data: {
        id: validation.id,
        requestHash,
        agentId,
        tag: type,
        score: validation.score,
        status: validation.status,
        createdAt: validation.createdAt,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

/**
 * GET /api/validations — List validations
 *
 * Query: ?agentId=xxx&limit=20
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '20');

  const validations = await prisma.validation.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    select: {
      id: true,
      agentId: true,
      requestHash: true,
      validatorAddr: true,
      requestUri: true,
      responseUri: true,
      score: true,
      tag: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ success: true, data: validations });
}

/**
 * Upload validation artifact to R2 and update the record
 */
async function uploadToR2(
  agentId: string,
  artifactType: string,
  data: Record<string, unknown>,
  validationId: string
) {
  const { uploadValidationArtifact } = await import('@/lib/r2-storage');
  const { isR2Configured } = await import('@/lib/r2-storage');

  if (!isR2Configured()) return;

  const type = (artifactType === 'trade-execution' || artifactType === 'trade-intent' || artifactType === 'risk-check' || artifactType === 'strategy-checkpoint')
    ? artifactType as 'trade-intent' | 'risk-check' | 'strategy-checkpoint'
    : 'trade-intent';

  const { url } = await uploadValidationArtifact(agentId, type, data);

  // Update validation record with R2 URL
  await prisma.validation.update({
    where: { id: validationId },
    data: { requestUri: url },
  });
}
