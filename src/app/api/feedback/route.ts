import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/feedback - Get feedback for an agent
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: agentId' },
        { status: 400 }
      );
    }

    const [feedbacks, total, stats] = await Promise.all([
      prisma.feedback.findMany({
        where: { agentId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedback.count({ where: { agentId } }),
      prisma.feedback.aggregate({
        where: { agentId },
        _avg: { score: true },
        _count: true,
      }),
    ]);

    // Score distribution
    const scoreDistribution = await prisma.feedback.groupBy({
      by: ['score'],
      where: { agentId },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          averageScore: stats._avg.score || 0,
          totalFeedbacks: stats._count,
          distribution: Object.fromEntries(
            scoreDistribution.map((d) => [d.score, d._count])
          ),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit feedback for an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, clientAddr, score, tag1, tag2, fileUri, fileHash, txHash } = body;

    // Validate required fields
    if (!agentId || !clientAddr || score === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: agentId, clientAddr, score' },
        { status: 400 }
      );
    }

    // Validate score range (0-100)
    if (score < 0 || score > 100) {
      return NextResponse.json(
        { success: false, error: 'Score must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if client has already submitted feedback for this agent
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        agentId,
        clientAddr: clientAddr.toLowerCase(),
      },
    });

    let feedback;
    if (existingFeedback) {
      // Update existing feedback
      feedback = await prisma.feedback.update({
        where: { id: existingFeedback.id },
        data: {
          score,
          tag1,
          tag2,
          fileUri,
          fileHash,
          txHash,
        },
      });
    } else {
      // Create new feedback
      feedback = await prisma.feedback.create({
        data: {
          agentId,
          clientAddr: clientAddr.toLowerCase(),
          score,
          tag1,
          tag2,
          fileUri,
          fileHash,
          txHash,
        },
      });
    }

    // Recalculate agent trust score based on all feedback
    const allFeedback = await prisma.feedback.aggregate({
      where: { agentId },
      _avg: { score: true },
      _count: true,
    });

    // Update agent trust score
    const feedbackScore = allFeedback._avg.score || 50;
    const feedbackWeight = Math.min(allFeedback._count / 10, 1);
    
    const newTrustScore = Math.round(
      (agent.trustScore * (1 - feedbackWeight * 0.3)) + (feedbackScore * feedbackWeight * 0.3)
    );

    await prisma.agent.update({
      where: { id: agentId },
      data: { trustScore: Math.min(100, Math.max(0, newTrustScore)) },
    });

    return NextResponse.json({
      success: true,
      data: {
        feedback,
        updated: !!existingFeedback,
        newTrustScore,
      },
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
