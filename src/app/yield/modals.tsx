'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import {
  Wallet,
  Clock,
  Zap,
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Layers,
  Pyramid,
  Gift,
  Info,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Card, Input, Badge, Modal } from '@/components/ui';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import {
  useDepositMon,
  useDepositAusd,
  useApproveAusd,
  useAusdAllowance,
  useMonBalance,
  useAusdBalance,
  useAprMonBalance,
  useEarnAusdBalance,
  useYieldTransactionReceipt,
  useUsdcBalance,
  useUsdcAllowance,
  useApproveUsdc,
  useDepositUsdc,
  useInstantRedeemAusd,
  useRequestRedeemAprMon,
  useRequestRedeemAusd,
  useEarnAusdAllowance,
  useApproveEarnAusd,
  useAprMonWithdrawalRequests,
  useRedeemAprMon,
} from '@/hooks/useYield';
import { useTokenPrice } from '@/hooks/useTokenPrices';
import { YIELD_CONTRACTS } from '@/config/contracts';
import type { YieldStrategy } from './types';
import { tokenLogos, strategyIcons } from './types';
import { RiskBadge } from './components';

// Deposit Modal
export function DepositModal({
  isOpen,
  onClose,
  strategy,
}: {
  isOpen: boolean;
  onClose: () => void;
  strategy: YieldStrategy | null;
}) {
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState(strategy?.tokens[0] || 'MON');
  const [depositStep, setDepositStep] = useState<'input' | 'approving' | 'depositing' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wallet connection
  const { address, isConnected } = useAccount();

  // Balance hooks
  const { data: monBalance } = useMonBalance(address);
  const { data: ausdBalance } = useAusdBalance(address);
  const { data: usdcBalance } = useUsdcBalance(address);
  const { data: ausdAllowance, refetch: refetchAllowance } = useAusdAllowance(address);
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useUsdcAllowance(address);

  // Contract interaction hooks
  const { depositMon, isPending: isDepositingMon, isSuccess: monDepositSuccess, txHash: monTxHash, error: monError, reset: resetMon } = useDepositMon();
  const { approve, isPending: isApproving, isSuccess: approveSuccess, txHash: approveTxHash, error: approveError, reset: resetApprove } = useApproveAusd();
  const { depositAusd, isPending: isDepositingAusd, isSuccess: ausdDepositSuccess, txHash: ausdTxHash, error: ausdError, reset: resetAusd } = useDepositAusd();
  const { approve: approveUsdc, isPending: isApprovingUsdc, isSuccess: usdcApproveSuccess, txHash: usdcApproveTxHash, error: usdcApproveError, reset: resetApproveUsdc } = useApproveUsdc();
  const { depositUsdc, isPending: isDepositingUsdc, isSuccess: usdcDepositSuccess, txHash: usdcTxHash, error: usdcError, reset: resetUsdc } = useDepositUsdc();

  // Transaction receipts
  const { isSuccess: monConfirmed } = useYieldTransactionReceipt(monTxHash);
  const { isSuccess: approveConfirmed } = useYieldTransactionReceipt(approveTxHash);
  const { isSuccess: ausdConfirmed } = useYieldTransactionReceipt(ausdTxHash);
  const { isSuccess: usdcApproveConfirmed } = useYieldTransactionReceipt(usdcApproveTxHash);
  const { isSuccess: usdcConfirmed } = useYieldTransactionReceipt(usdcTxHash);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDepositStep('input');
      setErrorMessage(null);
      setSelectedToken(strategy?.tokens[0] || 'MON');
      resetMon();
      resetApprove();
      resetAusd();
      resetApproveUsdc();
      resetUsdc();
    }
  }, [isOpen, strategy, resetMon, resetApprove, resetAusd, resetApproveUsdc, resetUsdc]);

  // Monitor mon deposit success
  useEffect(() => {
    if (monConfirmed && depositStep === 'depositing') {
      setDepositStep('success');
    }
  }, [monConfirmed, depositStep]);

  // Monitor approval success and proceed to deposit (aUSD)
  useEffect(() => {
    if (approveConfirmed && depositStep === 'approving' && selectedToken === 'aUSD') {
      refetchAllowance();
      handleAusdDeposit();
    }
  }, [approveConfirmed, depositStep, selectedToken]);

  // Monitor approval success and proceed to deposit (USDC)
  useEffect(() => {
    if (usdcApproveConfirmed && depositStep === 'approving' && selectedToken === 'USDC') {
      refetchUsdcAllowance();
      handleUsdcDeposit();
    }
  }, [usdcApproveConfirmed, depositStep, selectedToken]);

  // Monitor ausd deposit success
  useEffect(() => {
    if (ausdConfirmed && depositStep === 'depositing') {
      setDepositStep('success');
    }
  }, [ausdConfirmed, depositStep]);

  // Monitor usdc deposit success
  useEffect(() => {
    if (usdcConfirmed && depositStep === 'depositing') {
      setDepositStep('success');
    }
  }, [usdcConfirmed, depositStep]);

  // Handle errors
  useEffect(() => {
    const error = monError || approveError || ausdError || usdcApproveError || usdcError;
    if (error) {
      setDepositStep('error');
      setErrorMessage(error.message || 'Transaction failed');
    }
  }, [monError, approveError, ausdError, usdcApproveError, usdcError]);

  if (!strategy) return null;

  const projectedEarnings = parseFloat(amount || '0') * (strategy.apy / 100);

  // Get available balance for selected token
  const getAvailableBalance = () => {
    if (!isConnected) return '0';
    if (selectedToken === 'MON' && monBalance) {
      return formatEther(monBalance.value);
    }
    if (selectedToken === 'aUSD' && ausdBalance) {
      return formatUnits(ausdBalance, 6);
    }
    if (selectedToken === 'USDC' && usdcBalance) {
      return formatUnits(usdcBalance, 6);
    }
    return '0';
  };

  // Handle MAX button
  const handleMax = () => {
    setAmount(getAvailableBalance());
  };

  // Handle deposit for aprMON (MON staking)
  const handleMonDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      setDepositStep('depositing');
      const amountWei = parseEther(amount);
      await depositMon(amountWei);
    } catch (err) {
      console.error('MON deposit error:', err);
      setDepositStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Deposit failed');
    }
  };

  // Handle deposit for earnAUSD (aUSD)
  const handleAusdDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      setDepositStep('depositing');
      const amountUnits = parseUnits(amount, 6);
      await depositAusd(amountUnits);
    } catch (err) {
      console.error('aUSD deposit error:', err);
      setDepositStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Deposit failed');
    }
  };

  // Handle deposit for earnAUSD (USDC)
  const handleUsdcDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      setDepositStep('depositing');
      const amountUnits = parseUnits(amount, 6);
      await depositUsdc(amountUnits);
    } catch (err) {
      console.error('USDC deposit error:', err);
      setDepositStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Deposit failed');
    }
  };

  // Main deposit handler
  const handleDeposit = async () => {
    if (!isConnected) {
      setErrorMessage('Please connect your wallet first');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    setErrorMessage(null);

    // aprMON strategy - deposit MON directly
    if (strategy.id === 'mon-staking' && (selectedToken === 'MON' || selectedToken === 'aprMON')) {
      if (selectedToken === 'aprMON') {
        setErrorMessage('Cannot deposit aprMON. Please select MON to stake.');
        return;
      }
      await handleMonDeposit();
      return;
    }

    // earnAUSD strategy - check approval first (aUSD)
    if (strategy.id === 'upshift-ausd' && selectedToken === 'aUSD') {
      const amountUnits = parseUnits(amount, 6);
      const currentAllowance = ausdAllowance || BigInt(0);

      if (currentAllowance < amountUnits) {
        // Need approval first
        try {
          setDepositStep('approving');
          await approve(amountUnits);
        } catch (err) {
          console.error('Approval error:', err);
          setDepositStep('error');
          setErrorMessage(err instanceof Error ? err.message : 'Approval failed');
        }
      } else {
        // Already approved, proceed to deposit
        await handleAusdDeposit();
      }
      return;
    }

    // earnAUSD strategy - check approval first (USDC)
    if (strategy.id === 'upshift-ausd' && selectedToken === 'USDC') {
      const amountUnits = parseUnits(amount, 6);
      const currentAllowance = usdcAllowance || BigInt(0);

      if (currentAllowance < amountUnits) {
        // Need USDC approval first
        try {
          setDepositStep('approving');
          await approveUsdc(amountUnits);
        } catch (err) {
          console.error('USDC Approval error:', err);
          setDepositStep('error');
          setErrorMessage(err instanceof Error ? err.message : 'Approval failed');
        }
      } else {
        // Already approved, proceed to deposit
        await handleUsdcDeposit();
      }
      return;
    }

    // Other strategies - coming soon
    setErrorMessage('This strategy is coming soon');
  };

  const finalTxHash = monTxHash || ausdTxHash || usdcTxHash;
  const isProcessing = isDepositingMon || isApproving || isDepositingAusd || isApprovingUsdc || isDepositingUsdc || depositStep === 'approving' || depositStep === 'depositing';

  // Render different states
  const renderContent = () => {
    // Success state
    if (depositStep === 'success') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Deposit Successful!</h3>
          <p className="text-muted-foreground mb-4">
            Your {amount} {selectedToken} has been deposited to {strategy.name}
          </p>
          {finalTxHash && (
            <a
              href={`https://monadscan.com/tx/${finalTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-primary hover:underline"
            >
              View on Explorer <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="mt-6 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Done
          </button>
        </div>
      );
    }

    // Error state
    if (depositStep === 'error') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Transaction Failed</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {errorMessage || 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={() => {
              setDepositStep('input');
              setErrorMessage(null);
              resetMon();
              resetApprove();
              resetAusd();
              resetApproveUsdc();
              resetUsdc();
            }}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Try Again
          </button>
        </div>
      );
    }

    // Processing/Confirming state
    if (isProcessing) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-primary/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {depositStep === 'approving' ? 'Approving Token...' : 'Processing Deposit...'}
          </h3>
          <p className="text-muted-foreground">
            {depositStep === 'approving'
              ? 'Please confirm the approval in your wallet'
              : 'Please confirm the transaction in your wallet'}
          </p>
          {(approveTxHash || finalTxHash) && (
            <p className="text-xs text-muted-foreground mt-4">
              Waiting for confirmation...
            </p>
          )}
        </div>
      );
    }

    // Input state (default)
    return (
      <div className="space-y-4">
        {/* Modal Title */}
        <h2 className="text-xl font-bold text-foreground">
          Deposit to {strategy.name}
        </h2>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm text-warning">
              Please connect your wallet to deposit
            </p>
          </div>
        )}

        {/* Strategy Summary */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center">
            {strategyIcons[strategy.id] || <Layers className="w-6 h-6 text-brand-primary" />}
          </div>
          <div>
            <p className="font-semibold text-foreground">{strategy.name}</p>
            <div className="flex items-center gap-2">
              <span className="text-success font-bold">{formatPercentage(strategy.apy)} APY</span>
              <RiskBadge risk={strategy.risk} />
            </div>
          </div>
        </div>

        {/* Token Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Select Token</label>
          <div className="flex gap-2">
            {strategy.tokens.filter(t => t !== 'aprMON' && t !== 'earnAUSD').map((token) => (
              <button
                key={token}
                onClick={() => setSelectedToken(token)}
                className={cn(
                  'px-4 py-2 rounded-lg border transition-all flex items-center gap-2',
                  selectedToken === token
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                    : 'border-border hover:border-purple-500/50 hover:bg-purple-500/10'
                )}
              >
                {tokenLogos[token] && (
                  <Image src={tokenLogos[token]} alt={token} width={20} height={20} className="rounded-full" />
                )}
                {token}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Amount</label>
          <Input
            type="number"
            placeholder={`Enter amount of ${selectedToken}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            suffix={
              <button
                onClick={handleMax}
                className="text-brand-primary text-sm font-medium hover:underline"
              >
                MAX
              </button>
            }
          />
          <p className="text-sm text-muted-foreground mt-1">
            Available: {parseFloat(getAvailableBalance()).toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedToken}
          </p>
        </div>

        {/* Projected Earnings */}
        <Card variant="glass" className="p-4">
          <h4 className="font-semibold text-foreground mb-3">Projected Earnings</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Principal</span>
              <span className="text-foreground">{formatCurrency(parseFloat(amount || '0'))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">APY</span>
              <span className="text-success">{formatPercentage(strategy.apy)}</span>
            </div>
            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-medium text-foreground">Est. Annual Earnings</span>
                <span className="font-bold text-success">+{formatCurrency(projectedEarnings)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Contract Address Info */}
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
          <p className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Contract: {strategy.id === 'mon-staking' ? YIELD_CONTRACTS.APRMON : YIELD_CONTRACTS.UPSHIFT_VAULT}
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Lock Period Warning */}
        {strategy.lockPeriod && strategy.lockPeriod !== 'No Lockup' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm text-warning">
              Funds will be locked for {strategy.lockPeriod}. Early withdrawal may incur penalties.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300"
          >
            <span className="bg-gradient-to-r from-purple-300 to-purple-400 font-semibold bg-clip-text text-transparent">
              Cancel
            </span>
          </button>
          <button
            onClick={handleDeposit}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg transition-all duration-300 font-semibold flex items-center justify-center gap-2",
              (!isConnected || !amount || parseFloat(amount) <= 0)
                ? "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] text-white"
            )}
            disabled={!isConnected || !amount || parseFloat(amount) <= 0}
          >
            {tokenLogos[selectedToken] && (
              <Image src={tokenLogos[selectedToken]} alt={selectedToken} width={18} height={18} className="rounded-full" />
            )}
            {!isConnected ? 'Connect Wallet' : `Deposit ${selectedToken}`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      {renderContent()}
    </Modal>
  );
}

// User Positions Modal - shows on-chain positions with withdraw options
export function UserPositionsModal({
  isOpen,
  onClose,
  onWithdraw,
  strategies,
}: {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (type: 'aprMON' | 'earnAUSD') => void;
  strategies: YieldStrategy[];
}) {
  const { address, isConnected } = useAccount();

  // Fetch user's yield token balances (positions)
  const { data: aprMonBalance, refetch: refetchAprMon } = useAprMonBalance(address);
  const { data: earnAusdBalance, refetch: refetchEarnAusd } = useEarnAusdBalance(address);

  // Get real MON price from CoinGecko
  const { price: monPriceData } = useTokenPrice('MON');
  const monPriceUsd = monPriceData?.priceUsd || 0;

  // Calculate values
  const aprMonValue = aprMonBalance ? parseFloat(formatEther(aprMonBalance)) : 0;
  const earnAusdValue = earnAusdBalance ? parseFloat(formatUnits(earnAusdBalance, 6)) : 0;

  const handleRefresh = () => {
    refetchAprMon();
    refetchEarnAusd();
  };

  if (!isConnected) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold text-foreground mb-2">Connect Wallet</h3>
          <p className="text-muted-foreground">Connect your wallet to view positions</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">My Positions</h2>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {aprMonValue === 0 && earnAusdValue === 0 ? (
          <div className="text-center py-8">
            <Pyramid className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Positions Yet</h3>
            <p className="text-muted-foreground text-sm">Deposit to start earning yield</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* aprMON Position */}
            {aprMonValue > 0 && (
              <Card variant="glass" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Image src="/icons/aprmon.png" alt="aprMON" width={40} height={40} className="rounded-lg" />
                    <div>
                      <h4 className="font-semibold text-foreground">aprMON</h4>
                      <p className="text-sm text-muted-foreground">aPriori Liquid Staking</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    +{formatPercentage(strategies.find(s => s.id === 'mon-staking')?.apy ?? 0)} APY
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-semibold text-foreground">{aprMonValue.toFixed(6)} aprMON</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="font-semibold text-foreground">{formatCurrency(aprMonValue * monPriceUsd)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onWithdraw('aprMON')}
                  className="w-full px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300"
                >
                  <span className="bg-gradient-to-r from-purple-300 to-purple-400 font-semibold bg-clip-text text-transparent">
                    Withdraw
                  </span>
                </button>
              </Card>
            )}

            {/* earnAUSD Position */}
            {earnAusdValue > 0 && (
              <Card variant="glass" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Image src="/icons/earnAUSD-monad.png" alt="earnAUSD" width={40} height={40} className="rounded-lg" />
                    <div>
                      <h4 className="font-semibold text-foreground">earnAUSD</h4>
                      <p className="text-sm text-muted-foreground">Upshift Liquid Yield</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    +{formatPercentage(strategies.find(s => s.id === 'upshift-ausd')?.apy ?? 0)} APY
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-semibold text-foreground">{earnAusdValue.toFixed(6)} earnAUSD</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="font-semibold text-foreground">{formatCurrency(earnAusdValue)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onWithdraw('earnAUSD')}
                  className="w-full px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300"
                >
                  <span className="bg-gradient-to-r from-purple-300 to-purple-400 font-semibold bg-clip-text text-transparent">
                    Withdraw
                  </span>
                </button>
              </Card>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// Withdraw Modal
export function WithdrawModal({
  isOpen,
  onClose,
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: 'aprMON' | 'earnAUSD';
}) {
  const [amount, setAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<'input' | 'approving' | 'processing' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redeemType, setRedeemType] = useState<'instant' | 'delayed'>('instant');

  const { address, isConnected } = useAccount();

  // Balance hooks
  const { data: aprMonBalance } = useAprMonBalance(address);
  const { data: earnAusdBalance } = useEarnAusdBalance(address);

  // Allowance hook for earnAUSD (required for withdraw)
  const { data: earnAusdAllowance, refetch: refetchAllowance } = useEarnAusdAllowance(address);

  // Approval hook for earnAUSD
  const { approve: approveEarnAusd, isPending: isApproving, isSuccess: approveSuccess, txHash: approveTxHash, error: approveError, reset: resetApprove } = useApproveEarnAusd();

  // Withdraw hooks
  const { instantRedeem, isPending: isInstantRedeeming, txHash: instantTxHash, error: instantError, reset: resetInstant } = useInstantRedeemAusd();
  const { requestRedeem: requestAusdRedeem, isPending: isRequestingAusd, txHash: ausdRequestTxHash, error: ausdRequestError, reset: resetAusdRequest } = useRequestRedeemAusd();
  const { requestRedeem: requestAprMonRedeem, isPending: isRequestingAprMon, txHash: aprMonTxHash, error: aprMonError, reset: resetAprMon } = useRequestRedeemAprMon();

  // Transaction receipts
  const { isSuccess: approveConfirmed } = useYieldTransactionReceipt(approveTxHash);
  const { isSuccess: instantConfirmed } = useYieldTransactionReceipt(instantTxHash);
  const { isSuccess: ausdRequestConfirmed } = useYieldTransactionReceipt(ausdRequestTxHash);
  const { isSuccess: aprMonConfirmed } = useYieldTransactionReceipt(aprMonTxHash);

  const balance = type === 'aprMON'
    ? (aprMonBalance ? parseFloat(formatEther(aprMonBalance)) : 0)
    : (earnAusdBalance ? parseFloat(formatUnits(earnAusdBalance, 6)) : 0);

  const symbol = type === 'aprMON' ? 'aprMON' : 'earnAUSD';
  const receiveSymbol = type === 'aprMON' ? 'MON' : 'aUSD';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setWithdrawStep('input');
      setErrorMessage(null);
      setRedeemType('instant');
      resetApprove();
      resetInstant();
      resetAusdRequest();
      resetAprMon();
    }
  }, [isOpen, resetApprove, resetInstant, resetAusdRequest, resetAprMon]);

  // After approval confirmed, proceed to redeem
  useEffect(() => {
    if (approveConfirmed && withdrawStep === 'approving') {
      refetchAllowance();
      executeRedeem();
    }
  }, [approveConfirmed, withdrawStep]);

  // Monitor redeem success
  useEffect(() => {
    if (instantConfirmed || ausdRequestConfirmed || aprMonConfirmed) {
      setWithdrawStep('success');
    }
  }, [instantConfirmed, ausdRequestConfirmed, aprMonConfirmed]);

  // Monitor errors
  useEffect(() => {
    const error = approveError || instantError || ausdRequestError || aprMonError;
    if (error) {
      setWithdrawStep('error');
      setErrorMessage(error.message || 'Transaction failed');
    }
  }, [approveError, instantError, ausdRequestError, aprMonError]);

  const handleMax = () => {
    setAmount(balance.toString());
  };

  // Execute the actual redeem after approval
  const executeRedeem = async () => {
    try {
      setWithdrawStep('processing');

      if (type === 'earnAUSD') {
        const amountUnits = parseUnits(amount, 6);

        if (redeemType === 'instant') {
          // Instant redeem with 0.2% fee
          const minAmountOut = amountUnits * BigInt(998) / BigInt(1000);
          await instantRedeem(amountUnits, minAmountOut);
        } else {
          // Delayed redeem (no fee, 96H wait)
          await requestAusdRedeem(amountUnits);
        }
      } else {
        // aprMON request redeem (12-18 hour wait)
        const amountWei = parseEther(amount);
        await requestAprMonRedeem(amountWei);
      }
    } catch (err) {
      console.error('Redeem error:', err);
      setWithdrawStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Withdrawal failed');
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      setErrorMessage('Please connect your wallet first');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    if (numAmount > balance) {
      setErrorMessage('Insufficient balance');
      return;
    }

    setErrorMessage(null);

    if (type === 'earnAUSD') {
      // Check if approval is needed for earnAUSD LP token
      const amountUnits = parseUnits(amount, 6);
      const currentAllowance = earnAusdAllowance || BigInt(0);

      if (currentAllowance < amountUnits) {
        // Need approval first
        try {
          setWithdrawStep('approving');
          await approveEarnAusd(amountUnits);
        } catch (err) {
          console.error('Approval error:', err);
          setWithdrawStep('error');
          setErrorMessage(err instanceof Error ? err.message : 'Approval failed');
        }
      } else {
        // Already approved, proceed to redeem
        await executeRedeem();
      }
    } else {
      // aprMON doesn't need approval for requestRedeem
      await executeRedeem();
    }
  };

  const finalTxHash = instantTxHash || ausdRequestTxHash || aprMonTxHash;
  const isProcessing = isApproving || isInstantRedeeming || isRequestingAusd || isRequestingAprMon || withdrawStep === 'approving' || withdrawStep === 'processing';

  const renderContent = () => {
    // Success state
    if (withdrawStep === 'success') {
      const successMessage = type === 'aprMON'
        ? `Your ${amount} aprMON withdrawal request has been submitted. You can claim your MON after ~12-18 hours.`
        : redeemType === 'instant'
          ? `You have received ≈ ${(parseFloat(amount) * 0.998).toFixed(6)} aUSD (0.2% fee deducted)`
          : `Your ${amount} earnAUSD withdrawal request has been submitted. You can claim after up to 96H.`;

      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {type === 'aprMON' || redeemType === 'delayed' ? 'Withdrawal Requested!' : 'Withdrawal Successful!'}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {successMessage}
          </p>
          {finalTxHash && (
            <a
              href={`https://monadscan.com/tx/${finalTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-primary hover:underline"
            >
              View on Explorer <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="mt-6 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Done
          </button>
        </div>
      );
    }

    // Error state
    if (withdrawStep === 'error') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Transaction Failed</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {errorMessage || 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={() => {
              setWithdrawStep('input');
              setErrorMessage(null);
              resetApprove();
              resetInstant();
              resetAusdRequest();
              resetAprMon();
            }}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
          >
            Try Again
          </button>
        </div>
      );
    }

    // Approving state
    if (withdrawStep === 'approving') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Approving earnAUSD...</h3>
          <p className="text-muted-foreground mb-4">
            Please confirm the approval in your wallet
          </p>
          <p className="text-xs text-muted-foreground">
            This allows the vault to withdraw your earnAUSD tokens
          </p>
        </div>
      );
    }

    // Processing state
    if (isProcessing) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Processing Withdrawal...</h3>
          <p className="text-muted-foreground mb-4">
            Please confirm the transaction in your wallet
          </p>
        </div>
      );
    }

    // Input state
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Image
            src={type === 'aprMON' ? '/icons/aprmon.png' : '/icons/earnAUSD-monad.png'}
            alt={symbol}
            width={28}
            height={28}
            className="rounded-lg"
          />
          <h2 className="text-xl font-bold text-foreground">
            Withdraw {symbol}
          </h2>
        </div>

        {/* Balance Display */}
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src={type === 'aprMON' ? '/icons/aprmon.png' : '/icons/earnAUSD-monad.png'}
              alt={symbol}
              width={32}
              height={32}
              className="rounded-lg"
            />
            <div>
              <p className="text-sm text-muted-foreground">{balance.toFixed(6)} Available</p>
            </div>
          </div>
        </Card>

        {/* Amount Input */}
        <div>
          <Input
            type="number"
            placeholder={`Withdraw ${symbol}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            suffix={
              <button
                onClick={handleMax}
                className="text-brand-primary text-sm font-medium hover:underline"
              >
                MAX
              </button>
            }
          />
        </div>

        {/* Withdraw Options (for earnAUSD) */}
        {type === 'earnAUSD' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Redemption Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRedeemType('instant')}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 text-left",
                  redeemType === 'instant'
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-border hover:border-purple-500/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="font-medium text-foreground">Instant</span>
                </div>
                <p className="text-xs text-muted-foreground">Get aUSD now</p>
                <p className="text-xs text-orange-400 mt-1">0.20% fee</p>
              </button>
              <button
                onClick={() => setRedeemType('delayed')}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 text-left",
                  redeemType === 'delayed'
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-border hover:border-purple-500/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-foreground">Wait 96H</span>
                </div>
                <p className="text-xs text-muted-foreground">Up to 96H wait</p>
                <p className="text-xs text-green-400 mt-1">No fee</p>
              </button>
            </div>
          </div>
        )}

        {/* Info for aprMON */}
        {type === 'aprMON' && (
          <Card variant="glass" className="p-3 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-400 font-medium">12-18 Hour Waiting Period</p>
                <p className="text-muted-foreground text-xs mt-1">
                  After requesting, you can claim your MON once the staking epoch completes.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Transaction Overview */}
        <Card variant="glass" className="p-4">
          <h4 className="font-semibold text-foreground mb-3">Transaction Overview</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">You Withdraw</span>
              <span className="text-foreground">{parseFloat(amount || '0').toFixed(6)} {symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">You Receive</span>
              <span className="text-foreground">
                {type === 'earnAUSD' && redeemType === 'instant'
                  ? `≈ ${(parseFloat(amount || '0') * 0.998).toFixed(6)} aUSD`
                  : `≈ ${parseFloat(amount || '0').toFixed(6)} ${receiveSymbol}`
                }
              </span>
            </div>
            {type === 'earnAUSD' && redeemType === 'instant' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-orange-400">0.20%</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Wait Time</span>
              <span className="text-foreground">
                {type === 'aprMON' ? '~12-18 hours' : redeemType === 'instant' ? 'Instant' : 'Up to 96H'}
              </span>
            </div>
          </div>
        </Card>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-300"
          >
            <span className="bg-gradient-to-r from-purple-300 to-purple-400 font-semibold bg-clip-text text-transparent">
              Cancel
            </span>
          </button>
          <button
            onClick={handleWithdraw}
            disabled={!isConnected || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg transition-all duration-300 font-semibold",
              (!isConnected || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance)
                ? "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white"
            )}
          >
            {!isConnected ? 'Connect Wallet' : (
              <span className="flex items-center justify-center gap-2">
                <Image
                  src={type === 'aprMON' ? '/icons/aprmon.png' : '/icons/earnAUSD-monad.png'}
                  alt={symbol}
                  width={18}
                  height={18}
                  className="rounded-sm"
                />
                Withdraw {symbol}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {renderContent()}
    </Modal>
  );
}

// Claim Rewards Modal - shows pending withdrawals and claimable rewards
export function ClaimRewardsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [claimingRequestId, setClaimingRequestId] = useState<bigint | null>(null);
  const [claimStep, setClaimStep] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'aprmon' | 'earnausd'>('aprmon');

  // Fetch pending aprMON withdrawal requests
  const { data: pendingRequests, refetch: refetchRequests } = useAprMonWithdrawalRequests(address);

  // Claim hook for aprMON
  const { redeem: claimAprMon, isPending: isClaimingAprMon, txHash: claimTxHash, error: claimAprMonError, reset: resetClaim } = useRedeemAprMon();

  // Monitor claim transaction
  const { isSuccess: claimConfirmed } = useYieldTransactionReceipt(claimTxHash);

  // Parse pending withdrawal requests
  const withdrawalRequests = useMemo(() => {
    if (!pendingRequests || !Array.isArray(pendingRequests)) return [];
    return pendingRequests.filter((req: { claimed: boolean }) => !req.claimed);
  }, [pendingRequests]);

  const claimableRequests = useMemo(() => {
    return withdrawalRequests.filter((req: { claimable: boolean }) => req.claimable);
  }, [withdrawalRequests]);

  const pendingNonClaimable = useMemo(() => {
    return withdrawalRequests.filter((req: { claimable: boolean }) => !req.claimable);
  }, [withdrawalRequests]);

  const totalClaimable = useMemo(() => {
    return claimableRequests.reduce((acc: number, req: { assets: bigint }) => {
      return acc + parseFloat(formatEther(req.assets));
    }, 0);
  }, [claimableRequests]);

  const totalPending = useMemo(() => {
    return pendingNonClaimable.reduce((acc: number, req: { assets: bigint }) => {
      return acc + parseFloat(formatEther(req.assets));
    }, 0);
  }, [pendingNonClaimable]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setClaimStep('idle');
      setClaimError(null);
      resetClaim();
      refetchRequests();
    }
  }, [isOpen, resetClaim, refetchRequests]);

  // Monitor claim success
  useEffect(() => {
    if (claimConfirmed && claimStep === 'processing') {
      setClaimStep('success');
      refetchRequests();
      setTimeout(() => setClaimStep('idle'), 3000);
    }
  }, [claimConfirmed, claimStep, refetchRequests]);

  // Monitor claim errors
  useEffect(() => {
    if (claimAprMonError) {
      setClaimStep('error');
      setClaimError(claimAprMonError.message || 'Claim failed');
    }
  }, [claimAprMonError]);

  const handleClaimRequest = async (requestId: bigint) => {
    try {
      setClaimingRequestId(requestId);
      setClaimStep('processing');
      setClaimError(null);
      resetClaim();
      await claimAprMon([requestId]);
    } catch (err) {
      console.error('Claim error:', err);
      setClaimStep('error');
      setClaimError(err instanceof Error ? err.message : 'Claim failed');
    }
  };

  const handleClaimAll = async () => {
    if (claimableRequests.length === 0) return;
    try {
      setClaimingRequestId(null);
      setClaimStep('processing');
      setClaimError(null);
      resetClaim();
      const requestIds = claimableRequests.map((req: { id: bigint }) => req.id);
      await claimAprMon(requestIds);
    } catch (err) {
      console.error('Claim all error:', err);
      setClaimStep('error');
      setClaimError(err instanceof Error ? err.message : 'Claim failed');
    }
  };

  if (!isConnected) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold text-foreground mb-2">Connect Wallet</h3>
          <p className="text-muted-foreground">Connect your wallet to claim rewards</p>
        </div>
      </Modal>
    );
  }

  const hasNoClaims = claimableRequests.length === 0 && pendingNonClaimable.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-purple-500/20 flex items-center justify-center">
              <Gift className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Claim Rewards</h2>
              <p className="text-sm text-muted-foreground">Pending withdrawals & claimable assets</p>
            </div>
          </div>
          <button onClick={() => refetchRequests()} className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card variant="glass" className="p-3 border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Ready to Claim</span>
            </div>
            <p className="text-lg font-bold text-green-400">{totalClaimable.toFixed(6)} MON</p>
            <p className="text-xs text-muted-foreground">{claimableRequests.length} requests</p>
          </Card>
          <Card variant="glass" className="p-3 border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-muted-foreground">Processing</span>
            </div>
            <p className="text-lg font-bold text-yellow-400">{totalPending.toFixed(6)} MON</p>
            <p className="text-xs text-muted-foreground">{pendingNonClaimable.length} pending</p>
          </Card>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('aprmon')}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeSection === 'aprmon'
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-background/50 text-muted-foreground hover:bg-purple-500/10"
            )}
          >
            <Image src="/icons/monad.png" alt="MON" width={20} height={20} className="rounded-full" />
            aprMON Withdrawals
          </button>
          <button
            onClick={() => setActiveSection('earnausd')}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeSection === 'earnausd'
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-background/50 text-muted-foreground hover:bg-cyan-500/10"
            )}
          >
            <Image src="/icons/earnAUSD-monad.png" alt="aUSD" width={20} height={20} className="rounded-full" />
            earnAUSD Withdrawals
          </button>
        </div>

        {/* Status Feedback */}
        {claimStep === 'success' && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Claim successful! Assets have been sent to your wallet.
            </p>
          </div>
        )}

        {claimStep === 'error' && claimError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {claimError}
            </p>
          </div>
        )}

        {/* aprMON Section */}
        {activeSection === 'aprmon' && (
          <div className="space-y-3">
            {hasNoClaims ? (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Pending Claims</h3>
                <p className="text-muted-foreground text-sm">
                  Withdraw from your positions to see pending claims here
                </p>
              </div>
            ) : (
              <>
                {/* Claimable Requests */}
                {claimableRequests.length > 0 && (
                  <Card variant="glass" className="p-4 border-green-500/30 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <h3 className="font-semibold text-foreground">Ready to Claim</h3>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-auto">
                        {claimableRequests.length} claimable
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {claimableRequests.map((req: { id: bigint; assets: bigint; shares: bigint }) => {
                        const monAmount = parseFloat(formatEther(req.assets));
                        return (
                          <div key={req.id.toString()} className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                            <div className="flex items-center gap-2">
                              <Image src="/icons/monad.png" alt="MON" width={24} height={24} className="rounded-full" />
                              <span className="text-foreground">{monAmount.toFixed(6)} MON</span>
                            </div>
                            <button
                              onClick={() => handleClaimRequest(req.id)}
                              disabled={isClaimingAprMon}
                              className={cn(
                                "px-3 py-1 rounded-lg text-sm font-medium transition-all",
                                isClaimingAprMon && claimingRequestId === req.id
                                  ? "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                                  : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              )}
                            >
                              {isClaimingAprMon && claimingRequestId === req.id ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Claiming...
                                </span>
                              ) : (
                                'Claim'
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {claimableRequests.length > 1 && (
                      <button
                        onClick={handleClaimAll}
                        disabled={isClaimingAprMon}
                        className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold transition-all disabled:opacity-50"
                      >
                        {isClaimingAprMon && claimingRequestId === null ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming All...
                          </span>
                        ) : (
                          `Claim All (${totalClaimable.toFixed(6)} MON)`
                        )}
                      </button>
                    )}
                  </Card>
                )}

                {/* Pending Non-Claimable Requests */}
                {pendingNonClaimable.length > 0 && (
                  <Card variant="glass" className="p-4 border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-semibold text-foreground">Processing</h3>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-auto">
                        {pendingNonClaimable.length} pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      These withdrawals are still processing. Check back after the epoch completes (~12-18 hours).
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {pendingNonClaimable.map((req: { id: bigint; assets: bigint; shares: bigint; unlockEpoch: bigint }) => {
                        const monAmount = parseFloat(formatEther(req.assets));
                        return (
                          <div key={req.id.toString()} className="flex items-center justify-between p-2 rounded-lg bg-background/50">
                            <div className="flex items-center gap-2">
                              <Image src="/icons/monad.png" alt="MON" width={24} height={24} className="rounded-full" />
                              <span className="text-foreground">{monAmount.toFixed(6)} MON</span>
                            </div>
                            <span className="text-xs text-yellow-400 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* earnAUSD Section */}
        {activeSection === 'earnausd' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Image src="/icons/earnAUSD-monad.png" alt="earnAUSD" width={32} height={32} className="rounded-lg" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Instant Withdrawal</h3>
            <p className="text-muted-foreground text-sm mb-4">
              earnAUSD supports instant withdrawals with a 0.2% fee, or delayed withdrawals (96 hours) with no fee.
              Use the Withdraw button in My Positions.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-cyan-400">
              <Info className="w-4 h-4" />
              <span>No pending earnAUSD claims</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-semibold"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
