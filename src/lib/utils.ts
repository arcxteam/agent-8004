import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(
  value: number | string,
  options: Intl.NumberFormatOptions = {}
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(num);
}

export function formatCurrency(
  value: number | string,
  currency = 'USD',
  compact = false
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';

  if (compact && Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercentage(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`;
}

export function formatTokenAmount(
  amount: bigint | string,
  decimals = 18,
  displayDecimals = 4
): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const displayFractional = fractionalStr.slice(0, displayDecimals);
  
  return `${integerPart}.${displayFractional}`;
}

export function parseTokenAmount(amount: string, decimals = 18): bigint {
  const [integer, fractional = ''] = amount.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + paddedFractional);
}

export function timeAgo(date: Date | string | number): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateDeadline(minutes = 5): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

export function calculateSlippage(amountOut: bigint, slippageBps = BigInt(100)): bigint {
  return (amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000);
}

export function getExplorerUrl(
  hash: string,
  type: 'tx' | 'address' | 'token' = 'tx',
  network: 'testnet' | 'mainnet' = 'testnet'
): string {
  const baseUrl = network === 'mainnet' 
    ? 'https://monadscan.com' 
    : 'https://monadvision.com';
  
  const paths = {
    tx: 'tx',
    address: 'address',
    token: 'token',
  };
  
  return `${baseUrl}/${paths[type]}/${hash}`;
}
