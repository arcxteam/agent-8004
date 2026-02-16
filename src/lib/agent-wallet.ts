/**
 * Agent Wallet — HD Wallet Derivation (BIP-32) for Per-Agent Isolation
 *
 * Each agent gets its own deterministic wallet derived from a master seed.
 * This replaces the single AGENT_PRIVATE_KEY for all agents.
 *
 * Design:
 * - Master seed: AGENT_MASTER_SEED env var (BIP-39 mnemonic, 12 or 24 words)
 * - Derivation path: m/44'/60'/0'/0/{walletIndex}
 * - walletIndex is stored in Prisma Agent.walletIndex (unique, auto-increment)
 * - Each derived wallet is a real on-chain address with its own balance
 *
 * Security:
 * - AGENT_MASTER_SEED is server-side only (never exposed to browser)
 * - Derived private keys exist only in server memory (cached Map)
 * - Deterministic: same seed + index = same wallet (recoverable)
 */

import { mnemonicToAccount } from 'viem/accounts';
import type { HDAccount } from 'viem/accounts';
import { prisma } from '@/lib/prisma';
import { privateKeyToAccount } from 'viem/accounts';

// Memory cache for derived wallets (avoid re-deriving on every call)
const walletCache = new Map<number, HDAccount>();

/**
 * Get the master mnemonic from environment
 * Throws if AGENT_MASTER_SEED is not configured
 */
function getMnemonic(): string {
  const seed = process.env.AGENT_MASTER_SEED;
  if (!seed) {
    throw new Error(
      'AGENT_MASTER_SEED not configured. Set a BIP-39 mnemonic in .env for HD wallet derivation.'
    );
  }
  return seed.trim();
}

/**
 * Derive an agent wallet from the master seed using BIP-32
 *
 * @param walletIndex - Unique index for this agent (stored in Agent.walletIndex)
 * @returns { account, address } - The derived account and its address
 */
export function getAgentWallet(walletIndex: number): { account: HDAccount; address: `0x${string}` } {
  // Return from cache if available
  const cached = walletCache.get(walletIndex);
  if (cached) {
    return { account: cached, address: cached.address };
  }

  const mnemonic = getMnemonic();

  // Derives m/44'/60'/0'/0/{walletIndex} via viem's addressIndex option
  const account = mnemonicToAccount(mnemonic, {
    addressIndex: walletIndex,
  });

  walletCache.set(walletIndex, account);
  return { account, address: account.address };
}

/**
 * Get the legacy system account (backward compatibility)
 * Used for agents created before HD wallet migration (walletIndex = null)
 *
 * Falls back to AGENT_PRIVATE_KEY if AGENT_MASTER_SEED not available
 */
export function getLegacySystemAccount() {
  // Try AGENT_PRIVATE_KEY first (backward compat)
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (privateKey) {
    return privateKeyToAccount(privateKey as `0x${string}`);
  }

  // Try deriving index 0 from master seed as system wallet
  try {
    const { account } = getAgentWallet(0);
    return account;
  } catch {
    throw new Error(
      'No wallet configured. Set AGENT_MASTER_SEED or AGENT_PRIVATE_KEY in .env'
    );
  }
}

/**
 * Get the account for a specific agent (by agentId)
 *
 * Queries Prisma for the agent's walletIndex, then derives the wallet.
 * Falls back to legacy system account if agent has no walletIndex.
 *
 * @param agentId - Prisma Agent.id
 * @returns The account (LocalAccount) for signing transactions
 */
export async function getAgentAccount(agentId?: string) {
  if (agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { walletIndex: true },
    });

    if (agent?.walletIndex !== null && agent?.walletIndex !== undefined) {
      return getAgentWallet(agent.walletIndex).account;
    }
  }

  // Fallback: legacy single wallet
  return getLegacySystemAccount();
}

/**
 * Generate the next available walletIndex for a new agent
 * Uses MAX(walletIndex) + 1 to ensure uniqueness
 */
export async function generateNextWalletIndex(): Promise<number> {
  const result = await prisma.agent.aggregate({
    _max: { walletIndex: true },
  });

  return (result._max.walletIndex ?? -1) + 1;
}

/**
 * Derive and return wallet address for a given index (without Prisma query)
 * Useful for previewing the address before creating the agent
 */
export function deriveWalletAddress(walletIndex: number): `0x${string}` {
  return getAgentWallet(walletIndex).address;
}

/**
 * Check if HD wallet derivation is available
 */
export function isHDWalletConfigured(): boolean {
  return !!process.env.AGENT_MASTER_SEED;
}

/**
 * Check if any wallet system is available (HD or legacy)
 */
export function isAnyWalletConfigured(): boolean {
  return !!(process.env.AGENT_MASTER_SEED || process.env.AGENT_PRIVATE_KEY);
}
