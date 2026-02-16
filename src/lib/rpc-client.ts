/**
 * RPC Client with Timeout Protection
 *
 * Wraps Viem's publicClient with automatic timeout to prevent
 * indefinite hangs when RPC endpoints are slow or unresponsive.
 */

import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { RPC_TIMEOUT } from './config';

/**
 * Custom error for RPC timeouts
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if
 * the promise doesn't resolve within the specified time.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'RPC call'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Safe wrapper for RPC calls that returns a result object
 * instead of throwing errors.
 */
export async function safeRpcCall<T>(
  fn: () => Promise<T>,
  timeoutMs: number = RPC_TIMEOUT,
  label = 'RPC call'
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await withTimeout(fn(), timeoutMs, label);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof TimeoutError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown RPC error';
    console.error(`[RPC] ${label} failed:`, message);
    return { success: false, error: message };
  }
}

/**
 * Creates a Viem publicClient with timeout-enabled HTTP transport.
 * The timeout is applied at the transport level, so all RPC calls
 * through this client will automatically timeout.
 */
export function createTimeoutPublicClient(
  chain: Chain,
  rpcUrl: string,
  timeout: number = RPC_TIMEOUT
): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl, {
      timeout,
      retryCount: 2,
      retryDelay: 1000,
    }),
  });
}
