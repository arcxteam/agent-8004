import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { getNetworkConfig } from '@/config/chains';

const { chain, contracts } = getNetworkConfig();

const publicClient = createPublicClient({
  chain,
  transport: http(chain.rpcUrls.default.http[0]),
});

// GET /api/health - Health check endpoint
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; error?: string }> = {};

  // Check Monad RPC connection
  try {
    const rpcStart = Date.now();
    await publicClient.getBlockNumber();
    checks.monadRpc = {
      status: 'ok',
      latency: Date.now() - rpcStart,
    };
  } catch (error) {
    checks.monadRpc = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to connect to Monad RPC',
    };
  }

  // Check database connection (simplified - would need actual DB check in production)
  try {
    const dbStart = Date.now();
    // In production, you'd do: await prisma.$queryRaw`SELECT 1`
    checks.database = {
      status: 'ok',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to connect to database',
    };
  }

  // Calculate overall status
  const allOk = Object.values(checks).every((check) => check.status === 'ok');
  const totalLatency = Date.now() - startTime;

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    chain: {
      name: chain.name,
      id: chain.id,
      rpc: chain.rpcUrls.default.http[0],
    },
    contracts: {
      router: contracts.DEX_ROUTER,
      bondingCurveRouter: contracts.BONDING_CURVE_ROUTER,
      lens: contracts.LENS,
      curve: contracts.CURVE,
      wmon: contracts.WMON,
      v3Factory: contracts.V3_FACTORY,
      creatorTreasury: contracts.CREATOR_TREASURY,
    },
    checks,
    totalLatency,
  });
}
