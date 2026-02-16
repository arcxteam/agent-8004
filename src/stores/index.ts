import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address } from 'viem';

// Types
interface Agent {
  id: string;
  address: string;
  name: string;
  strategy: string;
  status: string;
  trustScore: number;
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  totalDelegated: number;
}

interface TokenHolding {
  tokenAddress: string;
  symbol: string;
  name: string;
  balance: string;
  value: number;
  price: number;
}

interface Delegation {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Global App Store
interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  currency: string;
  
  // User State
  userAddress: Address | null;
  isConnected: boolean;
  portfolio: {
    totalValue: number;
    tokenHoldings: TokenHolding[];
    agents: Agent[];
    delegations: Delegation[];
  };
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Loading States
  isLoading: {
    portfolio: boolean;
    agents: boolean;
    trading: boolean;
  };
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCurrency: (currency: string) => void;
  setUserAddress: (address: Address | null) => void;
  setIsConnected: (connected: boolean) => void;
  setPortfolio: (portfolio: Partial<AppState['portfolio']>) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (key: keyof AppState['isLoading'], loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial UI State
      sidebarCollapsed: false,
      theme: 'dark',
      currency: 'USD',
      
      // Initial User State
      userAddress: null,
      isConnected: false,
      portfolio: {
        totalValue: 0,
        tokenHoldings: [],
        agents: [],
        delegations: [],
      },
      
      // Initial Notifications
      notifications: [],
      unreadCount: 0,
      
      // Initial Loading States
      isLoading: {
        portfolio: false,
        agents: false,
        trading: false,
      },
      
      // Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (typeof window !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }
        }
      },
      
      setCurrency: (currency) => set({ currency }),
      
      setUserAddress: (address) => set({ userAddress: address }),
      
      setIsConnected: (connected) => set({ isConnected: connected }),
      
      setPortfolio: (portfolio) => set((state) => ({
        portfolio: { ...state.portfolio, ...portfolio },
      })),
      
      addNotification: (notification) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          notifications: [
            {
              ...notification,
              id,
              timestamp: Date.now(),
              read: false,
            },
            ...state.notifications.slice(0, 49), // Keep max 50 notifications
          ],
          unreadCount: state.unreadCount + 1,
        }));
      },
      
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      })),
      
      clearNotifications: () => set({
        notifications: [],
        unreadCount: 0,
      }),
      
      setLoading: (key, loading) => set((state) => ({
        isLoading: { ...state.isLoading, [key]: loading },
      })),
    }),
    {
      name: 'monad-ai-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        currency: state.currency,
      }),
    }
  )
);

// Trading Store
interface TradingState {
  // Swap State
  tokenIn: { address: string; symbol: string; balance: string } | null;
  tokenOut: { address: string; symbol: string; balance: string } | null;
  amountIn: string;
  amountOut: string;
  slippage: number;
  
  // Quote State
  quote: {
    amountOut: string;
    priceImpact: number;
    route: string[];
  } | null;
  isQuoteLoading: boolean;
  
  // Transaction State
  txHash: string | null;
  txStatus: 'idle' | 'pending' | 'success' | 'error';
  txError: string | null;
  
  // Actions
  setTokenIn: (token: TradingState['tokenIn']) => void;
  setTokenOut: (token: TradingState['tokenOut']) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setSlippage: (slippage: number) => void;
  swapTokens: () => void;
  setQuote: (quote: TradingState['quote']) => void;
  setQuoteLoading: (loading: boolean) => void;
  setTxHash: (hash: string | null) => void;
  setTxStatus: (status: TradingState['txStatus']) => void;
  setTxError: (error: string | null) => void;
  resetTrade: () => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  // Initial State
  tokenIn: null,
  tokenOut: null,
  amountIn: '',
  amountOut: '',
  slippage: 0.5,
  quote: null,
  isQuoteLoading: false,
  txHash: null,
  txStatus: 'idle',
  txError: null,
  
  // Actions
  setTokenIn: (token) => set({ tokenIn: token }),
  setTokenOut: (token) => set({ tokenOut: token }),
  setAmountIn: (amount) => set({ amountIn: amount }),
  setAmountOut: (amount) => set({ amountOut: amount }),
  setSlippage: (slippage) => set({ slippage }),
  
  swapTokens: () => {
    const { tokenIn, tokenOut, amountIn, amountOut } = get();
    set({
      tokenIn: tokenOut,
      tokenOut: tokenIn,
      amountIn: amountOut,
      amountOut: amountIn,
    });
  },
  
  setQuote: (quote) => set({ quote }),
  setQuoteLoading: (loading) => set({ isQuoteLoading: loading }),
  setTxHash: (hash) => set({ txHash: hash }),
  setTxStatus: (status) => set({ txStatus: status }),
  setTxError: (error) => set({ txError: error }),
  
  resetTrade: () => set({
    amountIn: '',
    amountOut: '',
    quote: null,
    txHash: null,
    txStatus: 'idle',
    txError: null,
  }),
}));

// Agents Store
interface AgentsState {
  // Agent List
  agents: Agent[];
  selectedAgent: Agent | null;
  
  // Filters
  strategyFilter: string;
  statusFilter: string;
  searchQuery: string;
  sortBy: string;
  
  // Pagination
  page: number;
  totalPages: number;
  
  // Loading
  isLoading: boolean;
  
  // Actions
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setStrategyFilter: (filter: string) => void;
  setStatusFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: string) => void;
  setPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  // Initial State
  agents: [],
  selectedAgent: null,
  strategyFilter: 'all',
  statusFilter: 'all',
  searchQuery: '',
  sortBy: 'trustScore',
  page: 1,
  totalPages: 1,
  isLoading: false,
  
  // Actions
  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setStrategyFilter: (filter) => set({ strategyFilter: filter, page: 1 }),
  setStatusFilter: (filter) => set({ statusFilter: filter, page: 1 }),
  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setPage: (page) => set({ page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
