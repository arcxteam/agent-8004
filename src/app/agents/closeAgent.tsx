'use client';

import * as React from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface CloseAgentModalProps {
  agentId: string;
  agentName: string;
  walletAddr: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CloseAgentModal({
  agentId,
  agentName,
  walletAddr,
  isOpen,
  onClose,
  onSuccess,
}: CloseAgentModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [isClosing, setIsClosing] = React.useState(false);
  const [isSweeping, setIsSweeping] = React.useState(false);
  const [agentBalance, setAgentBalance] = React.useState<bigint | null>(null);
  const [closeResult, setCloseResult] = React.useState<{ totalPnl: number; totalTrades: number } | null>(null);
  const [sweepResult, setSweepResult] = React.useState<{ amountSwept: string; txHash: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<'confirm' | 'result'>('confirm');

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setCloseResult(null);
      setSweepResult(null);
      setError(null);
    }
  }, [isOpen]);

  // Fetch agent on-chain balance
  React.useEffect(() => {
    if (!isOpen || !walletAddr || !publicClient) return;
    publicClient.getBalance({ address: walletAddr as `0x${string}` }).then(setAgentBalance).catch(() => setAgentBalance(null));
  }, [isOpen, walletAddr, publicClient]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = async () => {
    if (!address) return;
    setIsClosing(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to close agent');
      }

      setCloseResult({
        totalPnl: data.data.finalStats.totalPnl,
        totalTrades: data.data.finalStats.totalTrades,
      });
      setStep('result');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close agent');
    } finally {
      setIsClosing(false);
    }
  };

  const handleSweepFunds = async () => {
    if (!walletAddr || !address || !agentBalance || agentBalance === 0n) return;
    setIsSweeping(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Sweep failed');
      }

      setSweepResult({
        amountSwept: data.data.amountSwept,
        txHash: data.data.txHash,
      });
      setAgentBalance(0n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed');
    } finally {
      setIsSweeping(false);
    }
  };

  const truncateTx = (hash: string) => {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, type: 'spring', damping: 25 }}
        className="relative w-full max-w-md bg-[#1a1a2e] border border-purple-500/20 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden"
      >
        {/* Purple gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600" />

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'confirm' ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Stop Agent</h3>
                  <button
                    onClick={onClose}
                    className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-white/60 text-sm mb-6">
                  Are you sure you want to stop <span className="text-purple-300 font-medium">{agentName}</span>?
                  The agent will no longer execute trades.
                </p>

                {/* Agent Balance Info */}
                {walletAddr && (
                  <div className="bg-white/5 border border-purple-500/10 rounded-xl p-4 mb-6">
                    <div className="text-xs text-purple-300/60 mb-2">Agent Wallet</div>
                    <div className="text-xs text-white/60 font-mono break-all mb-2">{walletAddr}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Balance</span>
                      <span className="text-sm text-white font-medium">
                        {agentBalance !== null ? `${formatEther(agentBalance)} MON` : 'Loading...'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6">
                  <p className="text-xs text-amber-400">
                    After stopping, you can still view the agent&apos;s history and sweep remaining funds from the agent wallet.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClose}
                    disabled={isClosing}
                    className="flex-1 bg-red-500 hover:bg-red-600 border-0"
                  >
                    {isClosing ? 'Stopping...' : 'Stop Agent'}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Close button */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={onClose}
                    className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Stopped icon */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Agent Stopped</h3>
                  <p className="text-white/60 text-sm">
                    <span className="text-purple-300">{agentName}</span> has been stopped successfully.
                  </p>
                </div>

                {/* Stats */}
                {closeResult && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 border border-purple-500/10 rounded-xl p-3 text-center">
                      <div className="text-xs text-purple-300/60 mb-1">Total PnL</div>
                      <div className={`text-lg font-bold ${closeResult.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {closeResult.totalPnl >= 0 ? '+' : ''}{closeResult.totalPnl.toFixed(2)} USD
                      </div>
                    </div>
                    <div className="bg-white/5 border border-purple-500/10 rounded-xl p-3 text-center">
                      <div className="text-xs text-purple-300/60 mb-1">Total Trades</div>
                      <div className="text-lg font-bold text-white">{closeResult.totalTrades}</div>
                    </div>
                  </div>
                )}

                {/* Sweep funds section */}
                {walletAddr && agentBalance && agentBalance > 0n && !sweepResult && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
                    <div className="text-sm text-purple-300 font-medium mb-1">Remaining Balance</div>
                    <div className="text-lg font-bold text-white mb-2">{formatEther(agentBalance)} MON</div>
                    <p className="text-xs text-white/40 mb-3">
                      Sweep remaining funds from the agent wallet back to your personal wallet.
                    </p>
                    <Button
                      onClick={handleSweepFunds}
                      disabled={isSweeping}
                      className="w-full bg-purple-600 hover:bg-purple-700 border-0 text-white"
                    >
                      {isSweeping ? 'Sweeping...' : `Sweep ${formatEther(agentBalance)} MON to my wallet`}
                    </Button>
                  </div>
                )}

                {/* Sweep success */}
                {sweepResult && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-emerald-400 font-medium">Funds Swept Successfully</span>
                    </div>
                    <div className="text-lg font-bold text-white mb-3">{sweepResult.amountSwept} MON</div>
                    <a
                      href={`https://monadscan.com/tx/${sweepResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-mono bg-purple-500/10 px-3 py-1.5 rounded-lg"
                    >
                      TX: {truncateTx(sweepResult.txHash)}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={onClose}
                  className="w-full bg-purple-600 hover:bg-purple-700 border-0 text-white"
                >
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
