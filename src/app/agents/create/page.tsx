'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useChainId, useEstimateGas, useGasPrice, usePublicClient, useSendTransaction, useWalletClient } from 'wagmi';
import { parseEther, formatEther, encodeFunctionData } from 'viem';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TOTAL_AGENT_LOGOS } from '@/lib/agent-logos';
import { useRegisterAgent } from '@/hooks/useERC8004';
import { useVaultAddress, usePayRegistrationFee, useFeeConfig } from '@/hooks/useCapitalVault';
import { ERC8004_REGISTRIES, CAPITAL_VAULT } from '@/config/chains';
import { capitalVaultAbi } from '@/config/contracts';
import { setAgentWalletOnChain } from '@/lib/erc8004';
import {
  Star,
  Lock,
  Shield,
  Shuffle,
  TrendingUp,
  Coins,
  ArrowLeftRight,
  Calendar,
  Grid3X3,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ExternalLink,
  Check,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Wallet,
  Globe,
  Cpu,
  Zap,
  BarChart3,
  Info
} from 'lucide-react';

// Trust model options following ERC-8004 spec
const trustModelOptions = [
  {
    id: 'reputation',
    label: 'Reputation',
    Icon: Star,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'On-chain feedback scores via ERC-8004 Reputation Registry (Active)'
  },
  {
    id: 'crypto-economic',
    label: 'Crypto-Economic',
    Icon: Lock,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Stake-secured validation via ERC-8004 Validation Registry (Coming Soon by Monad)'
  },
  {
    id: 'tee-attestation',
    label: 'TEE Attestation',
    Icon: Shield,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    description: 'Trusted execution environment proof via ERC-8004 (Coming Soon by Monad)'
  },
];

// Strategy options (must match Prisma enum Strategy)
const strategies: SelectOption[] = [
  { value: 'MOMENTUM', label: 'Momentum Trading', icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, description: 'Follow market trends and momentum indicators' },
  { value: 'YIELD', label: 'Yield Optimization', icon: <Coins className="w-4 h-4 text-amber-400" />, description: 'Maximize DeFi yields across protocols' },
  { value: 'ARBITRAGE', label: 'Arbitrage', icon: <ArrowLeftRight className="w-4 h-4 text-blue-400" />, description: 'Cross-DEX price arbitrage opportunities' },
  { value: 'DCA', label: 'Dollar Cost Average', icon: <Calendar className="w-4 h-4 text-purple-400" />, description: 'Periodic investments to reduce volatility' },
  { value: 'GRID', label: 'Grid Trading', icon: <Grid3X3 className="w-4 h-4 text-cyan-400" />, description: 'Range-bound market trading strategies' },
  { value: 'HEDGE', label: 'Hedging', icon: <ShieldCheck className="w-4 h-4 text-rose-400" />, description: 'Risk mitigation and portfolio protection' },
];

// Risk parameters per level (matches strategy-engine.ts)
const RISK_PARAMS: Record<string, { maxPositionPct: number; minConfidence: number; maxDrawdownLimit: number; slippageBps: number; gasReserve: number }> = {
  low: { maxPositionPct: 5, minConfidence: 75, maxDrawdownLimit: 10, slippageBps: 50, gasReserve: 5.0 },
  medium: { maxPositionPct: 10, minConfidence: 60, maxDrawdownLimit: 20, slippageBps: 100, gasReserve: 3.0 },
  high: { maxPositionPct: 20, minConfidence: 45, maxDrawdownLimit: 35, slippageBps: 150, gasReserve: 1.0 },
};

// Protocol capabilities
const PROTOCOL_CAPABILITIES = [
  { id: 'a2a', label: 'A2A', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Agent-to-Agent JSON-RPC 2.0' },
  { id: 'mcp', label: 'MCP', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10', desc: 'Model Context Protocol (5 tools)' },
  { id: 'x402', label: 'x402', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Micropayment ($0.001 USDC/call)' },
  { id: 'erc8004', label: 'ERC-8004', icon: Shield, color: 'text-cyan-400', bg: 'bg-cyan-500/10', desc: 'On-chain identity & reputation' },
];

// Network detection + fee/gas estimation (reads on-chain values)
function useNetworkConfig() {
  const chainId = useChainId();
  const { registrationFeeMON, minCapitalMON } = useFeeConfig();

  // Determine network based on wallet chain ID
  const isMainnet = chainId === 143;
  const isTestnet = chainId === 10143;
  const network = isMainnet ? 'mainnet' : isTestnet ? 'testnet' : 'mainnet';
  const networkName = isMainnet ? 'Monad Mainnet' : isTestnet ? 'Monad Testnet' : 'Monad Mainnet';

  // Get vault address for gas estimation
  const vaultAddress = isMainnet ? CAPITAL_VAULT.mainnet : CAPITAL_VAULT.testnet;

  // Encode payRegistrationFee(agentId=1n) for realistic gas estimation
  // Gas cost is similar regardless of agentId value
  const feeCallData = React.useMemo(() => {
    try {
      return encodeFunctionData({
        abi: capitalVaultAbi,
        functionName: 'payRegistrationFee',
        args: [1n],
      });
    } catch {
      return undefined;
    }
  }, []);

  // Estimate gas units for payRegistrationFee tx via wagmi hook
  const { data: gasUnits, isLoading: isEstimatingGas } = useEstimateGas({
    to: (vaultAddress ?? undefined) as `0x${string}` | undefined,
    value: parseEther(registrationFeeMON.toString()),
    data: feeCallData,
    query: { enabled: !!vaultAddress && !!feeCallData },
  });

  // Get current gas price via wagmi hook
  const { data: gasPrice } = useGasPrice();

  // Calculate gas cost in MON from on-chain data
  const estimatedGas = React.useMemo(() => {
    if (gasUnits && gasPrice && gasPrice > 0n) {
      const costWei = gasUnits * gasPrice;
      const costMON = Number(formatEther(costWei));
      // Add 20% buffer for safety + account for ERC-8004 register tx gas
      return Math.max(costMON * 2.5, 0.001);
    }
    // Fallback: if estimation not yet ready, show loading
    return 0;
  }, [gasUnits, gasPrice]);

  const isEstimating = isEstimatingGas || (estimatedGas === 0 && !!vaultAddress);

  return {
    chainId,
    network,
    networkName,
    isMainnet,
    isTestnet,
    registrationFee: Math.max(registrationFeeMON, 100),
    minCapital: Math.max(minCapitalMON, 100),
    estimatedGas,
    isEstimating,
    totalCost: Math.max(registrationFeeMON, 100) + estimatedGas,
  };
}

function CreateAgentContent() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const networkConfig = useNetworkConfig();
  const [step, setStep] = React.useState(1);
  const [selectedAvatar, setSelectedAvatar] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    strategy: '',
    agentEndpoint: 'https://anoa.app/api/a2a',
    trustModels: ['reputation'] as string[],
    riskLevel: 'medium',
    maxDrawdown: '10',
    initialCapital: '',
  });
  const [registeredAgentId, setRegisteredAgentId] = React.useState<bigint | null>(null);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [agentWalletAddr, setAgentWalletAddr] = React.useState<string | null>(null);
  const [fundingStatus, setFundingStatus] = React.useState<string | null>(null);

  // ERC-8004 registration hook
  const {
    register,
    isPending: isRegistering,
    hash: txHash,
    error: hookError,
  } = useRegisterAgent();

  // Capital Vault hooks for fee payment and delegation
  const { isDeployed: vaultDeployed } = useVaultAddress();
  const {
    payFee,
  } = usePayRegistrationFee();

  // Send transaction hook for direct agent wallet funding
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Generate random avatar on mount
  React.useEffect(() => {
    if (!selectedAvatar) {
      setSelectedAvatar(Math.floor(Math.random() * TOTAL_AGENT_LOGOS) + 1);
    }
  }, [selectedAvatar]);

  // Note: Step 4 transition is handled at the END of handleRegister(),
  // not via useEffect, to prevent race condition where step 4 shows
  // before wallet funding popup appears.

  const toggleTrustModel = (modelId: string) => {
    setFormData(prev => ({
      ...prev,
      trustModels: prev.trustModels.includes(modelId)
        ? prev.trustModels.filter(m => m !== modelId)
        : [...prev.trustModels, modelId]
    }));
  };

  const shuffleAvatar = () => {
    setSelectedAvatar(Math.floor(Math.random() * TOTAL_AGENT_LOGOS) + 1);
  };

  // Step validation
  const isStep1Valid = formData.name.trim().length > 0 && formData.trustModels.length > 0;
  const capitalValue = parseFloat(formData.initialCapital) || 0;
  const isStep2Valid = formData.strategy !== '' && capitalValue >= networkConfig.minCapital;

  const handleRegister = async () => {
    setRegisterError(null);

    try {
      // Build full image URL for metadata (explorers need absolute URL, not relative path)
      // Use NEXT_PUBLIC_APP_URL to avoid dev URLs in on-chain metadata
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://anoa.app');
      const fallbackImageUrl = `${siteUrl}/agents/agent-${selectedAvatar}.png`;

      // Upload metadata + avatar image to Cloudflare R2 and get public URLs
      let tokenURI: string | undefined;
      let imageUrl = fallbackImageUrl;
      try {
        const metadataResponse = await fetch('/api/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'agent-metadata',
            name: formData.name,
            description: formData.description,
            image: fallbackImageUrl,
            avatarNumber: selectedAvatar,
            strategy: formData.strategy,
            riskLevel: formData.riskLevel,
            trustModels: formData.trustModels,
            a2aEndpoint: formData.agentEndpoint || undefined,
            external_url: `${siteUrl}/agents`,
            ownerAddress: address,
            chainId: networkConfig.chainId || 143,
          }),
        });

        const metadataResult = await metadataResponse.json();
        if (metadataResult.success) {
          tokenURI = metadataResult.data.url;
          if (metadataResult.data.imageUrl) {
            imageUrl = metadataResult.data.imageUrl;
          }
          console.log('Metadata uploaded to R2:', tokenURI);
          console.log('Image uploaded to R2:', imageUrl);
        } else {
          console.warn('Metadata upload failed, registering without URI:', metadataResult.error);
        }
      } catch (uploadErr) {
        console.warn('Metadata upload failed, registering without URI:', uploadErr);
      }

      console.log('Step 1/4: Registering agent on ERC-8004...');

      // Step 1: Register on-chain (popup 1 — gas only, free registration)
      const result = await register(tokenURI ? { tokenURI } : undefined);

      // CRITICAL: agentId must be extracted from receipt logs
      // Without it, fee payment, DB save, wallet creation, and funding all fail
      if (!result?.agentId) {
        throw new Error(
          `Registration tx succeeded (${result?.hash}) but agentId could not be extracted from logs. ` +
          'Check the transaction on Monadscan and try again.'
        );
      }

      const agentId = result.agentId;
      setRegisteredAgentId(agentId);

      // Step 2: Pay registration fee to AnoaCapitalVault (popup 2)
      // Fee goes to vault.payRegistrationFee(agentId) → accumulatedFees (platform revenue)
      let feeHash: string | undefined;
      if (vaultDeployed) {
        console.log('Step 2/4: Paying registration fee to Capital Vault...');
        try {
          const feeResult = await payFee(agentId);
          feeHash = feeResult?.hash;
          console.log('Registration fee paid to vault:', feeHash);
        } catch (feeErr) {
          // Fee payment failed but agent is already registered on-chain
          console.warn('Registration fee payment failed:', feeErr);
        }
      }

      // Step 3: Save agent to database (derives HD wallet server-side)
      console.log('Step 3/4: Saving agent to database...');
      try {
        const saveResponse = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            strategy: formData.strategy,
            description: formData.description,
            userAddress: address,
            maxDrawdown: parseFloat(formData.maxDrawdown) || 10,
            initialCapital: parseFloat(formData.initialCapital) || 0,
            onChainId: `eip155:${networkConfig.chainId}:${ERC8004_REGISTRIES.IDENTITY_REGISTRY}#${agentId.toString()}`,
            erc8004AgentId: agentId.toString(),
            erc8004TxHash: result.hash,
            registrationFeeTxHash: feeHash || result.hash,
            metadataUri: tokenURI || '',
            imageUrl: imageUrl,
            trustModels: formData.trustModels,
            a2aEndpoint: formData.agentEndpoint || null,
            capabilities: 0,
            riskParams: {
              riskLevel: formData.riskLevel,
              maxDrawdown: parseFloat(formData.maxDrawdown) || 10,
            },
          }),
        });
        const saveResult = await saveResponse.json();
        if (!saveResult.success) {
          console.warn('Failed to save agent to database:', saveResult.error);
        } else {
          console.log('Agent saved to database:', saveResult.data?.id);
          // Store the server-derived agent wallet address
          if (saveResult.agentWallet) {
            setAgentWalletAddr(saveResult.agentWallet);

            // Step 3: Link agent wallet on-chain (ERC-8004 setAgentWallet)
            // Deadline already set to 300s server-side (contract rejects > ~5 min)
            if (saveResult.walletConsent && walletClient) {
              try {
                console.log('Step 3/4: Linking agent wallet on-chain...');
                const consent = saveResult.walletConsent;
                await setAgentWalletOnChain(
                  walletClient,
                  agentId,
                  consent.agentWallet as `0x${string}`,
                  BigInt(consent.deadline),
                  consent.signature as `0x${string}`,
                );
                console.log('Agent wallet linked on-chain');
              } catch (linkErr) {
                console.warn('setAgentWallet on-chain failed (DB tracking active):', linkErr);
              }
            }

            // Step 4: Fund agent wallet with initial capital (popup 4 — direct MON transfer)
            const capitalAmount = parseFloat(formData.initialCapital) || 0;
            if (capitalAmount > 0 && sendTransactionAsync && publicClient) {
              try {
                console.log(`Step 4/4: Funding agent wallet with ${capitalAmount} MON...`);
                setFundingStatus(`Sending ${capitalAmount} MON to agent wallet...`);
                const fundTxHash = await sendTransactionAsync({
                  to: saveResult.agentWallet as `0x${string}`,
                  value: parseEther(capitalAmount.toString()),
                });
                // Wait for confirmation
                await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
                console.log('Agent wallet funded:', fundTxHash);
                setFundingStatus('Capital sent successfully!');

                // Capital tracking is handled by DB (totalCapital field)
                // Do NOT call delegateCapital here — it sends ADDITIONAL MON to vault
                // The vault only stores registration fees (accumulatedFees), not trading capital
              } catch (fundErr) {
                console.warn('Agent wallet funding failed:', fundErr);
                setFundingStatus('Funding failed — you can send MON to the agent wallet manually.');
              }
            }
          }
        }
      } catch (saveErr) {
        console.warn('Database save failed (agent still registered on-chain):', saveErr);
      }

      // Transition to success screen AFTER all operations complete
      // This prevents the race condition where step 4 shows before funding popup
      setStep(4);
    } catch (err) {
      console.error('Registration failed:', err);
      setRegisterError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  const stepLabels = ['Configure', 'Strategy', 'Review', 'Complete'];

  // Require wallet connection
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card variant="glass" className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-white/60 mb-6">
              Connect your wallet to create an ERC-8004 agent identity
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/agents" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Register New Agent</h1>
        <p className="text-white/60">
          Create an ERC-8004 compliant agent identity with on-chain trust verification
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1 mb-8 bg-white/5 rounded-2xl p-4">
        {stepLabels.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  idx + 1 < step
                    ? 'bg-emerald-500 text-white'
                    : idx + 1 === step
                    ? 'bg-primary-500 text-white ring-4 ring-primary-500/30'
                    : 'bg-white/10 text-white/40'
                )}
              >
                {idx + 1 < step ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={cn(
                'text-xs mt-2 whitespace-nowrap',
                idx + 1 <= step ? 'text-white/80' : 'text-white/40'
              )}>
                {label}
              </span>
            </div>
            {idx < stepLabels.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 rounded mx-4 mb-6',
                  idx + 1 < step ? 'bg-emerald-500' : 'bg-white/10'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Content Card */}
      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Configure Agent */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Agent Identity</h3>
                  <p className="text-white/60">Define your agent's identity and trust preferences</p>
                </div>

                {/* Avatar and Preview Section */}
                <div className="flex flex-col sm:flex-row gap-8">
                  {/* Avatar Selection */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-sm font-medium text-white/60">Agent Avatar</div>
                    <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500 to-purple-600 p-[3px]">
                      <div className="w-full h-full rounded-[13px] overflow-hidden bg-bg-card">
                        {selectedAvatar && (
                          <Image
                            src={`/agents/agent-${selectedAvatar}.png`}
                            alt="Agent avatar"
                            width={128}
                            height={128}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                    </div>
                    {/* Randomize Button Card */}
                    <button
                      onClick={shuffleAvatar}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/50 rounded-xl transition-all group"
                    >
                      <Shuffle className="w-4 h-4 text-primary-400 group-hover:rotate-180 transition-transform duration-300" />
                      <span className="text-sm text-white/80 group-hover:text-white">Randomize Avatar</span>
                    </button>
                  </div>

                  {/* Live Preview Card */}
                  <div className="flex-1">
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <div className="text-xs font-medium text-white/40 mb-3">Live Preview</div>
                      <div className="flex items-start gap-4">
                        {selectedAvatar && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                            <Image
                              src={`/agents/agent-${selectedAvatar}.png`}
                              alt="Agent preview"
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate">
                            {formData.name || 'Your Agent Name'}
                          </div>
                          <p className="text-sm text-white/60 mt-1 line-clamp-2">
                            {formData.description || 'Agent description will appear here...'}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {formData.trustModels.map((model) => (
                              <Badge key={model} variant="info" size="sm">
                                {model}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Agent Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="My Trading Agent"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      maxLength={50}
                    />
                    <p className="text-xs text-white/40 mt-1.5">{formData.name.length}/50 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none transition-colors"
                      placeholder="Describe what your agent does, its trading strategy, and any other relevant information..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      maxLength={500}
                    />
                    <p className="text-xs text-white/40 mt-1.5">{formData.description.length}/500 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Agent Endpoint (A2A Protocol)
                    </label>
                    <Input
                      placeholder="https://anoa.app/api/a2a"
                      value={formData.agentEndpoint}
                      onChange={(e) => setFormData({ ...formData, agentEndpoint: e.target.value })}
                    />
                    <p className="text-xs text-white/40 mt-1.5">
                      A2A protocol endpoint for agent-to-agent communication. Default: https://anoa.app/api/a2a
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-3">
                      Trust Models <span className="text-white/40 text-xs font-normal">(select at least one)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {trustModelOptions.map((model) => {
                        const IconComponent = model.Icon;
                        const isSelected = formData.trustModels.includes(model.id);
                        return (
                          <button
                            key={model.id}
                            onClick={() => toggleTrustModel(model.id)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all',
                              isSelected
                                ? 'border-primary-500 bg-primary-500/20'
                                : cn('border-white/10 hover:border-white/20', model.bgColor)
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={cn('p-1.5 rounded-lg', model.bgColor)}>
                                <IconComponent className={cn('w-5 h-5', model.color)} />
                              </div>
                              <span className="text-sm font-medium text-white">{model.label}</span>
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed">{model.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Strategy Configuration */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Trading Configuration</h3>
                  <p className="text-white/60">Configure your agent's trading parameters and risk settings</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Trading Strategy <span className="text-red-400">*</span>
                    </label>
                    <Select
                      value={formData.strategy}
                      onChange={(value) => setFormData({ ...formData, strategy: value })}
                      options={strategies}
                      placeholder="Select a trading strategy"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Risk Level
                      </label>
                      <div className="flex gap-2">
                        {['low', 'medium', 'high'].map((level) => (
                          <button
                            key={level}
                            onClick={() => setFormData({ ...formData, riskLevel: level })}
                            className={cn(
                              'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all capitalize',
                              formData.riskLevel === level
                                ? level === 'low' ? 'bg-emerald-500 text-white' 
                                  : level === 'medium' ? 'bg-purple-500 text-white'
                                  : 'bg-red-500 text-white'
                                : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Max Drawdown
                      </label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={formData.maxDrawdown}
                        onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
                        suffix="%"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Initial Capital (MON)
                    </label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={formData.initialCapital}
                      onChange={(e) => setFormData({ ...formData, initialCapital: e.target.value })}
                      suffix="MON"
                    />
                    <p className="text-xs text-white/40 mt-1.5">
                      Minimum: {networkConfig.minCapital} MON. This capital will be sent directly to your agent wallet for trading.
                    </p>
                  </div>

                  {/* Risk Info Card */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400 mb-1">Risk Disclosure</p>
                        <p className="text-xs text-white/60">
                          AI agents execute trades autonomously. While risk parameters help limit exposure, 
                          trading involves risk of loss. Only delegate capital you can afford to lose.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review & Confirm */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Review & Confirm</h3>
                  <p className="text-white/60">Review your agent details before minting the ERC-8004 identity NFT</p>
                </div>

                {/* Agent Identity Card */}
                <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl p-6 border border-white/10 overflow-hidden">
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-500 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                  </div>

                  <div className="relative flex flex-col sm:flex-row gap-6">
                    {/* Avatar */}
                    <div className="shrink-0 flex flex-col items-center gap-3">
                      {selectedAvatar && (
                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500 to-purple-600 p-[3px] shadow-lg shadow-primary-500/20">
                          <div className="w-full h-full rounded-[13px] overflow-hidden bg-bg-card">
                            <Image
                              src={`/agents/agent-${selectedAvatar}.png`}
                              alt="Agent avatar"
                              width={160}
                              height={160}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="info" size="sm" className="font-mono text-xs">
                          Avatar #{selectedAvatar}
                        </Badge>
                        <button
                          onClick={shuffleAvatar}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                          title="Randomize avatar"
                        >
                          <Shuffle className="w-3.5 h-3.5 text-white/60" />
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Agent Identity</span>
                        <h4 className="text-2xl font-bold text-white mt-1">{formData.name}</h4>
                        <p className="text-white/60 mt-1">{formData.description || 'No description provided'}</p>
                      </div>

                      {/* Trust Models */}
                      <div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Trust Models</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.trustModels.map((modelId) => {
                            const model = trustModelOptions.find(m => m.id === modelId);
                            if (!model) return null;
                            const IconComponent = model.Icon;
                            return (
                              <Badge key={modelId} variant="info" className="flex items-center gap-1.5">
                                <IconComponent className="w-3.5 h-3.5" />
                                {model.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* On-Chain Identity Info */}
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <span className="text-xs text-white/40 uppercase tracking-wider">On-Chain Registration</span>
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Registry</span>
                            <span className="text-white/80 font-mono">{ERC8004_REGISTRIES.IDENTITY_REGISTRY.slice(0, 10)}...{ERC8004_REGISTRIES.IDENTITY_REGISTRY.slice(-6)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Standard</span>
                            <span className="text-white/80">ERC-8004 (ERC-721 NFT)</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Network</span>
                            <Badge variant={networkConfig.isMainnet ? 'success' : 'info'} size="sm">
                              {networkConfig.networkName}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Protocol Capabilities */}
                <Card variant="glass">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-medium text-white">Protocol Capabilities</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PROTOCOL_CAPABILITIES.map((proto) => {
                        const IconComp = proto.icon;
                        return (
                          <div key={proto.id} className={cn('rounded-xl p-3 border border-white/5', proto.bg)}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <IconComp className={cn('w-4 h-4', proto.color)} />
                              <span className="text-sm font-medium text-white">{proto.label}</span>
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{proto.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                    {formData.agentEndpoint && (
                      <div className="mt-4 bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs text-white/40 uppercase tracking-wider">A2A Endpoint</span>
                        </div>
                        <p className="text-sm text-white/80 font-mono truncate">{formData.agentEndpoint}</p>
                        <p className="text-xs text-white/40 mt-1">Supports: trading/execute, trading/quote, agent/info, message/send</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Strategy & Risk Configuration */}
                <Card variant="glass">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-medium text-white">Trading Configuration</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="text-white/40 text-xs">Strategy</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          {strategies.find(s => s.value === formData.strategy)?.icon}
                          <p className="text-white font-medium text-sm">
                            {strategies.find(s => s.value === formData.strategy)?.label || 'Not selected'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="text-white/40 text-xs">Risk Level</span>
                        <p className={cn(
                          'font-medium mt-1.5 text-sm capitalize',
                          formData.riskLevel === 'low' ? 'text-emerald-400' :
                          formData.riskLevel === 'medium' ? 'text-purple-400' : 'text-red-400'
                        )}>{formData.riskLevel}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="text-white/40 text-xs">Max Drawdown</span>
                        <p className="text-white font-medium mt-1.5 text-sm">{formData.maxDrawdown}%</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="text-white/40 text-xs">Initial Capital</span>
                        <p className="text-white font-medium mt-1.5 text-sm">{formData.initialCapital || '0'} MON</p>
                      </div>
                    </div>

                    {/* Risk Parameters Detail */}
                    {(() => {
                      const rp = RISK_PARAMS[formData.riskLevel];
                      if (!rp) return null;
                      const capital = parseFloat(formData.initialCapital) || 0;
                      const maxTradeSize = capital > 0 ? (capital * rp.maxPositionPct / 100).toFixed(1) : '—';
                      return (
                        <div className="mt-4 bg-white/[0.03] rounded-xl p-4 border border-white/5">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="w-3.5 h-3.5 text-white/40" />
                            <span className="text-xs text-white/50 font-medium">Risk Parameters ({formData.riskLevel})</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-white/40">Max per trade</span>
                              <p className="text-white/80 font-medium mt-0.5">{rp.maxPositionPct}% ({maxTradeSize} MON)</p>
                            </div>
                            <div>
                              <span className="text-white/40">Min confidence</span>
                              <p className="text-white/80 font-medium mt-0.5">{rp.minConfidence}/100</p>
                            </div>
                            <div>
                              <span className="text-white/40">Slippage</span>
                              <p className="text-white/80 font-medium mt-0.5">{rp.slippageBps / 100}%</p>
                            </div>
                            <div>
                              <span className="text-white/40">Gas reserve</span>
                              <p className="text-white/80 font-medium mt-0.5">{rp.gasReserve} MON</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Fee Breakdown */}
                <Card variant="gradient">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-medium text-white mb-4">Transaction Details</h4>
                    <p className="text-xs text-white/60 mb-4">
                      Minting an agent identity creates an ERC-721 NFT and registers it on the ERC-8004 Identity Registry.
                      Registration fee will be collected by AnoaCapitalVault as platform revenue.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/60">Registration Fee</span>
                        <span className="text-white font-medium">{networkConfig.registrationFee} MON</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Est. Gas Fee</span>
                        <span className="text-white font-medium">
                          {networkConfig.isEstimating ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Estimating...
                            </span>
                          ) : (
                            <>~{networkConfig.estimatedGas.toFixed(4)} MON</>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Network</span>
                        <Badge variant={networkConfig.isMainnet ? 'success' : 'info'} size="sm">
                          {networkConfig.networkName}
                        </Badge>
                      </div>
                      {parseFloat(formData.initialCapital) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-white/60">Initial Capital (to agent wallet)</span>
                          <span className="text-white font-medium">{formData.initialCapital} MON</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-white/10">
                        <span className="text-white font-medium">Total Estimated</span>
                        <span className="text-primary-400 font-bold text-lg">~{(networkConfig.totalCost + (parseFloat(formData.initialCapital) || 0)).toFixed(4)} MON</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* What Happens Next */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-medium text-white/70">What happens when you mint</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
                      <span className="text-white/60">ERC-8004 identity NFT minted on-chain</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
                      <span className="text-white/60">Registration fee paid to AnoaCapitalVault</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
                      <span className="text-white/60">HD wallet derived (BIP-32) for trading</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">4</span>
                      <span className="text-white/60">Capital sent to agent wallet for trading</span>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {(registerError || hookError) && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-1">Registration Failed</p>
                        <p className="text-xs text-white/60">
                          {registerError || hookError?.message || 'An error occurred during registration'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-8"
                >
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </motion.div>
                
                <h3 className="text-3xl font-bold text-white mb-3">Agent Registered!</h3>
                <p className="text-white/60 mb-8 max-w-md mx-auto">
                Your ERC-8004 agent identity has been minted successfully on {networkConfig.networkName}.
                </p>
                
                {/* Success Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md mx-auto mb-8">
                  <div className="flex items-center gap-4 mb-4">
                    {selectedAvatar && (
                      <Image
                        src={`/agents/agent-${selectedAvatar}.png`}
                        alt="Agent"
                        width={64}
                        height={64}
                        className="rounded-xl"
                        unoptimized
                      />
                    )}
                    <div className="text-left">
                      <div className="font-bold text-white text-lg">{formData.name}</div>
                      <div className="text-sm text-white/60">
                        Token ID: #{registeredAgentId?.toString() || 'Pending'}
                      </div>
                    </div>
                    <Badge variant="success" className="ml-auto">Live</Badge>
                  </div>
                  <div className="text-xs text-white/40 font-mono bg-white/5 p-2 rounded-lg truncate">
                    eip155:{networkConfig.chainId}:{ERC8004_REGISTRIES.IDENTITY_REGISTRY.slice(0, 12)}...#{registeredAgentId?.toString() || '?'}
                  </div>
                  {agentWalletAddr && (
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="text-xs text-emerald-400 font-medium mb-1">Agent Wallet Address</div>
                      <div className="text-xs text-white/80 font-mono break-all">{agentWalletAddr}</div>
                      <button
                        onClick={() => navigator.clipboard.writeText(agentWalletAddr)}
                        className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        Copy Address
                      </button>
                      <p className="text-xs text-white/40 mt-2">
                        {fundingStatus || 'Send MON to this address to fund your agent for trading.'}
                      </p>
                    </div>
                  )}
                  {txHash && (
                    <a 
                      href={`https://${networkConfig.isMainnet ? '' : 'testnet.'}monadvision.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 mt-3 text-sm text-primary-400 hover:text-primary-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Explorer
                    </a>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => router.push('/agents')} variant="secondary">
                    View All Agents
                  </Button>
                  <Button onClick={() => router.push('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        {/* Footer Navigation */}
        {step < 4 && (
          <div className="flex items-center justify-between p-6 border-t border-white/10">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}
            
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !isStep1Valid) ||
                  (step === 2 && !isStep2Valid)
                }
                className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-cyan-500 border-0"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleRegister}
                disabled={isRegistering}
                className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-cyan-500 border-0"
              >
                {isRegistering ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {fundingStatus || 'Registering...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Mint Agent Identity
                  </span>
                )}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CreateAgentPage() {
  return (
    <DashboardLayout showFooter={false}>
      <CreateAgentContent />
    </DashboardLayout>
  );
}
