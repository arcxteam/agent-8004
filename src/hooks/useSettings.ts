'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

export interface UserSettings {
  // General
  theme: 'dark' | 'light' | 'system';
  language: string;
  currency: string;
  
  // Notifications
  emailNotifications: boolean;
  tradeAlerts: boolean;
  agentAlerts: boolean;
  priceAlerts: boolean;
  weeklyReport: boolean;
  
  // Trading
  defaultSlippage: number;
  confirmTrades: boolean;
  gasOptimization: boolean;
  
  // Security
  twoFactor: boolean;
  sessionTimeout: number;
  apiWhitelist: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsed: string | null;
  isActive: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  language: 'en',
  currency: 'USD',
  emailNotifications: true,
  tradeAlerts: true,
  agentAlerts: true,
  priceAlerts: false,
  weeklyReport: true,
  defaultSlippage: 0.5,
  confirmTrades: true,
  gasOptimization: true,
  twoFactor: false,
  sessionTimeout: 30,
  apiWhitelist: false,
};

// Hook to manage user settings (stored in localStorage)
export function useSettings() {
  const { address } = useAccount();
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (!address) {
      setSettingsState(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem(`settings_${address}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
      } catch {
        setSettingsState(DEFAULT_SETTINGS);
      }
    }
    setIsLoading(false);
  }, [address]);

  // Save settings
  const setSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      if (address) {
        localStorage.setItem(`settings_${address}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [address]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    if (address) {
      localStorage.removeItem(`settings_${address}`);
    }
  }, [address]);

  return {
    settings,
    setSettings,
    resetSettings,
    isLoading,
  };
}

// Hook to manage API keys
export function useApiKeys() {
  const { address } = useAccount();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch API keys from database
  const fetchApiKeys = useCallback(async () => {
    if (!address) {
      setApiKeys([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/settings/api-keys?address=${address}`);
      if (!response.ok) {
        // API might not exist yet - that's okay
        setApiKeys([]);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setApiKeys(result.data || []);
      }
    } catch (err) {
      // Don't set error for missing API
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  // Create new API key
  const createApiKey = async (name: string): Promise<{ key: string } | null> => {
    if (!address) return null;

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, name }),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const result = await response.json();
      if (result.success) {
        await fetchApiKeys();
        return { key: result.data.key };
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    }
  };

  // Delete API key
  const deleteApiKey = async (keyId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchApiKeys();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    apiKeys,
    isLoading,
    error,
    createApiKey,
    deleteApiKey,
    refetch: fetchApiKeys,
  };
}
