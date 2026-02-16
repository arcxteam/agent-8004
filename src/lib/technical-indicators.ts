/**
 * Technical Indicators Module — ANOA Trading Agent
 *
 * Pure TypeScript computation of trading indicators from OHLCV candle data.
 * Inspired by TradingAgents framework (multi-analyst pattern).
 *
 * Indicators:
 *   - SMA (Simple Moving Average) — 10, 50 period
 *   - EMA (Exponential Moving Average) — 10 period
 *   - RSI (Relative Strength Index) — 14 period
 *   - MACD (Moving Average Convergence Divergence) — 12/26/9
 *   - Bollinger Bands — 20 period, 2 std dev
 *   - ATR (Average True Range) — 14 period
 *   - VWMA (Volume Weighted Moving Average) — 20 period
 *
 * All functions work with arrays of candles (oldest first).
 * Returns NaN/null for insufficient data rather than wrong values.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalReport {
  // Price context
  currentPrice: number;
  priceChange1h: number | null;   // % change over last ~12 candles (5m resolution)
  priceChange4h: number | null;   // % change over last ~48 candles

  // Moving Averages
  sma10: number | null;
  sma50: number | null;
  ema10: number | null;

  // Trend signals
  priceVsSma10: string;   // 'above' | 'below' | 'n/a'
  priceVsSma50: string;
  emaSmaCrossover: string; // 'bullish' | 'bearish' | 'n/a'

  // Momentum
  rsi14: number | null;
  rsiSignal: string;  // 'overbought' | 'oversold' | 'neutral' | 'n/a'
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdTrend: string;  // 'bullish' | 'bearish' | 'n/a'

  // Volatility
  bollUpper: number | null;
  bollMiddle: number | null;
  bollLower: number | null;
  bollPosition: string;  // 'above_upper' | 'near_upper' | 'middle' | 'near_lower' | 'below_lower' | 'n/a'
  atr14: number | null;
  atrPercent: number | null; // ATR as % of current price

  // Volume
  vwma20: number | null;
  volumeTrend: string;  // 'increasing' | 'decreasing' | 'stable' | 'n/a'

  // Summary
  bullishSignals: string[];
  bearishSignals: string[];
  overallBias: string;  // 'bullish' | 'bearish' | 'neutral'
  confidence: number;   // 0-100 based on signal agreement
}

// ─── Core Calculations ──────────────────────────────────────────────────────

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with SMA
  let emaCurrent = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaCurrent = values[i] * k + emaCurrent * (1 - k);
  }
  return emaCurrent;
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function computeMACD(closes: number[]): {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
} {
  if (closes.length < 26) return { macd: null, signal: null, histogram: null };

  // EMA 12 and EMA 26
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  if (ema12 === null || ema26 === null) return { macd: null, signal: null, histogram: null };

  // Full MACD line series for signal computation
  const k12 = 2 / 13;
  const k26 = 2 / 27;

  let ema12val = closes.slice(0, 12).reduce((s, v) => s + v, 0) / 12;
  let ema26val = closes.slice(0, 26).reduce((s, v) => s + v, 0) / 26;

  const macdLine: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < 12) {
      // Building EMA12
    } else if (i < 26) {
      ema12val = closes[i] * k12 + ema12val * (1 - k12);
    } else {
      if (i === 26) {
        // Reset for proper computation
        ema12val = closes.slice(0, 12).reduce((s, v) => s + v, 0) / 12;
        for (let j = 12; j <= i; j++) {
          ema12val = closes[j] * k12 + ema12val * (1 - k12);
        }
        ema26val = closes.slice(0, 26).reduce((s, v) => s + v, 0) / 26;
        ema26val = closes[i] * k26 + ema26val * (1 - k26);
      } else {
        ema12val = closes[i] * k12 + ema12val * (1 - k12);
        ema26val = closes[i] * k26 + ema26val * (1 - k26);
      }
      macdLine.push(ema12val - ema26val);
    }
  }

  if (macdLine.length === 0) return { macd: null, signal: null, histogram: null };

  const macdVal = macdLine[macdLine.length - 1];

  // Signal line = EMA(9) of MACD line
  let signalVal: number | null = null;
  if (macdLine.length >= 9) {
    signalVal = ema(macdLine, 9);
  }

  return {
    macd: macdVal,
    signal: signalVal,
    histogram: signalVal !== null ? macdVal - signalVal : null,
  };
}

function computeBollinger(closes: number[], period = 20, multiplier = 2): {
  upper: number | null;
  middle: number | null;
  lower: number | null;
} {
  const middle = sma(closes, period);
  if (middle === null) return { upper: null, middle: null, lower: null };

  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + multiplier * stdDev,
    middle,
    lower: middle - multiplier * stdDev,
  };
}

function computeATR(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  // Initial ATR = SMA of first `period` TRs
  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  // Smoothed ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

function computeVWMA(candles: Candle[], period = 20): number | null {
  if (candles.length < period) return null;

  const slice = candles.slice(-period);
  let sumPriceVol = 0;
  let sumVol = 0;
  for (const c of slice) {
    sumPriceVol += c.close * c.volume;
    sumVol += c.volume;
  }

  return sumVol > 0 ? sumPriceVol / sumVol : null;
}

// ─── Volume Trend ───────────────────────────────────────────────────────────

function analyzeVolumeTrend(candles: Candle[]): string {
  if (candles.length < 10) return 'n/a';

  const recentVol = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
  const olderVol = candles.slice(-10, -5).reduce((s, c) => s + c.volume, 0) / 5;

  if (olderVol === 0) return 'n/a';
  const ratio = recentVol / olderVol;

  if (ratio > 1.3) return 'increasing';
  if (ratio < 0.7) return 'decreasing';
  return 'stable';
}

// ─── Main Analysis Function ─────────────────────────────────────────────────

/**
 * Generate a comprehensive technical analysis report from OHLCV candles.
 * Candles should be in chronological order (oldest first), 5m resolution preferred.
 * Minimum 30 candles for basic analysis, 60+ for full indicators.
 */
export function analyzeTechnical(candles: Candle[]): TechnicalReport {
  const closes = candles.map(c => c.close);
  const currentPrice = closes.length > 0 ? closes[closes.length - 1] : 0;

  // Price changes
  let priceChange1h: number | null = null;
  let priceChange4h: number | null = null;
  if (closes.length >= 12) {
    const prev1h = closes[closes.length - 12];
    priceChange1h = prev1h > 0 ? ((currentPrice - prev1h) / prev1h) * 100 : null;
  }
  if (closes.length >= 48) {
    const prev4h = closes[closes.length - 48];
    priceChange4h = prev4h > 0 ? ((currentPrice - prev4h) / prev4h) * 100 : null;
  }

  // Moving Averages
  const sma10val = sma(closes, 10);
  const sma50val = sma(closes, 50);
  const ema10val = ema(closes, 10);

  // RSI
  const rsi14 = computeRSI(closes, 14);

  // MACD
  const macdResult = computeMACD(closes);

  // Bollinger Bands
  const boll = computeBollinger(closes, 20, 2);

  // ATR
  const atr14 = computeATR(candles, 14);

  // VWMA
  const vwma20 = computeVWMA(candles, 20);

  // Volume trend
  const volumeTrend = analyzeVolumeTrend(candles);

  // ── Derived Signals ──

  const priceVsSma10 = sma10val !== null
    ? (currentPrice > sma10val ? 'above' : 'below') : 'n/a';

  const priceVsSma50 = sma50val !== null
    ? (currentPrice > sma50val ? 'above' : 'below') : 'n/a';

  const emaSmaCrossover = (ema10val !== null && sma50val !== null)
    ? (ema10val > sma50val ? 'bullish' : 'bearish') : 'n/a';

  const rsiSignal = rsi14 !== null
    ? (rsi14 > 70 ? 'overbought' : rsi14 < 30 ? 'oversold' : 'neutral') : 'n/a';

  const macdTrend = macdResult.histogram !== null
    ? (macdResult.histogram > 0 ? 'bullish' : 'bearish') : 'n/a';

  let bollPosition = 'n/a';
  if (boll.upper !== null && boll.lower !== null && boll.middle !== null) {
    if (currentPrice > boll.upper) bollPosition = 'above_upper';
    else if (currentPrice > boll.middle + (boll.upper - boll.middle) * 0.7) bollPosition = 'near_upper';
    else if (currentPrice < boll.lower) bollPosition = 'below_lower';
    else if (currentPrice < boll.middle - (boll.middle - boll.lower) * 0.7) bollPosition = 'near_lower';
    else bollPosition = 'middle';
  }

  const atrPercent = (atr14 !== null && currentPrice > 0)
    ? (atr14 / currentPrice) * 100 : null;

  // ── Bull/Bear Signal Collection ──

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];

  // SMA signals
  if (priceVsSma10 === 'above') bullishSignals.push('Price above SMA(10) — short-term uptrend');
  if (priceVsSma10 === 'below') bearishSignals.push('Price below SMA(10) — short-term downtrend');
  if (priceVsSma50 === 'above') bullishSignals.push('Price above SMA(50) — medium-term uptrend');
  if (priceVsSma50 === 'below') bearishSignals.push('Price below SMA(50) — medium-term downtrend');

  // EMA/SMA crossover
  if (emaSmaCrossover === 'bullish') bullishSignals.push('EMA(10) above SMA(50) — bullish crossover');
  if (emaSmaCrossover === 'bearish') bearishSignals.push('EMA(10) below SMA(50) — bearish crossover');

  // RSI
  if (rsi14 !== null) {
    if (rsi14 > 70) bearishSignals.push(`RSI(14) at ${rsi14.toFixed(0)} — overbought, reversal risk`);
    else if (rsi14 > 60) bullishSignals.push(`RSI(14) at ${rsi14.toFixed(0)} — bullish momentum`);
    else if (rsi14 < 30) bullishSignals.push(`RSI(14) at ${rsi14.toFixed(0)} — oversold, bounce potential`);
    else if (rsi14 < 40) bearishSignals.push(`RSI(14) at ${rsi14.toFixed(0)} — weak momentum`);
  }

  // MACD
  if (macdTrend === 'bullish') bullishSignals.push('MACD histogram positive — upward momentum');
  if (macdTrend === 'bearish') bearishSignals.push('MACD histogram negative — downward momentum');

  // Bollinger
  if (bollPosition === 'below_lower') bullishSignals.push('Price below lower Bollinger — oversold bounce potential');
  if (bollPosition === 'near_lower') bullishSignals.push('Price near lower Bollinger — support zone');
  if (bollPosition === 'above_upper') bearishSignals.push('Price above upper Bollinger — overbought');
  if (bollPosition === 'near_upper') bearishSignals.push('Price near upper Bollinger — resistance zone');

  // Volume
  if (volumeTrend === 'increasing' && priceChange1h !== null && priceChange1h > 0) {
    bullishSignals.push('Rising volume with rising price — strong trend');
  }
  if (volumeTrend === 'increasing' && priceChange1h !== null && priceChange1h < 0) {
    bearishSignals.push('Rising volume with falling price — selling pressure');
  }
  if (volumeTrend === 'decreasing') {
    bearishSignals.push('Declining volume — trend may be weakening');
  }

  // ATR volatility warning
  if (atrPercent !== null && atrPercent > 10) {
    bearishSignals.push(`High volatility: ATR ${atrPercent.toFixed(1)}% of price — increased risk`);
  }

  // ── Overall Bias ──
  const bullCount = bullishSignals.length;
  const bearCount = bearishSignals.length;
  const totalSignals = bullCount + bearCount;

  let overallBias: string;
  let confidence: number;

  if (totalSignals === 0) {
    overallBias = 'neutral';
    confidence = 50;
  } else {
    const ratio = bullCount / totalSignals;
    if (ratio > 0.65) {
      overallBias = 'bullish';
      confidence = Math.min(90, Math.round(50 + ratio * 40));
    } else if (ratio < 0.35) {
      overallBias = 'bearish';
      confidence = Math.min(90, Math.round(50 + (1 - ratio) * 40));
    } else {
      overallBias = 'neutral';
      confidence = Math.round(40 + Math.abs(ratio - 0.5) * 60);
    }
  }

  return {
    currentPrice,
    priceChange1h,
    priceChange4h,
    sma10: sma10val,
    sma50: sma50val,
    ema10: ema10val,
    priceVsSma10,
    priceVsSma50,
    emaSmaCrossover,
    rsi14,
    rsiSignal,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    macdTrend,
    bollUpper: boll.upper,
    bollMiddle: boll.middle,
    bollLower: boll.lower,
    bollPosition,
    atr14,
    atrPercent,
    vwma20,
    volumeTrend,
    bullishSignals,
    bearishSignals,
    overallBias,
    confidence,
  };
}

/**
 * Format technical report as a readable string for AI consumption.
 */
export function formatTechnicalReport(report: TechnicalReport, symbol: string): string {
  const lines: string[] = [];

  lines.push(`═══ Technical Analysis: ${symbol} ═══`);
  lines.push(`Current Price: $${report.currentPrice.toFixed(6)}`);
  if (report.priceChange1h !== null) lines.push(`1h Change: ${report.priceChange1h > 0 ? '+' : ''}${report.priceChange1h.toFixed(2)}%`);
  if (report.priceChange4h !== null) lines.push(`4h Change: ${report.priceChange4h > 0 ? '+' : ''}${report.priceChange4h.toFixed(2)}%`);

  lines.push('');
  lines.push('── Moving Averages ──');
  if (report.sma10 !== null) lines.push(`SMA(10): $${report.sma10.toFixed(6)} — Price ${report.priceVsSma10}`);
  if (report.sma50 !== null) lines.push(`SMA(50): $${report.sma50.toFixed(6)} — Price ${report.priceVsSma50}`);
  if (report.ema10 !== null) lines.push(`EMA(10): $${report.ema10.toFixed(6)} — EMA/SMA crossover: ${report.emaSmaCrossover}`);

  lines.push('');
  lines.push('── Momentum ──');
  if (report.rsi14 !== null) lines.push(`RSI(14): ${report.rsi14.toFixed(1)} — ${report.rsiSignal}`);
  if (report.macd !== null) {
    lines.push(`MACD: ${report.macd.toFixed(6)}`);
    if (report.macdSignal !== null) lines.push(`MACD Signal: ${report.macdSignal.toFixed(6)}`);
    if (report.macdHistogram !== null) lines.push(`MACD Histogram: ${report.macdHistogram > 0 ? '+' : ''}${report.macdHistogram.toFixed(6)} — ${report.macdTrend}`);
  }

  lines.push('');
  lines.push('── Volatility ──');
  if (report.bollUpper !== null) {
    lines.push(`Bollinger Upper: $${report.bollUpper.toFixed(6)}`);
    lines.push(`Bollinger Middle: $${report.bollMiddle!.toFixed(6)}`);
    lines.push(`Bollinger Lower: $${report.bollLower!.toFixed(6)}`);
    lines.push(`Position: ${report.bollPosition}`);
  }
  if (report.atr14 !== null) {
    lines.push(`ATR(14): $${report.atr14.toFixed(6)} (${report.atrPercent!.toFixed(1)}% of price)`);
  }

  lines.push('');
  lines.push('── Volume ──');
  if (report.vwma20 !== null) lines.push(`VWMA(20): $${report.vwma20.toFixed(6)}`);
  lines.push(`Volume Trend: ${report.volumeTrend}`);

  lines.push('');
  lines.push('── Signal Summary ──');
  if (report.bullishSignals.length > 0) {
    lines.push(`BULLISH (${report.bullishSignals.length}):`);
    for (const s of report.bullishSignals) lines.push(`  + ${s}`);
  }
  if (report.bearishSignals.length > 0) {
    lines.push(`BEARISH (${report.bearishSignals.length}):`);
    for (const s of report.bearishSignals) lines.push(`  - ${s}`);
  }
  lines.push(`Overall Bias: ${report.overallBias.toUpperCase()} (confidence: ${report.confidence}%)`);

  return lines.join('\n');
}
