/**
 * Cloudflare R2 Storage Service
 *
 * Handles agent metadata JSON upload to Cloudflare R2 (S3-compatible).
 * Replaces IPFS for metadata storage with a self-hosted solution.
 *
 * R2 is S3-compatible, so we use @aws-sdk/client-s3 to interact with it.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createAgentMetadataJson, type AgentMetadata } from './erc8004';

// R2 configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/**
 * Create S3 client configured for Cloudflare R2
 */
function createR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      'Cloudflare R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Generate a deterministic key for agent metadata
 * Format: agents/{chainId}/{ownerAddress}/{agentName-slug}.json
 */
function generateMetadataKey(
  agentName: string,
  ownerAddress: string,
  chainId: number
): string {
  const slug = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const timestamp = Date.now();
  return `agents/${chainId}/${ownerAddress.toLowerCase()}/${slug}-${timestamp}.json`;
}

/**
 * Get the public URL for a stored object
 */
function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  // Fallback: use R2.dev subdomain (must be enabled in Cloudflare dashboard)
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Upload agent metadata JSON to Cloudflare R2
 *
 * @param metadata - Agent metadata to upload
 * @param ownerAddress - Wallet address of the agent owner
 * @param chainId - Chain ID where agent is registered
 * @returns Public URL of the uploaded metadata
 */
export async function uploadAgentMetadata(
  metadata: AgentMetadata,
  ownerAddress: string,
  chainId: number
): Promise<{ url: string; key: string }> {
  const client = createR2Client();

  const metadataJson = createAgentMetadataJson(metadata);
  const key = generateMetadataKey(metadata.name, ownerAddress, chainId);
  const body = JSON.stringify(metadataJson, null, 2);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      // Cache for 1 year (immutable metadata)
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = getPublicUrl(key);

  return { url, key };
}

/**
 * Upload arbitrary JSON data to R2
 * Useful for validation artifacts, trade intents, feedback proofs
 */
export async function uploadJSON(
  data: Record<string, unknown>,
  path: string
): Promise<{ url: string; key: string }> {
  const client = createR2Client();
  const body = JSON.stringify(data, null, 2);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: path,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { url: getPublicUrl(path), key: path };
}

/**
 * Check if a metadata file exists in R2
 */
export async function metadataExists(key: string): Promise<boolean> {
  const client = createR2Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch metadata JSON from R2
 */
export async function getMetadata(key: string): Promise<Record<string, unknown> | null> {
  const client = createR2Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Upload agent avatar image to R2
 * Reads from local /public/agents/ directory and uploads to R2 for permanent storage.
 *
 * @param avatarNumber - Avatar number (1-100) matching /public/agents/agent-{n}.png
 * @param ownerAddress - Wallet address of the agent owner
 * @param chainId - Chain ID where agent is registered
 * @returns Public URL of the uploaded image
 */
export async function uploadAgentImage(
  avatarNumber: number,
  ownerAddress: string,
  chainId: number
): Promise<{ url: string; key: string }> {
  const client = createR2Client();
  const fs = await import('fs');
  const path = await import('path');

  // Read avatar from public directory
  const imagePath = path.join(process.cwd(), 'public', 'agents', `agent-${avatarNumber}.png`);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Avatar image not found: agent-${avatarNumber}.png`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const key = `agents/${chainId}/${ownerAddress.toLowerCase()}/avatar-${avatarNumber}.png`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { url: getPublicUrl(key), key };
}

/**
 * Upload feedback proof/artifact to R2
 * Used for reputation feedback URI field in ERC-8004 Reputation Registry
 */
export async function uploadFeedbackProof(
  agentId: string | number,
  feedbackData: {
    tradeHash?: string;
    pnl?: number;
    strategy?: string;
    timestamp: number;
    details?: Record<string, unknown>;
  }
): Promise<{ url: string; key: string }> {
  const key = `feedback/${agentId}/${feedbackData.timestamp}.json`;
  return uploadJSON(feedbackData as Record<string, unknown>, key);
}

/**
 * Upload validation artifact to R2
 * Used for trade intents, risk checks, strategy checkpoints
 */
export async function uploadValidationArtifact(
  agentId: string | number,
  artifactType: 'trade-intent' | 'risk-check' | 'strategy-checkpoint',
  data: Record<string, unknown>
): Promise<{ url: string; key: string }> {
  const timestamp = Date.now();
  const key = `validations/${agentId}/${artifactType}/${timestamp}.json`;
  return uploadJSON({ ...data, type: artifactType, timestamp }, key);
}
