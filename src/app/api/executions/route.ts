import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ExecutionStatus, ExecutionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Convert BigInt fields to string for JSON serialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}

// GET /api/executions - Get executions for an agent or user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const userAddress = searchParams.get('userAddress');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: Prisma.ExecutionWhereInput = {};
    
    if (agentId) {
      where.agentId = agentId;
    }
    
    if (userAddress) {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() },
      });
      if (user) {
        where.agent = { userId: user.id };
      }
    }
    
    if (status && status !== 'all') {
      where.status = status.toUpperCase() as ExecutionStatus;
    }
    
    if (type && type !== 'all') {
      where.type = type.toUpperCase() as ExecutionType;
    }

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { executedAt: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              strategy: true,
            },
          },
        },
      }),
      prisma.execution.count({ where }),
    ]);

    // Calculate stats for the filtered executions
    const stats = await prisma.execution.aggregate({
      where,
      _sum: {
        pnl: true,
      },
      _count: true,
    });

    // Success rate
    const successCount = await prisma.execution.count({
      where: {
        ...where,
        status: 'SUCCESS',
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt({
        executions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalExecutions: stats._count,
          totalPnl: stats._sum.pnl || 0,
          successRate: total > 0 ? (successCount / total) * 100 : 0,
        },
      }),
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}

// POST /api/executions - Record a new execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      type,
      params,
      result,
      txHash,
      status = 'PENDING',
      pnl,
      gasUsed,
      errorMsg,
    } = body;

    // Validate required fields
    if (!agentId || !type || !params) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: agentId, type, params' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        agentId,
        type,
        params,
        result,
        txHash,
        status,
        pnl,
        gasUsed: gasUsed ? BigInt(gasUsed) : null,
        errorMsg,
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(execution),
    });
  } catch (error) {
    console.error('Error creating execution:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create execution' },
      { status: 500 }
    );
  }
}

// PATCH /api/executions - Update execution status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, status, result, pnl, errorMsg } = body;

    if (!executionId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: executionId, status' },
        { status: 400 }
      );
    }

    // Find execution
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: { agent: true },
    });

    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Update execution
    const updated = await prisma.execution.update({
      where: { id: executionId },
      data: {
        status,
        result,
        pnl,
        errorMsg,
        completedAt: ['SUCCESS', 'FAILED'].includes(status) ? new Date() : undefined,
      },
    });

    // Update agent stats if successful trade
    if (status === 'SUCCESS' && pnl !== undefined) {
      await prisma.agent.update({
        where: { id: execution.agentId },
        data: {
          totalPnl: { increment: pnl },
          totalTrades: { increment: 1 },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updated),
    });
  } catch (error) {
    console.error('Error updating execution:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update execution' },
      { status: 500 }
    );
  }
}
