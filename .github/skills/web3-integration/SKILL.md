---
name: web3-integration
description: Advanced Web3 frontend integration using wagmi, viem, RainbowKit, and ethers.js. Use for wallet connections, contract interactions, transaction handling, ENS resolution, and blockchain data fetching in React/Next.js applications.
---

# Web3 Frontend Integration

## Stack Overview

- **wagmi** - React hooks for Ethereum
- **viem** - TypeScript Ethereum library
- **RainbowKit** - Wallet connection UI
- **@tanstack/react-query** - Data fetching

## Project Setup

```bash
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query
```

## Configuration

```typescript
// config/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, arbitrum, optimism, base } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'AI Agent Platform',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID!,
  chains: [mainnet, sepolia, polygon, arbitrum, optimism, base],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
    [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
    [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
    [optimism.id]: http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
  },
  ssr: true,
});
```

## Provider Setup

```typescript
// providers/Web3Provider.tsx
'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7c3aed',
            accentColorForeground: 'white',
            borderRadius: 'large',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Contract Hooks

```typescript
// hooks/useAgentRegistry.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { AGENT_REGISTRY_ABI, AGENT_REGISTRY_ADDRESS } from '@/config/contracts';

export function useRegisterAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const registerAgent = async (metadata: string) => {
    writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [metadata],
    });
  };

  return {
    registerAgent,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useAgentTrustScore(agentId: `0x${string}`) {
  return useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getTrustScore',
    args: [agentId],
    query: {
      enabled: !!agentId,
      refetchInterval: 10000,
    },
  });
}

export function useDelegateCapital() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const delegate = async (agentId: `0x${string}`, amount: string) => {
    writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'delegateCapital',
      args: [agentId, parseEther(amount)],
      value: parseEther(amount),
    });
  };

  return { delegate, hash, isPending, isConfirming, isSuccess };
}

export function useAgentStats(agentId: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAgentStats',
    args: [agentId],
  });

  return {
    stats: data ? {
      trustScore: Number(data[0]),
      totalCapital: formatEther(data[1]),
      successRate: Number(data[2]),
      totalStrategies: Number(data[3]),
    } : null,
    isLoading,
    error,
    refetch,
  };
}
```

## Wallet Connection Component

```typescript
// components/ConnectWallet.tsx
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useEnsName, useEnsAvatar } from 'wagmi';
import { formatEther } from 'viem';

export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 
                               text-white rounded-xl font-semibold hover:opacity-90 
                               transition-all shadow-lg shadow-violet-500/25"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-3">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 
                               backdrop-blur-lg rounded-xl border border-white/20"
                  >
                    {chain.hasIcon && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name ?? 'Chain'}
                        className="w-5 h-5"
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 
                               backdrop-blur-lg rounded-xl border border-white/20"
                  >
                    {account.displayName}
                    {account.displayBalance && (
                      <span className="text-white/60">
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
```

## Transaction Handler

```typescript
// hooks/useTransaction.ts
import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, encodeFunctionData, type Hash } from 'viem';
import { toast } from 'sonner';

interface TransactionConfig {
  to: `0x${string}`;
  value?: bigint;
  data?: `0x${string}`;
}

export function useTransaction() {
  const [hash, setHash] = useState<Hash | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const sendTransaction = useCallback(async (config: TransactionConfig) => {
    if (!walletClient || !publicClient) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      setIsPending(true);
      setError(null);
      setIsSuccess(false);

      const hash = await walletClient.sendTransaction({
        to: config.to,
        value: config.value ?? 0n,
        data: config.data,
      });

      setHash(hash);
      setIsPending(false);
      setIsConfirming(true);

      toast.loading('Transaction pending...', { id: hash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsSuccess(true);
        toast.success('Transaction confirmed!', { id: hash });
      } else {
        throw new Error('Transaction failed');
      }

      setIsConfirming(false);
      return receipt;
    } catch (err) {
      setError(err as Error);
      setIsPending(false);
      setIsConfirming(false);
      toast.error((err as Error).message, { id: hash ?? 'error' });
      throw err;
    }
  }, [walletClient, publicClient]);

  const reset = useCallback(() => {
    setHash(null);
    setIsPending(false);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    sendTransaction,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
```

## Event Listener Hook

```typescript
// hooks/useContractEvents.ts
import { useEffect, useState } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { AGENT_REGISTRY_ABI, AGENT_REGISTRY_ADDRESS } from '@/config/contracts';

interface AgentEvent {
  agentId: `0x${string}`;
  owner: `0x${string}`;
  metadata: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export function useAgentEvents() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const publicClient = usePublicClient();

  // Watch for new events
  useWatchContractEvent({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    eventName: 'AgentRegistered',
    onLogs(logs) {
      const newEvents = logs.map(log => ({
        agentId: log.args.agentId!,
        owner: log.args.owner!,
        metadata: log.args.metadata!,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));
      setEvents(prev => [...newEvents, ...prev]);
    },
  });

  // Fetch historical events
  useEffect(() => {
    async function fetchHistoricalEvents() {
      if (!publicClient) return;

      const logs = await publicClient.getContractEvents({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        eventName: 'AgentRegistered',
        fromBlock: 'earliest',
      });

      const historicalEvents = logs.map(log => ({
        agentId: log.args.agentId!,
        owner: log.args.owner!,
        metadata: log.args.metadata!,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }));

      setEvents(historicalEvents.reverse());
    }

    fetchHistoricalEvents();
  }, [publicClient]);

  return events;
}
```

## Multi-Chain Support

```typescript
// hooks/useMultiChain.ts
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains';

const SUPPORTED_CHAINS = [mainnet, polygon, arbitrum, optimism, base];

export function useMultiChain() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { isConnected } = useAccount();

  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  const isSupported = !!currentChain;

  const switchToChain = async (targetChainId: number) => {
    if (!isConnected) return;
    switchChain({ chainId: targetChainId });
  };

  return {
    currentChain,
    chainId,
    isSupported,
    supportedChains: SUPPORTED_CHAINS,
    switchToChain,
    isSwitching: isPending,
  };
}
```

## Contract ABI Type Generation

```typescript
// Generate types from ABI
// Run: npx wagmi generate

// wagmi.config.ts
import { defineConfig } from '@wagmi/cli';
import { foundry, react } from '@wagmi/cli/plugins';

export default defineConfig({
  out: 'src/generated.ts',
  contracts: [],
  plugins: [
    foundry({
      project: '../contracts',
      include: ['ERC8004*.sol/**'],
    }),
    react(),
  ],
});
```

## Best Practices

1. **Always handle pending states** - Show loading indicators
2. **Implement proper error handling** - User-friendly error messages
3. **Use optimistic updates** - Better UX with react-query
4. **Cache contract reads** - Reduce RPC calls
5. **Support multiple chains** - Use chain-specific contracts
6. **Handle wallet disconnections** - Graceful state reset
