/**
 * Agent Metadata Upload API
 *
 * POST /api/metadata - Upload agent metadata JSON to Cloudflare R2
 *
 * This endpoint is server-side only to keep R2 credentials secure.
 * The client sends agent metadata, and this route uploads it to R2
 * and returns the public URL to use as tokenURI for ERC-8004 registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadAgentMetadata,
  uploadAgentImage,
  uploadFeedbackProof,
  uploadValidationArtifact,
  isR2Configured,
} from '@/lib/r2-storage';
import type { AgentMetadata } from '@/lib/erc8004';

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Storage not configured. Set R2 credentials in .env',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { type = 'agent-metadata', ...data } = body;

    switch (type) {
      case 'agent-metadata': {
        const { name, description, image, avatarNumber, ownerAddress, chainId, ...rest } = data;

        if (!name || !ownerAddress || !chainId) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: name, ownerAddress, chainId' },
            { status: 400 }
          );
        }

        // Upload avatar image to R2 if avatarNumber provided
        let imageUrl = image || '';
        if (avatarNumber && typeof avatarNumber === 'number') {
          try {
            const imageResult = await uploadAgentImage(avatarNumber, ownerAddress, chainId);
            imageUrl = imageResult.url;
          } catch (imgErr) {
            console.warn('Avatar upload failed, using provided image URL:', imgErr);
          }
        }

        const metadata: AgentMetadata = {
          name,
          description: description || '',
          image: imageUrl,
          ...rest,
        };

        const result = await uploadAgentMetadata(metadata, ownerAddress, chainId);

        return NextResponse.json({
          success: true,
          data: {
            url: result.url,
            key: result.key,
            imageUrl,
          },
        });
      }

      case 'feedback-proof': {
        const { agentId, ...feedbackData } = data;
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: agentId' },
            { status: 400 }
          );
        }

        const result = await uploadFeedbackProof(agentId, {
          ...feedbackData,
          timestamp: feedbackData.timestamp || Date.now(),
        });

        return NextResponse.json({ success: true, data: result });
      }

      case 'validation-artifact': {
        const { agentId, artifactType, ...artifactData } = data;
        if (!agentId || !artifactType) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields: agentId, artifactType' },
            { status: 400 }
          );
        }

        const result = await uploadValidationArtifact(agentId, artifactType, artifactData);

        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Metadata upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}
