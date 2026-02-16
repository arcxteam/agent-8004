'use client';

import { useState, useMemo, Suspense, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { formatUnits, parseEther, formatEther, type Address } from 'viem';
import Image from 'next/image';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Download,
  Upload,
  ExternalLink,
  PieChart,
  BarChart3,
  LineChart,
  Activity,
  Clock,
  Trophy,
  Target,
  Percent,
  DollarSign,
  Coins,
  Gift,
  HandCoins,
  Sparkles,
  ChevronRight,
  Copy,
  CheckCheck,
  Calendar,
  Zap,
  Diamond,
  SquareChartGantt,
  Loader2,
  AlertCircle,
  Shield,
  Lock,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Badge,
  Modal,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { DashboardLayout } from '@/components/layout';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import { erc20Abi } from '@/config/contracts';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useMyAgents } from '@/hooks/useAgents';
import {
  useVaultAddress,
  useFeeConfig,
  useDelegateCapital,
  useWithdrawCapital,
  useDelegatorDelegations,
  useCalculateWithdrawalFee,
} from '@/hooks/useCapitalVault';

/**
 * Format balance for display - handles large and small numbers properly
 * - Large numbers: show 2-4 decimals (e.g., 43.2277)
 * - Small numbers: show up to 6-8 decimals (e.g., 0.000234)
 * - Very small: use scientific notation or show minimum visible digits
 */
function formatBalance(balance: number, decimals: number = 18): string {
  if (balance === 0) return '0.00';
  
  // For very large balances (>1000), show 2 decimals
  if (balance >= 1000) {
    return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // For normal balances (1-1000), show 2-4 decimals
  if (balance >= 1) {
    return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  
  // For small balances (0.01-1), show 4 decimals
  if (balance >= 0.01) {
    return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  
  // For very small balances (<0.01), show more decimals based on token decimals
  const significantDigits = Math.min(decimals, 8);
  
  // Find the first non-zero digit position
  const absBalance = Math.abs(balance);
  const logValue = Math.floor(Math.log10(absBalance));
  const displayDecimals = Math.min(Math.max(-logValue + 2, 4), significantDigits);
  
  return balance.toLocaleString('en-US', { 
    minimumFractionDigits: 4, 
    maximumFractionDigits: displayDecimals 
  });
}

// Monad Mainnet Token List with contract addresses
const MONAD_TOKENS = [
  { 
    symbol: 'MON', 
    name: 'Monad', 
    address: '0x0000000000000000000000000000000000000000', // Native token
    decimals: 18,
    icon: '/icons/monad.png',
    isNative: true,
  },
  { 
    symbol: 'WMON', 
    name: 'Wrapped MON', 
    address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    decimals: 18,
    icon: '/icons/wmon.png',
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    decimals: 6,
    icon: '/icons/usdc-monad.png',
  },
  { 
    symbol: 'USDT', 
    name: 'Tether USD', 
    address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
    decimals: 6,
    icon: '/icons/usdt-monad.png',
  },
  { 
    symbol: 'aUSD', 
    name: 'Agora USD', 
    address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    decimals: 6,
    icon: '/icons/aUSD-monad.png',
  },
  { 
    symbol: 'earnAUSD', 
    name: 'Earn aUSD', 
    address: '0x103222f020e98Bba0AD9809A011FDF8e6F067496',
    decimals: 6,
    icon: '/icons/earnAUSD-monad.png',
  },
  { 
    symbol: 'aprMON', 
    name: 'Apriori MON', 
    address: '0x0c65A0BC65a5D819235B71F554D210D3F80E0852',
    decimals: 18,
    icon: '/icons/aprmon.png',
  },
  { 
    symbol: 'WBTC', 
    name: 'Wrapped Bitcoin', 
    address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    decimals: 8,
    icon: '/icons/wbtc-monad.png',
  },
  { 
    symbol: 'WETH', 
    name: 'Wrapped Ether', 
    address: '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242',
    decimals: 18,
    icon: '/icons/weth-monad.png',
  },
  { 
    symbol: 'CHOG', 
    name: 'Chog', 
    address: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777',
    decimals: 18,
    icon: '/icons/chog.png',
  },
];

// Asset/Token holding type
interface TokenHolding {
  symbol: string;
  name: string;
  address: string;
  balance: number; // Raw balance number
  formattedBalance: string; // Display formatted balance
  value: number;
  price: number;
  change24h: number;
  allocation: number;
  icon: string;
  decimals: number;
}

// Empty holdings for when wallet not connected or no balance
const emptyHoldings: TokenHolding[] = [];

// Transaction type
interface Transaction {
  id: number;
  type: string;
  from: string;
  to: string;
  amount: string;
  value: string;
  time: string;
  hash: string;
  fullHash?: string;
  status: string;
}

// Token Icon Component
function TokenIcon({ src, symbol, size = 'md' }: { src: string; symbol: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  const [imgError, setImgError] = useState(false);
  
  return (
    <div className={cn('relative rounded-lg overflow-hidden flex-shrink-0', sizeClasses[size])}>
      {!imgError ? (
        <Image
          src={src}
          alt={symbol}
          fill
          className="object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center rounded-lg">
          <span className="text-sm font-bold text-foreground">{symbol.charAt(0)}</span>
        </div>
      )}
    </div>
  );
}

// Holdings Table Row
function HoldingRow({ holding, index }: { holding: TokenHolding; index: number }) {
  const [copied, setCopied] = useState(false);
  
  const copyAddress = () => {
    navigator.clipboard.writeText(holding.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="border-b border-border/50 hover:bg-card/50 transition-colors group"
    >
      <td className="py-4 px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <TokenIcon src={holding.icon} symbol={holding.symbol} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{holding.symbol}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{holding.name}</p>
              <button onClick={copyAddress} className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copied ? (
                  <CheckCheck className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-3 sm:px-4 text-right">
        <p className="font-medium">{holding.formattedBalance}</p>
        <p className="text-xs sm:text-sm text-muted-foreground">{formatCurrency(holding.value)}</p>
      </td>
      <td className="py-4 px-3 sm:px-4 text-right hidden sm:table-cell">
        <p className="font-medium">{formatCurrency(holding.price)}</p>
      </td>
      <td className="py-4 px-3 sm:px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {holding.change24h >= 0 ? (
            <TrendingUp className="w-3 h-3 text-success" />
          ) : (
            <TrendingDown className="w-3 h-3 text-danger" />
          )}
          <span className={cn(
            'font-medium text-sm',
            holding.change24h >= 0 ? 'text-success' : 'text-danger'
          )}>
            {holding.change24h >= 0 ? '+' : ''}{formatPercentage(holding.change24h)}
          </span>
        </div>
      </td>
      <td className="py-4 px-3 sm:px-4 hidden md:table-cell">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              style={{ transformOrigin: 'left', width: `${holding.allocation}%` }}
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
            />
          </div>
          <span className="text-sm text-muted-foreground w-10 text-right">{holding.allocation}%</span>
        </div>
      </td>
      <td className="py-4 px-3 sm:px-4 text-right">
        <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
          <ArrowRightLeft className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Trade</span>
        </Button>
      </td>
    </motion.tr>
  );
}

// Allocation Pie Chart Colors
const PIE_CHART_COLORS = [
  'hsl(270, 100%, 65%)', // purple
  'hsl(180, 100%, 50%)', // cyan
  'hsl(133, 94%, 35%)',  // green
  'hsl(38, 92%, 50%)',   // yellow
  'hsl(199, 89%, 48%)',  // blue
  'hsl(0, 84%, 60%)',    // red
  'hsl(240, 1%, 25%)',  // violet
];

function calculatePieSegments(holdings: TokenHolding[]) {
  let cumulativePercent = 0;
  return holdings.map((holding, index) => {
    const startPercent = cumulativePercent;
    const endPercent = cumulativePercent + holding.allocation;
    cumulativePercent = endPercent;
    return {
      ...holding,
      startPercent,
      endPercent,
      color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
    };
  });
}

function AllocationChart({ holdings }: { holdings: TokenHolding[] }) {
  const segments = useMemo(() => calculatePieSegments(holdings), [holdings]);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * (percent / 100 - 0.25));
    const y = Math.sin(2 * Math.PI * (percent / 100 - 0.25));
    return [x, y];
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
      {/* Pie Chart */}
      <div className="relative">
        <svg width="220" height="220" viewBox="-1.1 -1.1 2.2 2.2" className="drop-shadow-lg">
          {segments.map((segment, index) => {
            const [startX, startY] = getCoordinatesForPercent(segment.startPercent);
            const [endX, endY] = getCoordinatesForPercent(segment.endPercent);
            const largeArcFlag = segment.allocation > 50 ? 1 : 0;
            
            const pathData = [
              `M ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `L 0 0`,
            ].join(' ');

            const isHovered = hoveredSegment === segment.symbol;

            return (
              <motion.path
                key={segment.symbol}
                d={pathData}
                fill={segment.color}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: isHovered ? 1.05 : 1,
                }}
                transition={{ delay: index * 0.1 }}
                className="cursor-pointer transition-all duration-200"
                style={{ 
                  filter: isHovered ? 'brightness(1.2) drop-shadow(0 0 10px rgba(0,0,0,0.3))' : 'none',
                  transformOrigin: 'center',
                }}
                onMouseEnter={() => setHoveredSegment(segment.symbol)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            );
          })}
          {/* Inner circle for donut effect */}
          <circle cx="0" cy="0" r="0.55" fill="hsl(var(--background))" />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <DollarSign className="w-5 h-5 text-muted-foreground mb-1" />
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground">Total Value</p>
        </div>
      </div>

      {/* Legend - Clean without color dots, only $ values */}
      <div className="grid grid-cols-2 gap-2 w-full lg:w-auto">
        {segments.map((segment, index) => (
          <motion.div
            key={segment.symbol}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all',
              hoveredSegment === segment.symbol ? 'bg-card/80 ring-1 ring-cyan-500/30' : 'hover:bg-card/50'
            )}
            onMouseEnter={() => setHoveredSegment(segment.symbol)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <TokenIcon src={segment.icon} symbol={segment.symbol} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">{formatCurrency(segment.value)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Transaction Row
function TransactionRow({ tx, index }: { tx: Transaction; index: number }) {
  const typeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
    swap: { icon: <ArrowRightLeft className="w-5 h-5" />, color: 'text-cyan-400', bgColor: 'from-cyan-500/20 to-cyan-500/10' },
    transfer: { icon: <ArrowUpRight className="w-5 h-5" />, color: 'text-blue-400', bgColor: 'from-blue-500/20 to-blue-500/10' },
    deposit: { icon: <Download className="w-5 h-5" />, color: 'text-success', bgColor: 'from-success/20 to-success/10' },
    withdraw: { icon: <Upload className="w-5 h-5" />, color: 'text-warning', bgColor: 'from-warning/20 to-warning/10' },
    delegate: { icon: <HandCoins className="w-5 h-5" />, color: 'text-purple-400', bgColor: 'from-purple-500/20 to-purple-500/10' },
    reward: { icon: <Gift className="w-5 h-5" />, color: 'text-success', bgColor: 'from-success/20 to-success/10' },
  };

  const config = typeConfig[tx.type] || typeConfig.swap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 hover:bg-card/50 rounded-xl transition-colors border border-transparent hover:border-border/50"
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center', config.bgColor)}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground capitalize">{tx.type}</p>
            <Badge variant={tx.status === 'confirmed' ? 'success' : 'warning'} size="sm">{tx.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {tx.from} <ChevronRight className="w-3 h-3" /> {tx.to}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8">
        <div className="text-left sm:text-right">
          <p className="font-medium">{tx.amount}</p>
          <p className="text-sm text-muted-foreground">{tx.value}</p>
        </div>
        <div className="text-right min-w-[100px]">
          <p className="text-sm text-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {tx.time}
          </p>
          <a
            href={`https://monadscan.com/tx/${tx.fullHash || tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 justify-end"
          >
            {tx.hash}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// Deposit/Withdraw Modal with Capital Vault Integration
function TransferModal({
  isOpen,
  onClose,
  type,
  holdings,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: 'deposit' | 'withdraw';
  holdings: TokenHolding[];
}) {
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('MON');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txError, setTxError] = useState<string | null>(null);

  // Fetch user's agents for agent selection
  const { agents: myAgents, isLoading: agentsLoading } = useMyAgents();

  // Auto-select first agent when agents load
  useEffect(() => {
    if (myAgents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(myAgents[0].id);
    }
  }, [myAgents, selectedAgentId]);

  // Get selected agent details
  const selectedAgent = myAgents.find(a => a.id === selectedAgentId);

  // Vault hooks
  const { address: vaultAddress, isDeployed } = useVaultAddress();
  const { registrationFeeMON, minCapitalMON, withdrawalFeePercent } = useFeeConfig();
  const { delegate, isPending: isDepositing, isSuccess: depositSuccess, hash: depositHash, error: depositError } = useDelegateCapital();
  const { withdraw, isPending: isWithdrawing, isSuccess: withdrawSuccess, hash: withdrawHash, error: withdrawError } = useWithdrawCapital();
  const { delegations, fetchDetails, isLoading: loadingDelegations } = useDelegatorDelegations();
  const { feeMON: withdrawalFee, netAmountMON } = useCalculateWithdrawalFee(Number(amount) || 0);
  const { address: userAddress } = useAccount();

  // Supported tokens (only MON for native, might add ERC20 later)
  const tokens = ['MON'];
  
  // Get actual available balance from holdings
  const availableBalance = holdings.find(h => h.symbol === selectedToken)?.balance || 0;

  // Fetch delegations on mount
  useEffect(() => {
    if (isOpen && type === 'withdraw') {
      fetchDetails();
    }
  }, [isOpen, type, fetchDetails]);

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    if (!amount || Number(amount) < minCapitalMON) {
      setTxError(`Minimum deposit is ${minCapitalMON} MON`);
      return;
    }

    if (!selectedAgentId) {
      setTxError('Please select an agent to delegate capital to');
      return;
    }

    setTxStatus('pending');
    setTxError(null);

    try {
      await delegate(BigInt(selectedAgentId), Number(amount));
      setTxStatus('success');
    } catch (err) {
      setTxStatus('error');
      setTxError(err instanceof Error ? err.message : 'Deposit failed');
    }
  }, [amount, selectedAgentId, minCapitalMON, delegate]);

  // Handle withdraw
  const handleWithdraw = useCallback(async (delegationId: bigint) => {
    setTxStatus('pending');
    setTxError(null);

    try {
      const recipient = recipientAddress || userAddress;
      await withdraw(delegationId, recipient as Address);
      setTxStatus('success');
      fetchDetails(); // Refresh delegations
    } catch (err) {
      setTxStatus('error');
      setTxError(err instanceof Error ? err.message : 'Withdrawal failed');
    }
  }, [recipientAddress, userAddress, withdraw, fetchDetails]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setSelectedAgentId('');
      setTxStatus('idle');
      setTxError(null);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {type === 'deposit' ? (
              <Download className="w-6 h-6 text-cyan-400" />
            ) : (
              <Upload className="w-6 h-6 text-purple-400" />
            )}
            <h2 className="text-xl font-bold text-foreground">
              {type === 'deposit' ? 'Deposit to Vault' : 'Withdraw from Vault'}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {type === 'deposit' 
              ? 'Delegate capital to an agent for trading' 
              : 'Withdraw your delegated capital'}
          </p>
        </div>

        {/* Vault Status */}
        {!isDeployed && (
          <Card variant="glass" className="p-4 border-amber-500/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-400">Vault Not Deployed</p>
                <p className="text-xs text-muted-foreground">
                  Capital Vault is not deployed yet. You can send MON directly to the agent wallet address below.
                </p>
              </div>
            </div>
          </Card>
        )}

        {type === 'deposit' ? (
          <>
            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Token</label>
              <div className="flex flex-wrap gap-2">
                {tokens.map((token) => {
                  const tokenData = MONAD_TOKENS.find(t => t.symbol === token);
                  return (
                    <button
                      key={token}
                      onClick={() => setSelectedToken(token)}
                      className={cn(
                        'px-3 py-2 rounded-xl border transition-all flex items-center gap-2',
                        selectedToken === token
                          ? 'border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-foreground'
                          : 'border-border/50 hover:border-cyan-500/30 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tokenData && (
                        <TokenIcon src={tokenData.icon} symbol={token} size="sm" />
                      )}
                      <span className="font-medium">{token}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agent Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Agent
              </label>
              {agentsLoading ? (
                <div className="flex items-center gap-2 p-3 border border-border/50 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading agents...</span>
                </div>
              ) : myAgents.length === 0 ? (
                <Card variant="glass" className="p-3 text-center">
                  <p className="text-sm text-muted-foreground">No agents found. Create an agent first.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {myAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={cn(
                          'px-3 py-2 rounded-xl border transition-all text-left',
                          selectedAgentId === agent.id
                            ? 'border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-foreground'
                            : 'border-border/50 hover:border-cyan-500/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="font-medium text-sm">{agent.name}</span>
                        <span className="text-xs ml-2 opacity-60">{agent.strategy}</span>
                      </button>
                    ))}
                  </div>
                  {/* Show agent wallet address for direct funding */}
                  {selectedAgent?.walletAddr && (
                    <Card variant="glass" className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">Agent Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-cyan-400 font-mono break-all">
                          {selectedAgent.walletAddr}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedAgent.walletAddr!);
                          }}
                          className="flex-shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                      {!isDeployed && (
                        <p className="text-xs text-amber-400 mt-1">
                          Send MON directly to this address to fund the agent
                        </p>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Amount</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20"
                  min={minCapitalMON}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button 
                    className="text-cyan-400 text-sm font-medium hover:text-cyan-300"
                    onClick={() => setAmount(availableBalance.toString())}
                  >
                    MAX
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                Available: {availableBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {selectedToken}
                <span className="text-xs ml-2">(Min: {minCapitalMON} MON)</span>
              </p>
            </div>

            {/* Fee Info */}
            <Card variant="glass" className="p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Lockup Period
                </span>
                <span className="text-foreground">24 hours</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Network Fee
                </span>
                <span className="text-foreground">~0.001 MON</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Withdrawal Fee
                </span>
                <span className="text-foreground">{withdrawalFeePercent}%</span>
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* Active Delegations */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Your Delegations
              </label>
              {loadingDelegations ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : delegations.length === 0 ? (
                <Card variant="glass" className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">No active delegations found</p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {delegations.map((d) => (
                    <Card 
                      key={d.delegationId.toString()} 
                      variant="glass" 
                      className="p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {Number(formatEther(d.amount)).toFixed(4)} MON
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Agent #{d.agentId.toString()} · 
                          Unlocks: {new Date(Number(d.lockupEndsAt) * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleWithdraw(d.delegationId)}
                        disabled={isWithdrawing || Number(d.lockupEndsAt) * 1000 > Date.now()}
                        className="text-xs"
                      >
                        {Number(d.lockupEndsAt) * 1000 > Date.now() ? (
                          <Lock className="w-3 h-3 mr-1" />
                        ) : (
                          <Upload className="w-3 h-3 mr-1" />
                        )}
                        {Number(d.lockupEndsAt) * 1000 > Date.now() ? 'Locked' : 'Withdraw'}
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Recipient Address (optional) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Recipient Address (optional)
              </label>
              <Input
                type="text"
                placeholder="0x... (defaults to your wallet)"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to withdraw to your connected wallet
              </p>
            </div>

            {/* Fee Info */}
            <Card variant="glass" className="p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Withdrawal Fee
                </span>
                <span className="text-foreground">{withdrawalFeePercent}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Estimated Time
                </span>
                <span className="text-foreground">~2 seconds</span>
              </div>
            </Card>
          </>
        )}

        {/* Error Display */}
        {txError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-sm text-red-400">{txError}</p>
          </div>
        )}

        {/* Success Display */}
        {txStatus === 'success' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <p className="text-sm text-green-400">
              {type === 'deposit' ? 'Deposit successful!' : 'Withdrawal successful!'}
              {(depositHash || withdrawHash) && (
                <a 
                  href={`https://monadscan.com/tx/${depositHash || withdrawHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-cyan-400 hover:underline"
                >
                  View on Explorer
                </a>
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {txStatus === 'success' ? 'Close' : 'Cancel'}
          </Button>
          {type === 'deposit' && txStatus !== 'success' && (
            <Button 
              variant="outline" 
              className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-cyan-500"
              onClick={handleDeposit}
              disabled={!isDeployed || isDepositing || !amount || Number(amount) < minCapitalMON || !selectedAgentId}
            >
              {isDepositing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Depositing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Deposit
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Performance Summary Card - shows actual wallet value
function PerformanceSummary({ totalValue }: { totalValue: number }) {
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  
  // Format the total value display
  const formattedValue = formatCurrency(totalValue);
  
  // Period-based data with unique colors for each stat
  // Note: Only Total Value is real, other stats require historical data from indexer/API
  const periodData: Record<string, { stats: { label: string; value: string; change: string; positive: boolean; icon: React.ElementType; color: string; bgColor: string }[]; chartPath: string }> = {
    '1D': {
      stats: [
        { label: 'Total Value', value: formattedValue, change: '-', positive: true, icon: DollarSign, color: 'text-purple-400', bgColor: 'from-purple-400/20 to-purple-500/20' },
        { label: 'Day Change', value: '-', change: 'N/A', positive: true, icon: TrendingUp, color: 'text-green-500', bgColor: 'from-green-400/20 to-green-500/20' },
        { label: 'High', value: '-', change: 'N/A', positive: true, icon: LineChart, color: 'text-cyan-400', bgColor: 'from-cyan-400/20 to-cyan-500/20' },
        { label: 'Low', value: '-', change: 'N/A', positive: false, icon: BarChart3, color: 'text-gray-500', bgColor: 'from-gray-400/20 to-gray-500/20' },
      ],
      chartPath: 'M0,60 Q50,65 100,55 T200,50 T300,45 T400,40',
    },
    '1W': {
      stats: [
        { label: 'Total Value', value: formattedValue, change: '-', positive: true, icon: DollarSign, color: 'text-purple-400', bgColor: 'from-purple-400/20 to-purple-500/20' },
        { label: 'Week Change', value: '-', change: 'N/A', positive: true, icon: TrendingUp, color: 'text-green-500', bgColor: 'from-green-400/20 to-green-500/20' },
        { label: 'Best Day', value: '-', change: 'N/A', positive: true, icon: LineChart, color: 'text-cyan-400', bgColor: 'from-cyan-400/20 to-cyan-500/20' },
        { label: 'Worst Day', value: '-', change: 'N/A', positive: false, icon: BarChart3, color: 'text-gray-500', bgColor: 'from-gray-400/20 to-gray-500/20' },
      ],
      chartPath: 'M0,80 Q60,70 120,60 T240,50 T360,35 T400,30',
    },
    '1M': {
      stats: [
        { label: 'Total Value', value: formattedValue, change: '-', positive: true, icon: DollarSign, color: 'text-purple-400', bgColor: 'from-purple-400/20 to-purple-500/20' },
        { label: 'Month Change', value: '-', change: 'N/A', positive: true, icon: TrendingUp, color: 'text-green-500', bgColor: 'from-green-400/20 to-green-500/20' },
        { label: 'Best Week', value: '-', change: 'N/A', positive: true, icon: LineChart, color: 'text-cyan-400', bgColor: 'from-cyan-400/20 to-cyan-500/20' },
        { label: 'Worst Week', value: '-', change: 'N/A', positive: false, icon: BarChart3, color: 'text-red-500', bgColor: 'from-red-400/20 to-red-500/20' },
      ],
      chartPath: 'M0,85 Q40,75 80,65 T160,55 T240,40 T320,30 T400,20',
    },
    '3M': {
      stats: [
        { label: 'Total Value', value: formattedValue, change: '-', positive: true, icon: DollarSign, color: 'text-purple-400', bgColor: 'from-purple-400/20 to-purple-500/20' },
        { label: 'Quarter Change', value: '-', change: 'N/A', positive: true, icon: TrendingUp, color: 'text-green-500', bgColor: 'from-green-400/20 to-green-500/20' },
        { label: 'Best Month', value: '-', change: 'N/A', positive: true, icon: LineChart, color: 'text-cyan-400', bgColor: 'from-cyan-400/20 to-cyan-500/20' },
        { label: 'Worst Month', value: '-', change: 'N/A', positive: false, icon: BarChart3, color: 'text-gray-500', bgColor: 'from-gray-400/20 to-gray-500/20' },
      ],
      chartPath: 'M0,90 Q50,85 100,70 T200,55 T300,35 T400,15',
    },
    'ALL': {
      stats: [
        { label: 'Total Value', value: formattedValue, change: '-', positive: true, icon: DollarSign, color: 'text-purple-400', bgColor: 'from-purple-400/20 to-purple-500/20' },
        { label: 'All Time PnL', value: '-', change: 'N/A', positive: true, icon: TrendingUp, color: 'text-green-500', bgColor: 'from-green-400/20 to-green-500/20' },
        { label: 'Max Drawdown', value: '-', change: 'N/A', positive: false, icon: LineChart, color: 'text-gray-500', bgColor: 'from-gray-400/20 to-gray-500/20' },
        { label: 'Sharpe Ratio', value: '-', change: 'N/A', positive: true, icon: BarChart3, color: 'text-gray-400', bgColor: 'from-gray-400/20 to-gray-500/20' },
      ],
      chartPath: 'M0,95 Q40,90 80,80 T160,65 T240,45 T320,25 T400,10',
    },
  };

  const { stats, chartPath } = periodData[selectedPeriod];
  const periods = ['1D', '1W', '1M', '3M', 'ALL'];

  return (
    <Card variant="gradient" className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400/20 to-purple-500/20 flex items-center justify-center">
            <Diamond className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Portfolio Performance
            </h2>
            <p className="text-muted-foreground text-sm">Track your overall portfolio health</p>
          </div>
        </div>
        <div className="flex gap-1 bg-card/50 rounded-xl p-1">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                period === selectedPeriod
                  ? 'bg-gradient-to-r from-purple-500 to-green-600 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/80'
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-3 sm:p-4 rounded-xl bg-card/50 border border-border/50 hover:border-cyan-500/30 transition-all"
          >
            <div className="flex justify-center mb-2">
              <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center', stat.bgColor)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-lg sm:text-2xl font-bold text-foreground">{stat.value}</p>
            <p className={cn(
              'text-xs sm:text-sm font-medium flex items-center justify-center gap-1',
              stat.positive ? 'text-success' : 'text-danger'
            )}>
              {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {stat.change}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Mini Chart - Dynamic based on period */}
      <div className="mt-6">
        <svg className="w-full h-24" viewBox="0 0 400 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="portfolioGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(270, 100%, 65%)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(123, 93%, 53%)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(270, 100%, 65%)" />
              <stop offset="100%" stopColor="hsl(123, 93%, 53%)" />
            </linearGradient>
          </defs>
          <motion.path
            key={`line-${selectedPeriod}`}
            d={chartPath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5 }}
          />
          <motion.path
            key={`area-${selectedPeriod}`}
            d={`${chartPath} L400,100 L0,100 Z`}
            fill="url(#portfolioGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          />
        </svg>
      </div>
    </Card>
  );
}

// PnL History Section with Advanced UI
interface PnLData {
  date: string;
  pnl: number;
  cumulative: number;
}

function PnLHistorySection({ pnlHistory = [], selectedTimeframe = '30d', onTimeframeChange }: { pnlHistory?: PnLData[]; selectedTimeframe?: string; onTimeframeChange?: (tf: string) => void }) {
  const timeframes = [
    { id: '24h', label: '24 Hours' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '90d', label: '90 Days' },
    { id: 'all', label: 'All Time' },
  ];

  // Use provided data or show empty state
  const chartData = pnlHistory.length > 0 ? pnlHistory : [];
  const hasData = chartData.length > 0;

  const maxPnl = hasData ? Math.max(...chartData.map(d => Math.abs(d.pnl)), 1) : 100;
  const maxCumulative = hasData ? Math.max(...chartData.map(d => d.cumulative), 1) : 100;

  return (
    <div className="space-y-6">
      {/* Timeframe Selector with unique colors */}
      <div className="flex flex-wrap gap-2">
        {timeframes.map((tf) => {
          const colors: Record<string, { bg: string; text: string; border: string }> = {
            '24h': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
            '7d': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
            '30d': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
            '90d': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
            'all': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
          };
          const color = colors[tf.id] || colors['24h'];
          const isSelected = selectedTimeframe === tf.id;
          return (
            <button
              key={tf.id}
              onClick={() => onTimeframeChange?.(tf.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                isSelected
                  ? cn(color.bg, color.text, color.border)
                  : 'bg-card/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      {(() => {
        const totalProfit = chartData.filter(d => d.pnl > 0).reduce((sum, d) => sum + d.pnl, 0);
        const totalLoss = Math.abs(chartData.filter(d => d.pnl < 0).reduce((sum, d) => sum + d.pnl, 0));
        const winningDays = chartData.filter(d => d.pnl > 0).length;
        const winRate = chartData.length > 0 ? (winningDays / chartData.length) * 100 : 0;
        const netPnl = totalProfit - totalLoss;
        
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Total Profit</p>
              <p className="text-xl font-bold text-green-500">+${totalProfit.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Total Loss</p>
              <p className="text-xl font-bold text-red-500">-${totalLoss.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold text-foreground">{winRate.toFixed(1)}%</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-center">
              <BarChart3 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Net PnL</p>
              <p className={cn("text-xl font-bold", netPnl >= 0 ? "text-success" : "text-danger")}>
                {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Chart */}
      <Card variant="glass" className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <LineChart className="w-5 h-5 text-cyan-400" />
            PnL Over Time
          </h4>
          {hasData && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-r from-cyan-500 to-purple-500" />
                <span className="text-muted-foreground">Cumulative</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-success" />
                <span className="text-muted-foreground">Profit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-danger" />
                <span className="text-muted-foreground">Loss</span>
              </div>
            </div>
          )}
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LineChart className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No PnL data yet</p>
            <p className="text-sm text-muted-foreground/70">Your profit and loss history will appear here after trading</p>
          </div>
        ) : (
          /* Bar + Line Chart */
          <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted-foreground">
            <span>${maxCumulative}</span>
            <span>${Math.round(maxCumulative / 2)}</span>
            <span>$0</span>
          </div>
          
          {/* Chart area */}
          <div className="ml-14 h-full flex items-end gap-2">
            {chartData.map((data, index) => (
              <div key={data.date} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                {/* Cumulative line point */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                  className="absolute w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 border-2 border-background z-10 cursor-pointer"
                  style={{ 
                    bottom: `${(data.cumulative / maxCumulative) * 200 + 32}px`,
                  }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-card border border-border/50 rounded-lg p-2 text-xs whitespace-nowrap shadow-lg">
                      <p className="font-semibold">{data.date}</p>
                      <p className="text-cyan-400">Cumulative: ${data.cumulative}</p>
                      <p className={data.pnl >= 0 ? 'text-success' : 'text-danger'}>
                        Daily: {data.pnl >= 0 ? '+' : ''}${data.pnl}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Daily PnL bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(Math.abs(data.pnl) / maxPnl) * 100}px` }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className={cn(
                    'w-full max-w-[40px] rounded-t-lg cursor-pointer',
                    data.pnl >= 0 ? 'bg-success/60' : 'bg-danger/60'
                  )}
                />
                {/* X-axis label */}
                <p className="text-xs text-muted-foreground mt-2">{data.date}</p>
              </div>
            ))}
          </div>

          {/* Connecting line for cumulative */}
          <svg className="absolute ml-14 left-0 right-0 top-0 bottom-8 pointer-events-none" preserveAspectRatio="none">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              d={chartData.map((data, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - (data.cumulative / maxCumulative) * 85;
                return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
              }).join(' ')}
              fill="none"
              stroke="url(#cumulativeGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="cumulativeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(180, 100%, 50%)" />
                <stop offset="100%" stopColor="hsl(270, 100%, 65%)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        )}
      </Card>

      {/* Trade History Table */}
      <Card variant="glass" className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Recent Trades
          </h4>
          <Button variant="ghost" size="sm" className="text-cyan-400">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Pair</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">PnL</th>
              </tr>
            </thead>
            <tbody>
              {pnlHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No trades yet. Your trading history will appear here.
                  </td>
                </tr>
              ) : (
                pnlHistory.slice(0, 6).map((entry, i) => {
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border/30 hover:bg-card/50"
                    >
                      <td className="py-3 px-3 text-sm text-muted-foreground">{entry.date}</td>
                      <td className="py-3 px-3 text-sm font-medium text-foreground">-</td>
                      <td className="py-3 px-3">
                        <span className={cn('px-2 py-1 rounded-md text-xs font-medium', entry.pnl >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                          {entry.pnl >= 0 ? 'Profit' : 'Loss'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm text-right text-foreground">-</td>
                      <td className={cn('py-3 px-3 text-sm text-right font-medium', entry.pnl >= 0 ? 'text-success' : 'text-danger')}>
                        {entry.pnl >= 0 ? '+' : ''}${Math.abs(entry.pnl).toLocaleString()}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Coming Soon Features */}
      <Card variant="glass" className="p-6 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border-cyan-500/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">Advanced Analytics Coming Soon</h4>
            <p className="text-sm text-muted-foreground mb-4">
              We are building powerful analytics features including:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: PieChart, label: 'Position Sizing Analysis' },
                { icon: Target, label: 'Risk-Adjusted Returns' },
                { icon: BarChart3, label: 'Strategy Performance' },
                { icon: Activity, label: 'Real-time P&L Tracking' },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center gap-2 text-sm">
                  <feature.icon className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Main Portfolio Page Content
function PortfolioPageContent() {
  const { address, isConnected } = useAccount();
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({ 
    address,
    query: {
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });
  const [activeTab, setActiveTab] = useState('holdings');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  
  // Get ERC20 token balances for all MONAD_TOKENS (except native MON)
  const erc20Tokens = MONAD_TOKENS.filter(t => !t.isNative);
  
  const { data: tokenBalancesData, isLoading: isTokensLoading } = useReadContracts({
    contracts: erc20Tokens.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })),
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });
  
  // Get token prices from CoinGecko
  const tokenSymbols = MONAD_TOKENS.map(t => t.symbol);
  const { getPrice, getChange24h, isLoading: isPricesLoading } = useTokenPrices(tokenSymbols);
  
  // Calculate holdings from actual wallet data
  const holdings: TokenHolding[] = useMemo(() => {
    if (!isConnected || !address) return emptyHoldings;
    
    const result: TokenHolding[] = [];
    
    // Add native MON balance
    if (balanceData) {
      const monBalance = parseFloat(balanceData.formatted);
      if (monBalance > 0) {
        const monToken = MONAD_TOKENS.find(t => t.symbol === 'MON')!;
        const price = getPrice('MON');
        const change24h = getChange24h('MON');
        result.push({
          symbol: 'MON',
          name: monToken.name,
          address: monToken.address,
          balance: monBalance,
          formattedBalance: formatBalance(monBalance, monToken.decimals),
          value: monBalance * price,
          price,
          change24h,
          allocation: 0, // Will be calculated after all tokens
          icon: monToken.icon,
          decimals: monToken.decimals,
        });
      }
    }
    
    // Add ERC20 token balances
    if (tokenBalancesData) {
      erc20Tokens.forEach((token, index) => {
        const balanceResult = tokenBalancesData[index];
        if (balanceResult?.status === 'success' && balanceResult.result) {
          const rawBalance = balanceResult.result as bigint;
          const formattedBalance = parseFloat(formatUnits(rawBalance, token.decimals));
          
          if (formattedBalance > 0) {
            const price = getPrice(token.symbol);
            const tokenChange = getChange24h(token.symbol);
            result.push({
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              balance: formattedBalance,
              formattedBalance: formatBalance(formattedBalance, token.decimals),
              value: formattedBalance * price,
              price,
              change24h: tokenChange,
              allocation: 0,
              icon: token.icon,
              decimals: token.decimals,
            });
          }
        }
      });
    }
    
    // Calculate allocations
    const totalValue = result.reduce((sum, h) => sum + h.value, 0);
    if (totalValue > 0) {
      result.forEach(h => {
        h.allocation = Math.round((h.value / totalValue) * 100);
      });
    }
    
    // Sort by value descending
    return result.sort((a, b) => b.value - a.value);
  }, [isConnected, address, balanceData, tokenBalancesData, erc20Tokens, getPrice, getChange24h]);
  
  // Loading state
  const isLoading = isBalanceLoading || isTokensLoading || isPricesLoading;
  
  // Transactions - fetched from Monadscan Etherscan API
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    const fetchTransactions = async () => {
      setTxLoading(true);
      try {
        const response = await fetch(`/api/portfolio/transactions?address=${address}&page=1&offset=20`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setTransactions(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setTxLoading(false);
      }
    };

    fetchTransactions();
  }, [address]);
  
  // PnL History - fetched from portfolio API
  const [pnlHistory, setPnlHistory] = useState<{ date: string; pnl: number; cumulative: number }[]>([]);
  const [pnlPeriod, setPnlPeriod] = useState('30d');

  useEffect(() => {
    if (!address) return;

    const fetchPnlHistory = async () => {
      try {
        const response = await fetch(`/api/portfolio?address=${address}&period=${pnlPeriod}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.pnlHistory) {
            setPnlHistory(result.data.pnlHistory);
          }
        }
      } catch (error) {
        console.error('Failed to fetch PnL history:', error);
      }
    };

    fetchPnlHistory();
  }, [address, pnlPeriod]);

  const tabs = [
    { id: 'holdings', label: 'Holdings', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'history', label: 'PnL History', icon: LineChart },
  ];

  return (
    <DashboardLayout showFooter={false}>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2"
            >
              <SquareChartGantt className="w-7 h-7 text-cyan-500" />
              Portfolio
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground text-sm sm:text-base"
            >
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              ) : (
                'Manage your assets and track performance'
              )}
            </motion.p>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setWithdrawModalOpen(true)}
              className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-cyan-500"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Withdraw</span>
              <span className="sm:hidden">Out</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => setDepositModalOpen(true)}
              className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-cyan-500"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Deposit</span>
              <span className="sm:hidden">In</span>
            </Button>
          </div>
        </div>

        {/* Performance Summary */}
        <PerformanceSummary totalValue={holdings.reduce((sum, h) => sum + h.value, 0)} />

        {/* Allocation Chart + Quick Stats */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card variant="glass" className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400/20 to-cyan-500/20 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-cyan-400" />
              </div>
              Asset Allocation
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
              </div>
            ) : holdings.length > 0 ? (
              <AllocationChart holdings={holdings} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No assets found</p>
                <p className="text-sm text-muted-foreground/70">Connect wallet to view portfolio</p>
              </div>
            )}
          </Card>

          <Card variant="glass" className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400/20 to-purple-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Assets</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{holdings.length}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Best Performer</p>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-green-500">
                  {holdings.length > 0 ? (() => {
                    const best = holdings.reduce((b, h) => h.change24h > b.change24h ? h : b, holdings[0]);
                    return `${best.symbol} ${best.change24h >= 0 ? '+' : ''}${best.change24h.toFixed(1)}%`;
                  })() : '-'}
                </p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 border border-orange-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-orange-400" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Value</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  ${holdings.reduce((sum, h) => sum + h.value, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">PnL Entries</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{pnlHistory.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Holdings / Transactions / PnL History Tabs */}
        <Card variant="glass" className="p-4 sm:p-6">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <tab.icon className="w-4 h-4 mr-2 hidden sm:inline" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <AnimatePresence mode="wait">
            {activeTab === 'holdings' && (
              <motion.div
                key="holdings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground">Asset</th>
                        <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground">Balance</th>
                        <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground hidden sm:table-cell">Price</th>
                        <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground">24h</th>
                        <th className="py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground hidden md:table-cell">Allocation</th>
                        <th className="text-right py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        // Loading skeleton
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={`skeleton-${i}`} className="border-b border-border/30">
                            <td className="py-4 px-3 sm:px-4"><div className="flex items-center gap-2"><div className="w-10 h-10 bg-muted/20 rounded-lg animate-pulse" /><div className="h-4 w-20 bg-muted/20 rounded animate-pulse" /></div></td>
                            <td className="py-4 px-3 sm:px-4"><div className="h-4 w-16 bg-muted/20 rounded animate-pulse ml-auto" /></td>
                            <td className="py-4 px-3 sm:px-4 hidden sm:table-cell"><div className="h-4 w-12 bg-muted/20 rounded animate-pulse ml-auto" /></td>
                            <td className="py-4 px-3 sm:px-4"><div className="h-4 w-10 bg-muted/20 rounded animate-pulse ml-auto" /></td>
                            <td className="py-4 px-3 sm:px-4 hidden md:table-cell"><div className="h-2 w-full bg-muted/20 rounded animate-pulse" /></td>
                            <td className="py-4 px-3 sm:px-4"><div className="h-8 w-16 bg-muted/20 rounded animate-pulse ml-auto" /></td>
                          </tr>
                        ))
                      ) : holdings.length > 0 ? (
                        holdings.map((holding, index) => (
                          <HoldingRow key={holding.symbol} holding={holding} index={index} />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <Wallet className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                            <p className="text-muted-foreground">No holdings found</p>
                            <p className="text-sm text-muted-foreground/70">Connect your wallet to view assets</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'transactions' && (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4 space-y-2"
              >
                {txLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                    <p className="text-muted-foreground">Loading transactions from Monadscan...</p>
                  </div>
                ) : transactions.length > 0 ? (
                  transactions.map((tx, index) => (
                    <TransactionRow key={tx.id} tx={tx} index={index} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ArrowRightLeft className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No transactions yet</p>
                    <p className="text-sm text-muted-foreground/70">Your transaction history will appear here</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-4"
              >
                <PnLHistorySection pnlHistory={pnlHistory} selectedTimeframe={pnlPeriod} onTimeframeChange={setPnlPeriod} />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* Modals */}
      <TransferModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        type="deposit"
        holdings={holdings}
      />
      <TransferModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        type="withdraw"
        holdings={holdings}
      />
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function PortfolioPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback message="Loading portfolio..." />}>
        <PortfolioPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
