'use client';

import { WagmiProvider, type State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/config/wagmi';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import { useState, useEffect, type ReactNode } from 'react';

// Create AppKit instance
const metadata = {
  name: 'ANOA - Trustless AI Agents',
  description: 'ERC-8004 Trustless AI Agents on Monad Network',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://anoa.app',
  icons: ['/favicon.ico'],
};

// Initialize AppKit
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: networks[0],
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: false,
    emailShowWallets: true,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#8b5cf6',
    '--w3m-color-mix': '#8b5cf6',
    '--w3m-color-mix-strength': 20,
    '--w3m-border-radius-master': '2px',
    '--w3m-font-family': 'Inter, system-ui, sans-serif',
  },
  allWallets: 'SHOW',
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX
    '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // Safe
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // Rainbow
  ],
});

// Query client for React Query with improved retry strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      gcTime: 5 * 60 * 1000,
      networkMode: 'online',
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

// Prevent SSR issues with Web3
function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Use layout effect to set mounted as early as possible
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="animate-pulse text-purple-400">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

interface ProvidersProps {
  children: ReactNode;
  initialState?: State;
}

export function Providers({ children, initialState }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
        <QueryClientProvider client={queryClient}>
          <ClientOnly>
            {children}
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: '#1a1a24',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                },
              }}
            />
          </ClientOnly>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
