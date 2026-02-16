'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';
import { usePortfolio, MONAD_TOKENS, Holding } from '@/hooks/usePortfolio';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { Loader2, ArrowDownUp, Settings, Shield, Lock } from 'lucide-react';

// Token data interface
interface TokenData {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  icon: string;
}

// Token selector component
function TokenSelector({
  value,
  onChange,
  tokens,
  label,
  amount,
  onAmountChange,
}: {
  value: string;
  onChange: (value: string) => void;
  tokens: TokenData[];
  label: string;
  amount: string;
  onAmountChange: (value: string) => void;
}) {
  const selectedToken = tokens.find((t) => t.symbol === value);
  const numericAmount = parseFloat(amount) || 0;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">{label}</span>
        {selectedToken && (
          <span className="text-xs text-white/40">
            Balance: {formatNumber(selectedToken.balance)} {selectedToken.symbol}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="text-2xl font-bold border-none bg-transparent p-0 h-auto"
        />
        <Select
          value={value}
          onChange={onChange}
          options={tokens.map((t) => ({
            value: t.symbol,
            label: `${t.symbol}`,
          }))}
          className="w-32"
        />
      </div>
      {selectedToken && (
        <div className="mt-2 text-xs text-white/40">
          ≈ {formatCurrency(selectedToken.price * numericAmount)}
        </div>
      )}
    </div>
  );
}

// Price chart placeholder
function PriceChart({ pair, price, change24h }: { pair: string; price: number; change24h: number }) {
  // Generate chart data based on current price and change
  const basePrice = price / (1 + change24h / 100);
  const chartData = React.useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 12; i++) {
      const progress = i / 11;
      const variance = (Math.random() - 0.5) * 0.02 * price;
      const value = basePrice + (price - basePrice) * progress + variance;
      points.push(Math.max(0, value));
    }
    return points;
  }, [price, basePrice]);

  const minPrice = Math.min(...chartData);
  const maxPrice = Math.max(...chartData);
  const priceRange = maxPrice - minPrice || 1;

  return (
    <Card variant="glass" className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {pair}
              <Badge variant={change24h >= 0 ? 'success' : 'warning'} size="sm">
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </Badge>
            </CardTitle>
            <div className="text-2xl font-bold text-white mt-1">{formatCurrency(price)}</div>
          </div>
          <div className="flex gap-2">
            {['1H', '4H', '1D', '1W', '1M'].map((period) => (
              <button
                key={period}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  period === '1D'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-64">
          {/* Chart area */}
          <svg className="w-full h-full" viewBox="0 0 400 200">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={change24h >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={change24h >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0, 50, 100, 150, 200].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}
            {/* Area fill */}
            <motion.path
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              d={`
                M 0 ${200 - ((chartData[0] - minPrice) / priceRange) * 180}
                ${chartData.map((d, i) => `L ${(i / (chartData.length - 1)) * 400} ${200 - ((d - minPrice) / priceRange) * 180}`).join(' ')}
                L 400 200
                L 0 200
                Z
              `}
              fill="url(#chartGradient)"
            />
            {/* Line */}
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              d={`
                M 0 ${200 - ((chartData[0] - minPrice) / priceRange) * 180}
                ${chartData.map((d, i) => `L ${(i / (chartData.length - 1)) * 400} ${200 - ((d - minPrice) / priceRange) * 180}`).join(' ')}
              `}
              fill="none"
              stroke={change24h >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'}
              strokeWidth="2"
            />
          </svg>
          {/* Time labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-white/40 pt-2">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Order book component - shows placeholder until DEX integration
function OrderBook({ currentPrice }: { currentPrice: number }) {
  // Generate dynamic order book based on current price
  const spread = currentPrice * 0.001; // 0.1% spread
  
  const asks = React.useMemo(() => [
    { price: currentPrice + spread * 5, amount: 12500, total: 15475 },
    { price: currentPrice + spread * 4, amount: 8750, total: 10824 },
    { price: currentPrice + spread * 3, amount: 15200, total: 18787 },
    { price: currentPrice + spread * 2, amount: 6300, total: 7781 },
    { price: currentPrice + spread, amount: 21000, total: 25914 },
  ], [currentPrice, spread]);

  const bids = React.useMemo(() => [
    { price: currentPrice - spread, amount: 18500, total: 22811 },
    { price: currentPrice - spread * 2, amount: 9200, total: 11334 },
    { price: currentPrice - spread * 3, amount: 14800, total: 18219 },
    { price: currentPrice - spread * 4, amount: 7600, total: 9348 },
    { price: currentPrice - spread * 5, amount: 25000, total: 30725 },
  ], [currentPrice, spread]);

  const maxTotal = Math.max(...[...asks, ...bids].map((o) => o.total));

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header */}
          <div className="flex justify-between text-xs text-white/40 mb-2 px-2">
            <span>Price</span>
            <span>Amount</span>
            <span>Total</span>
          </div>

          {/* Asks (sells) */}
          {[...asks].reverse().map((order, i) => (
            <div
              key={`ask-${i}`}
              className="relative flex justify-between text-sm py-1 px-2"
            >
              <div
                className="absolute inset-0 bg-red-500/10"
                style={{ width: `${(order.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-red-400">{order.price.toFixed(4)}</span>
              <span className="relative text-white/80">{formatNumber(order.amount)}</span>
              <span className="relative text-white/60">{formatNumber(order.total)}</span>
            </div>
          ))}

          {/* Spread */}
          <div className="flex justify-center py-2 border-y border-white/5">
            <span className="text-emerald-400 font-bold">{formatCurrency(currentPrice)}</span>
            <span className="text-white/40 text-xs ml-2">Spread: 0.1%</span>
          </div>

          {/* Bids (buys) */}
          {bids.map((order, i) => (
            <div
              key={`bid-${i}`}
              className="relative flex justify-between text-sm py-1 px-2"
            >
              <div
                className="absolute inset-0 bg-emerald-500/10"
                style={{ width: `${(order.total / maxTotal) * 100}%` }}
              />
              <span className="relative text-emerald-400">{order.price.toFixed(4)}</span>
              <span className="relative text-white/80">{formatNumber(order.amount)}</span>
              <span className="relative text-white/60">{formatNumber(order.total)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Recent trades component - shows simulated trades based on current price
function RecentTrades({ currentPrice }: { currentPrice: number }) {
  const trades = React.useMemo(() => {
    const now = new Date();
    const spread = currentPrice * 0.001;
    return [
      { type: 'buy', price: currentPrice + spread * 0.2, amount: 5000, time: new Date(now.getTime() - 4000).toLocaleTimeString() },
      { type: 'sell', price: currentPrice - spread * 0.1, amount: 3200, time: new Date(now.getTime() - 8000).toLocaleTimeString() },
      { type: 'buy', price: currentPrice + spread * 0.3, amount: 8500, time: new Date(now.getTime() - 12000).toLocaleTimeString() },
      { type: 'buy', price: currentPrice - spread * 0.05, amount: 2100, time: new Date(now.getTime() - 16000).toLocaleTimeString() },
      { type: 'sell', price: currentPrice - spread * 0.4, amount: 6700, time: new Date(now.getTime() - 20000).toLocaleTimeString() },
      { type: 'sell', price: currentPrice - spread * 0.5, amount: 4300, time: new Date(now.getTime() - 24000).toLocaleTimeString() },
      { type: 'buy', price: currentPrice + spread * 0.1, amount: 9200, time: new Date(now.getTime() - 28000).toLocaleTimeString() },
      { type: 'sell', price: currentPrice - spread * 0.6, amount: 1500, time: new Date(now.getTime() - 32000).toLocaleTimeString() },
    ];
  }, [currentPrice]);

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/40 mb-2 px-2">
            <span>Price</span>
            <span>Amount</span>
            <span>Time</span>
          </div>
          {trades.map((trade, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex justify-between text-sm py-1 px-2"
            >
              <span className={trade.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                {trade.price.toFixed(4)}
              </span>
              <span className="text-white/80">{formatNumber(trade.amount)}</span>
              <span className="text-white/40">{trade.time}</span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Swap form component
function SwapForm({ tokens, isLoadingPrices }: { tokens: TokenData[]; isLoadingPrices: boolean }) {
  const [fromToken, setFromToken] = React.useState('MON');
  const [toToken, setToToken] = React.useState('USDC');
  const [fromAmount, setFromAmount] = React.useState('');
  const [toAmount, setToAmount] = React.useState('');
  const [slippage, setSlippage] = React.useState('0.5');
  const [isSwapping, setIsSwapping] = React.useState(false);
  const [swapResult, setSwapResult] = React.useState<{
    success: boolean;
    txHash?: string;
    amountOut?: string;
    pnlUsd?: string;
    error?: string;
  } | null>(null);

  // Calculate exchange rate based on token prices
  const fromTokenData = tokens.find(t => t.symbol === fromToken);
  const toTokenData = tokens.find(t => t.symbol === toToken);
  const exchangeRate = fromTokenData && toTokenData && toTokenData.price > 0
    ? fromTokenData.price / toTokenData.price
    : 0;

  // Auto-calculate toAmount when fromAmount changes
  React.useEffect(() => {
    if (fromAmount && exchangeRate > 0) {
      const calculated = parseFloat(fromAmount) * exchangeRate;
      setToAmount(calculated.toFixed(6));
    } else {
      setToAmount('');
    }
  }, [fromAmount, exchangeRate]);

  // Trading DISABLED — under security audit, wallet integration pending
  const handleSwap = async () => {
    setSwapResult({
      success: false,
      error: 'Trading terminal is under integration. This feature will be enabled after the security audit is complete.',
    });
  };

  const handleFlip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Swap
            {isLoadingPrices && <Loader2 className="w-4 h-4 animate-spin text-primary-400" />}
          </CardTitle>
          <Tooltip content="Settings">
            <button className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* From */}
          <TokenSelector
            value={fromToken}
            onChange={setFromToken}
            tokens={tokens}
            label="You pay"
            amount={fromAmount}
            onAmountChange={setFromAmount}
          />

          {/* Flip button */}
          <div className="flex justify-center -my-1 relative z-10">
            <motion.button
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleFlip}
              className="w-10 h-10 rounded-full bg-bg-primary border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <ArrowDownUp className="w-5 h-5" />
            </motion.button>
          </div>

          {/* To */}
          <TokenSelector
            value={toToken}
            onChange={setToToken}
            tokens={tokens}
            label="You receive"
            amount={toAmount}
            onAmountChange={setToAmount}
          />

          {/* Slippage */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-sm">
            <span className="text-white/60">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {['0.1', '0.5', '1.0'].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    slippage === val
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-white/40 hover:text-white/60'
                  )}
                >
                  {val}%
                </button>
              ))}
              <Input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-16 h-7 text-xs text-center"
                suffix="%"
              />
            </div>
          </div>

          {/* Route info */}
          <div className="p-3 bg-white/5 rounded-xl space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Rate</span>
              <span className="text-white">
                1 {fromToken} = {exchangeRate > 0 ? exchangeRate.toFixed(6) : '...'} {toToken}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Price Impact</span>
              <span className="text-emerald-400">&lt;0.01%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Estimated Gas</span>
              <span className="text-white">~$0.12</span>
            </div>
          </div>

          {/* Swap button */}
          <Button
            onClick={handleSwap}
            className="w-full"
            size="lg"
            disabled={isSwapping || !fromAmount || parseFloat(fromAmount) <= 0}
          >
            {isSwapping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executing Trade...
              </>
            ) : (
              'Swap'
            )}
          </Button>

          {/* Swap result feedback */}
          {swapResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              swapResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {swapResult.success ? (
                <div className="space-y-1">
                  <p>Trade executed successfully</p>
                  {swapResult.amountOut && (
                    <p className="text-xs text-white/60">Amount out: {swapResult.amountOut}</p>
                  )}
                  {swapResult.txHash && (
                    <p className="text-xs text-white/40 font-mono truncate">
                      Tx: {swapResult.txHash}
                    </p>
                  )}
                </div>
              ) : (
                <p>{swapResult.error || 'Trade failed'}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main trading page content
function TradingPageContent() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = React.useState('swap');
  
  // Get real portfolio data
  const { holdings, isLoading: isPortfolioLoading } = usePortfolio();
  
  // Get real token prices
  const tokenSymbols = MONAD_TOKENS.map(t => t.symbol);
  const { prices, isLoading: isPricesLoading } = useTokenPrices(tokenSymbols);
  
  // Build tokens array with real data
  const tokens: TokenData[] = React.useMemo(() => {
    return MONAD_TOKENS.map(token => {
      const holding = holdings.find(h => h.symbol === token.symbol);
      const priceData = prices[token.symbol];
      return {
        symbol: token.symbol,
        name: token.name,
        balance: holding?.balanceRaw || 0,
        price: priceData?.priceUsd || 1.0,
        icon: token.icon,
      };
    });
  }, [holdings, prices]);
  
  // Get MON price and change for chart
  const monPrice = prices['MON']?.priceUsd || 1.0;
  const monChange = prices['MON']?.change24h || 0;

  return (
    <DashboardLayout showFooter={false}>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white"
          >
            Trading
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/60 mt-1"
          >
            Trade tokens on Monad&apos;s fastest DEX
          </motion.p>
        </div>

        {/* Trading interface — Coming Soon overlay with visible content behind */}
        <div className="relative min-h-[600px]">
          {/* Coming Soon Overlay — light blur, content visible underneath */}
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm bg-black/30 rounded-2xl border border-white/10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center px-6 bg-black/50 rounded-2xl py-8 backdrop-blur-md border border-white/10 shadow-2xl"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-6">
                <Shield className="w-10 h-10 text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-500 to-green-500 bg-clip-text text-transparent">Trading Terminal</h2>
              <Badge variant="warning" size="sm" className="mb-4 bg-gradient-to-r from-purple-500 to-green-500 bg-clip-text text-transparent">Coming Soon</Badge>
              <p className="text-red/60 max-w-md text-sm leading-relaxed mb-4">
                The trading terminal is currently under integration and security testing.
                It will be activated after the features integration and security audit is complete.
              </p>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Internal audit required before activation</span>
              </div>
            </motion.div>
          </div>

          {/* Underlying content (visible but non-interactive) */}
          <div className="pointer-events-none select-none">
            {/* Trading tabs */}
            <Tabs value={activeTab} onChange={setActiveTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="swap">Swap</TabsTrigger>
                <TabsTrigger value="limit">Limit Order</TabsTrigger>
                <TabsTrigger value="pool">Liquidity</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Chart */}
          <div className="lg:col-span-2">
            <PriceChart pair="MON/USDC" price={monPrice} change24h={monChange} />
          </div>

          {/* Right column - Swap form */}
          <div className="lg:col-span-1">
            <SwapForm tokens={tokens} isLoadingPrices={isPricesLoading} />
          </div>

          {/* Order Book */}
          <div className="lg:col-span-1">
            <OrderBook currentPrice={monPrice} />
          </div>

          {/* Recent Trades */}
          <div className="lg:col-span-1">
            <RecentTrades currentPrice={monPrice} />
          </div>

          {/* Open positions */}
          <Card variant="glass" className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Your Positions</CardTitle>
            </CardHeader>
            <CardContent>
              {isConnected ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <p className="text-white/60 text-sm">No open positions</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60 text-sm mb-3">Connect wallet to view positions</p>
                  <Button variant="secondary" size="sm">Connect</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </div>{/* end pointer-events-none */}
        </div>{/* end relative wrapper */}
      </div>
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function TradingPage() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageLoadingFallback message="Loading trading..." />}>
        <TradingPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
