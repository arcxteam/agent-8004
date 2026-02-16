'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useDisconnect } from 'wagmi';
import {
  Settings as SettingsIcon,
  Bell,
  ArrowRightLeft,
  Shield,
  KeyRound,
  BookOpen,
  Rocket,
  BarChart3,
  Lightbulb,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  LogOut,
  Plug,
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
import { cn, formatAddress } from '@/lib/utils';
import { useSettings, useApiKeys } from '@/hooks/useSettings';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLoadingFallback } from '@/components/loading-fallback';

// Toggle Switch Component
function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={cn(
        'relative w-12 h-6 rounded-full transition-colors duration-200',
        enabled ? 'bg-brand-primary' : 'bg-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <motion.div
        animate={{ x: enabled ? 24 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
      />
    </button>
  );
}

// Settings Section Component
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="glass" className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3 sm:space-y-4">{children}</div>
    </Card>
  );
}

// Settings Row Component
function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm sm:text-base text-foreground">{label}</p>
        {description && <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Styled Select Component
function StyledSelect({
  value,
  onChange,
  children,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-card/80 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 [&>option]:bg-[#0f0f1e] [&>option]:text-white cursor-pointer hover:border-brand-primary/50 transition-all"
    >
      {children}
    </select>
  );
}

// API Key Row
function ApiKeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: { id: string; name: string; keyPrefix: string; createdAt: string; lastUsed: string | null };
  onRevoke: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 bg-card/50 rounded-xl border border-border/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center flex-shrink-0">
          <KeyRound className="w-5 h-5 text-brand-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm">{apiKey.name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <code className="px-2 py-0.5 bg-background rounded text-xs truncate">
              {showKey ? apiKey.keyPrefix : `${apiKey.keyPrefix.slice(0, 8)}${'*'.repeat(16)}`}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-brand-primary hover:text-brand-primary/80 flex-shrink-0"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right text-xs sm:text-sm">
          <p className="text-muted-foreground">Created: {apiKey.createdAt}</p>
          <p className="text-muted-foreground">Last used: {apiKey.lastUsed || 'Never'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRevoke}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Revoke
        </Button>
      </div>
    </div>
  );
}

// Create API Key Modal
function CreateApiKeyModal({
  isOpen,
  onClose,
  onCreateKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateKey: (name: string) => Promise<{ key: string } | null>;
}) {
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!keyName) return;
    setCreating(true);
    const result = await onCreateKey(keyName);
    if (result) {
      setNewKey(result.key);
    }
    setCreating(false);
  };

  const handleClose = () => {
    setKeyName('');
    setNewKey(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h2 className="text-xl font-bold text-foreground mb-4">Create API Key</h2>
      {newKey ? (
        <div className="space-y-4">
          <div className="p-4 bg-success/10 border border-success/20 rounded-xl">
            <p className="text-sm text-success font-medium mb-2">API Key Created Successfully!</p>
            <p className="text-xs text-muted-foreground mb-2">
              Copy this key now. You won&apos;t be able to see it again.
            </p>
            <code className="block p-3 bg-background rounded-lg text-sm break-all">
              {newKey}
            </code>
          </div>
          <Button onClick={handleClose} className="w-full">Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Key Name</label>
            <Input
              placeholder="e.g., Trading Bot"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!keyName || creating} className="flex-1">
              {creating ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Tab icon mapping
const TAB_ICONS: Record<string, React.ReactNode> = {
  general: <SettingsIcon className="w-4 h-4" />,
  notifications: <Bell className="w-4 h-4" />,
  trading: <ArrowRightLeft className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  api: <KeyRound className="w-4 h-4" />,
};

// Main Settings Page content
function SettingsPageContent() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { settings, setSettings, resetSettings, isLoading } = useSettings();
  const { apiKeys, createApiKey, deleteApiKey } = useApiKeys();
  const [activeTab, setActiveTab] = useState('general');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'trading', label: 'Trading' },
    { id: 'security', label: 'Security' },
    { id: 'api', label: 'API Keys' },
  ];

  if (isLoading) {
    return (
      <DashboardLayout showFooter={false}>
        <PageLoadingFallback message="Loading settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showFooter={false}>
      <div className="py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-bold text-foreground"
            >
              Settings
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground"
            >
              Manage your account preferences and security
            </motion.p>
          </div>
          {isConnected && (
            <Badge variant="primary" size="lg">
              Connected: {formatAddress(address!)}
            </Badge>
          )}
        </div>

        {/* Tabs Navigation */}
        <Card variant="glass" className="p-2 sm:p-4 overflow-x-auto">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <span className="flex items-center gap-1.5">
                    {TAB_ICONS[tab.id]}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Card>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 sm:space-y-6"
        >
          {/* General Settings */}
          {activeTab === 'general' && (
            <>
              <SettingsSection
                title="Appearance"
                description="Customize how the app looks and feels"
              >
                <SettingsRow label="Theme" description="Choose between light and dark mode">
                  <div className="flex gap-2">
                    {['light', 'dark', 'system'].map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setSettings({ theme: theme as 'light' | 'dark' | 'system' })}
                        className={cn(
                          'px-3 sm:px-4 py-2 rounded-lg border capitalize transition-all text-sm',
                          settings.theme === theme
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                            : 'border-border hover:border-brand-primary/50'
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </SettingsRow>

                <SettingsRow label="Currency" description="Display currency for values">
                  <StyledSelect
                    value={settings.currency}
                    onChange={(e) => setSettings({ currency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (&euro;)</option>
                    <option value="GBP">GBP (&pound;)</option>
                  </StyledSelect>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection
                title="Wallet"
                description="Manage your connected wallet"
              >
                <SettingsRow
                  label="Connected Address"
                  description={isConnected ? formatAddress(address!) : 'No wallet connected'}
                >
                  {isConnected ? (
                    <Button variant="outline" size="sm" onClick={() => disconnect()}>
                      <LogOut className="w-4 h-4 mr-1.5" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm">
                      <Plug className="w-4 h-4 mr-1.5" />
                      Connect Wallet
                    </Button>
                  )}
                </SettingsRow>
              </SettingsSection>
            </>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <SettingsSection
              title="Notification Preferences"
              description="Choose which notifications you want to receive"
            >
              <SettingsRow label="Email Notifications" description="Receive updates via email">
                <ToggleSwitch
                  enabled={settings.emailNotifications}
                  onChange={(v) => setSettings({ emailNotifications: v })}
                />
              </SettingsRow>

              <SettingsRow label="Trade Alerts" description="Get notified when trades execute">
                <ToggleSwitch
                  enabled={settings.tradeAlerts}
                  onChange={(v) => setSettings({ tradeAlerts: v })}
                />
              </SettingsRow>

              <SettingsRow label="Agent Alerts" description="Notifications about agent activity">
                <ToggleSwitch
                  enabled={settings.agentAlerts}
                  onChange={(v) => setSettings({ agentAlerts: v })}
                />
              </SettingsRow>

              <SettingsRow label="Price Alerts" description="Alerts when tokens hit price targets">
                <ToggleSwitch
                  enabled={settings.priceAlerts}
                  onChange={(v) => setSettings({ priceAlerts: v })}
                />
              </SettingsRow>

              <SettingsRow label="Weekly Report" description="Receive weekly portfolio summary">
                <ToggleSwitch
                  enabled={settings.weeklyReport}
                  onChange={(v) => setSettings({ weeklyReport: v })}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {/* Trading Settings */}
          {activeTab === 'trading' && (
            <SettingsSection
              title="Trading Preferences"
              description="Configure your default trading settings"
            >
              <SettingsRow label="Default Slippage" description="Maximum allowed price slippage">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {[0.1, 0.5, 1.0, 2.0].map((slippage) => (
                    <button
                      key={slippage}
                      onClick={() => setSettings({ defaultSlippage: slippage })}
                      className={cn(
                        'px-2.5 sm:px-3 py-1.5 rounded-lg border text-sm transition-all',
                        settings.defaultSlippage === slippage
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-border hover:border-brand-primary/50'
                      )}
                    >
                      {slippage}%
                    </button>
                  ))}
                </div>
              </SettingsRow>

              <SettingsRow label="Confirm Trades" description="Show confirmation dialog before trading">
                <ToggleSwitch
                  enabled={settings.confirmTrades}
                  onChange={(v) => setSettings({ confirmTrades: v })}
                />
              </SettingsRow>

              <SettingsRow label="Gas Optimization" description="Automatically optimize gas for transactions">
                <ToggleSwitch
                  enabled={settings.gasOptimization}
                  onChange={(v) => setSettings({ gasOptimization: v })}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <SettingsSection
              title="Security Settings"
              description="Protect your account and assets"
            >
              <SettingsRow
                label="Two-Factor Authentication"
                description="Add an extra layer of security"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={settings.twoFactor ? 'success' : 'secondary'}>
                    {settings.twoFactor ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Button variant="outline" size="sm">
                    {settings.twoFactor ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </SettingsRow>

              <SettingsRow label="Session Timeout" description="Auto-lock after inactivity">
                <StyledSelect
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({ sessionTimeout: parseInt(e.target.value) })}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={0}>Never</option>
                </StyledSelect>
              </SettingsRow>

              <SettingsRow label="API Whitelist" description="Only allow API calls from whitelisted IPs">
                <ToggleSwitch
                  enabled={settings.apiWhitelist}
                  onChange={(v) => setSettings({ apiWhitelist: v })}
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {/* API Keys Settings */}
          {activeTab === 'api' && (
            <>
              <SettingsSection
                title="API Keys"
                description="Manage API keys for programmatic access"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {apiKeys.length} active API key{apiKeys.length !== 1 ? 's' : ''}
                  </p>
                  <Button size="sm" onClick={() => setApiKeyModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create New Key
                  </Button>
                </div>

                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <ApiKeyRow
                      key={key.id}
                      apiKey={key}
                      onRevoke={() => deleteApiKey(key.id)}
                    />
                  ))}
                </div>

                {apiKeys.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center mx-auto mb-4">
                      <KeyRound className="w-7 h-7 text-brand-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No API Keys</h3>
                    <p className="text-sm text-muted-foreground mb-4">Create an API key to access the platform programmatically</p>
                    <Button onClick={() => setApiKeyModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create Your First Key
                    </Button>
                  </div>
                )}
              </SettingsSection>

              <Card variant="glass" className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">API Documentation</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Access our comprehensive API documentation to integrate with the Monad AI Agent Protocol.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <Card className="p-4 hover:border-brand-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Rocket className="w-4 h-4 text-brand-primary" />
                      <h4 className="font-semibold text-sm text-foreground">Getting Started</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Quick start guide and authentication</p>
                  </Card>
                  <Card className="p-4 hover:border-brand-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-brand-primary" />
                      <h4 className="font-semibold text-sm text-foreground">Endpoints</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Full API endpoint reference</p>
                  </Card>
                  <Card className="p-4 hover:border-brand-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-4 h-4 text-brand-primary" />
                      <h4 className="font-semibold text-sm text-foreground">Examples</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Code samples and use cases</p>
                  </Card>
                </div>
              </Card>
            </>
          )}
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
          <Button variant="outline" onClick={resetSettings}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button>
            <Save className="w-4 h-4 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* API Key Modal */}
      <CreateApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        onCreateKey={createApiKey}
      />
    </DashboardLayout>
  );
}

// Wrapped export with ErrorBoundary + Suspense
export default function SettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback message="Loading settings..." />}>
        <SettingsPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
