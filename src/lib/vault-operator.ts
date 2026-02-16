/**
 * Vault Operator Utility
 *
 * Server-side utility for recording PnL on-chain via the Capital Vault contract.
 * Uses an authorized operator wallet to sign transactions.
 *
 * Setup:
 * 1. Deploy vault contract
 * 2. Call vault.setOperator(operatorAddress, true) from owner
 * 3. Set VAULT_OPERATOR_PRIVATE_KEY in .env
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { HDAccount } from 'viem/accounts';
import { getRpcUrl, getCurrentNetwork } from '@/lib/config';
import { monadMainnet, monadTestnet } from '@/config/chains';
import { capitalVaultAbi } from '@/config/contracts';

function getChain() {
  return getCurrentNetwork() === 'mainnet' ? monadMainnet : monadTestnet;
}

function getOperatorAccount() {
  const key = process.env.VAULT_OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error('VAULT_OPERATOR_PRIVATE_KEY not configured');
  const prefixedKey = key.startsWith('0x') ? key : `0x${key}`;
  return privateKeyToAccount(prefixedKey as `0x${string}`);
}

function getVaultAddress(): `0x${string}` {
  const addr =
    process.env.NEXT_PUBLIC_CAPITAL_VAULT_MAINNET ||
    process.env.NEXT_PUBLIC_CAPITAL_VAULT_TESTNET;
  if (!addr) throw new Error('Capital vault address not configured');
  return addr as `0x${string}`;
}

/**
 * Record PnL on-chain for multiple delegations via batchRecordPnl.
 * Called by the server after calculating per-delegator PnL shares.
 *
 * @param delegationIds - On-chain delegation IDs (uint256)
 * @param pnlAmounts - PnL amounts in wei (int256, positive = profit, negative = loss)
 * @returns Transaction hash
 */
export async function recordPnlOnChain(
  delegationIds: bigint[],
  pnlAmounts: bigint[]
): Promise<`0x${string}`> {
  const chain = getChain();
  const account = getOperatorAccount();
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'batchRecordPnl',
    args: [delegationIds, pnlAmounts],
  });
}

/**
 * Deposit trading profits into vault so delegators can withdraw principal + PnL.
 * Called from the agent's wallet after a profitable trade.
 *
 * @param agentId - On-chain agent ID (uint256)
 * @param amount - Amount to deposit in wei
 * @param agentWalletAccount - Agent's HD wallet account (from agent-wallet.ts)
 * @returns Transaction hash
 */
export async function depositProfitsOnChain(
  agentId: bigint,
  amount: bigint,
  agentWalletAccount: HDAccount
): Promise<`0x${string}`> {
  const chain = getChain();
  const walletClient = createWalletClient({
    account: agentWalletAccount,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'depositProfits',
    args: [agentId],
    value: amount,
  });
}

/**
 * Record trading fee on-chain via vault.recordTradingFee().
 * Called by the operator after each successful trade to track protocol fees.
 *
 * @param agentId - On-chain agent ID (uint256)
 * @param tokenAddress - Token traded (address(0) for native MON)
 * @param tradeAmount - Trade amount in wei
 * @returns Transaction hash
 */
export async function recordTradingFeeOnChain(
  agentId: bigint,
  tokenAddress: `0x${string}`,
  tradeAmount: bigint
): Promise<`0x${string}`> {
  const chain = getChain();
  const account = getOperatorAccount();
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'recordTradingFee',
    args: [agentId, tokenAddress, tradeAmount],
  });
}

/**
 * Set the agent wallet address on the vault contract.
 * Called by operator after agent creation so vault knows where to send funds.
 *
 * @param agentId - On-chain agent ID (uint256)
 * @param walletAddress - Agent's HD wallet address
 * @returns Transaction hash
 */
export async function setAgentWalletOnVault(
  agentId: bigint,
  walletAddress: `0x${string}`
): Promise<`0x${string}`> {
  const chain = getChain();
  const account = getOperatorAccount();
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'setAgentWallet',
    args: [agentId, walletAddress],
  });
}

/**
 * Release delegated capital from vault to agent wallet for trading.
 * Called by operator after a new delegation is confirmed.
 *
 * @param agentId - On-chain agent ID (uint256)
 * @param amount - Amount to release in wei
 * @returns Transaction hash
 */
export async function releaseFundsToAgentOnChain(
  agentId: bigint,
  amount: bigint
): Promise<`0x${string}`> {
  const chain = getChain();
  const account = getOperatorAccount();
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'releaseFundsToAgent',
    args: [agentId, amount],
  });
}

/**
 * Return funds from agent wallet back to vault after trading.
 * Called from the agent's wallet account.
 *
 * @param agentId - On-chain agent ID (uint256)
 * @param amount - Amount to return in wei
 * @param agentWalletAccount - Agent's HD wallet account
 * @returns Transaction hash
 */
export async function returnFundsToVault(
  agentId: bigint,
  amount: bigint,
  agentWalletAccount: HDAccount
): Promise<`0x${string}`> {
  const chain = getChain();
  const walletClient = createWalletClient({
    account: agentWalletAccount,
    chain,
    transport: http(getRpcUrl()),
  });

  return walletClient.writeContract({
    address: getVaultAddress(),
    abi: capitalVaultAbi,
    functionName: 'returnFundsFromAgent',
    args: [agentId],
    value: amount,
  });
}
