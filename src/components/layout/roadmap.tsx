'use client';

import { motion } from 'framer-motion';
import {
  Combine,
  Blend,
  Component,
  Sparkles,
  Orbit,
  CircleCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RandomCyclingAvatar } from '@/components/ui/agent-avatar';

const ROADMAP_PHASES = [
  {
    id: 1,
    title: 'Foundation Phase',
    subtitle: 'Completed',
    status: 'completed' as const,
    progress: 100,
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-500/20 hover:border-emerald-400/40',
    bgGradient: 'from-emerald-500/10 to-teal-500/5',
    iconColor: 'text-emerald-400',
    Icon: Combine,
    items: [
      { label: 'ERC-8004 Identity & Reputation Registry', done: true },
      { label: 'Smart Contracts (Core + Vault)', done: true },
      { label: 'Agent Creation & Registration Flow', done: true },
      { label: 'NAD.FUN DEX Integration', done: true },
      { label: 'x402 Payment Protocol', done: true },
      { label: 'A2A Protocol (JSON-RPC 2.0)', done: true },
      { label: 'Capital Delegation Vault', done: true },
      { label: 'Sandbox Capital Agent', done: true },
    ],
  },
  {
    id: 2,
    title: 'Trading & Intelligence',
    subtitle: 'Completed',
    status: 'completed' as const,
    progress: 100,
    color: 'from-purple-500 to-violet-600',
    borderColor: 'border-purple-500/20 hover:border-purple-400/40',
    bgGradient: 'from-purple-500/10 to-violet-500/5',
    iconColor: 'text-purple-400',
    Icon: Blend,
    items: [
      { label: 'Live Execution via NAD.FUN', done: true },
      { label: 'EIP-712 Signed Trade Intents', done: true },
      { label: 'PnL Tracking, Risk Guard/Metrics', done: true },
      { label: 'Reputation Auto-Feedback', done: true },
      { label: 'MCP Server Implementation', done: true },
      { label: 'OpenClaw, Enhanced AI-Advisor & Judgement', done: true },
      { label: 'Engine Strategy, Trade-memory/Indicator ', done: true },
    ],
  },
  {
    id: 3,
    title: 'DeFi Expansion',
    subtitle: 'Current',
    status: 'active' as const,
    progress: 15,
    color: 'from-cyan-500 to-blue-600',
    borderColor: 'border-cyan-500/20 hover:border-cyan-400/40',
    bgGradient: 'from-cyan-500/10 to-blue-500/5',
    iconColor: 'text-cyan-400',
    Icon: Component,
    items: [
      { label: 'Coingecko Terminal', done: true },
      { label: 'DEX Screener Terminal', done: true },
      { label: 'Scans DEX Aggregation', done: false },
      { label: 'LiFi DEX', done: true },
      { label: 'RelayLink Cross-Chain/Routers', done: true },
      { label: 'Uniswap V3 AMM Pools', done: false },
      { label: 'Curve Finance Strategies', done: false },
      { label: 'Advanced Yield Strategies', done: false },
    ],
  },
  {
    id: 4,
    title: 'Agent Intelligence',
    subtitle: 'Planned',
    status: 'upcoming' as const,
    progress: 5,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-500/20 hover:border-amber-400/40',
    bgGradient: 'from-amber-500/10 to-orange-500/5',
    iconColor: 'text-amber-400',
    Icon: Sparkles,
    items: [
      { label: 'Multi-Agent Orchestration', done: false },
      { label: 'Swarm Coordination', done: false },
      { label: 'TEE Attestation Support', done: false },
      { label: 'Advanced Validation Models', done: false },
      { label: 'News/Sentiment Analysis', done: false },
      { label: 'Fundamentals Analysis', done: false },
      { label: 'Multi-Agent Debate', done: false },
    ],
  },
  {
    id: 5,
    title: 'Expansion Launch',
    subtitle: 'Future',
    status: 'upcoming' as const,
    progress: 2,
    color: 'from-pink-500 to-rose-600',
    borderColor: 'border-pink-500/20 hover:border-pink-400/40',
    bgGradient: 'from-pink-500/10 to-rose-500/5',
    iconColor: 'text-pink-400',
    Icon: Orbit,
    items: [
      { label: 'Expansion EVM Compatible', done: false },
      { label: 'Security Audit', done: false },
      { label: 'SDK Release', done: false },
      { label: 'Public Documentation', done: false },
    ],
  },
];

export default function RoadmapTimeline() {
  return (
    <div className="relative">
      {/* Single decorative cycling avatar — hidden on mobile */}
      <div className="hidden lg:block pointer-events-none absolute top-0 right-8 opacity-20 z-0">
        <RandomCyclingAvatar cycleCount={5} interval={3000} size="lg" gradientBorder />
      </div>

      {/* Protocol progress beam */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 relative z-10"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Protocol Progress</span>
          <span className="text-xs font-mono text-cyan-400">Phase 2 — 100% Complete</span>
        </div>
        <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-purple-500 to-purple-500/20 rounded-full"
            initial={{ width: '0%' }}
            whileInView={{ width: '43%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
        <div className="relative flex justify-between mt-3">
          {ROADMAP_PHASES.map((phase) => (
            <div key={phase.id} className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 border-bg-primary ${
                  phase.status === 'completed'
                    ? 'bg-emerald-500'
                    : phase.status === 'active'
                    ? 'bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]'
                    : 'bg-white/20'
                }`}
              />
              <span className={`text-[10px] mt-1.5 ${
                phase.status === 'completed' ? 'text-emerald-400' : phase.status === 'active' ? 'text-purple-400' : 'text-white/30'
              }`}>
                {phase.id}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Phase cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3 relative z-10">
        {ROADMAP_PHASES.map((phase, index) => (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="h-full"
          >
            <Card
              variant="glass"
              className={`h-full border ${phase.borderColor} bg-gradient-to-b ${phase.bgGradient} relative overflow-hidden transition-all duration-300`}
            >
              {/* Active/completed phase glow */}
              {(phase.status === 'active' || phase.status === 'completed') && (
                <div className={`absolute inset-0 rounded-2xl ${phase.status === 'completed' ? 'bg-emerald-500/5' : 'bg-purple-500/5 animate-pulse-glow'}`} />
              )}

              <CardContent className="pt-5 pb-5 px-4 relative z-10">
                {/* Header row: Icon + Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg`}>
                    <phase.Icon className="w-4 h-4 text-white" />
                  </div>
                  <Badge
                    variant={phase.status === 'completed' ? 'success' : phase.status === 'active' ? 'primary' : 'secondary'}
                    dot={phase.status === 'active'}
                  >
                    {phase.subtitle}
                  </Badge>
                </div>

                {/* Phase title */}
                <h3 className="text-sm font-bold text-white mb-0.5">
                  Phase {phase.id}
                </h3>
                <p className={`text-xs font-semibold ${phase.iconColor} mb-3`}>
                  {phase.title}
                </p>

                {/* Progress bar for active/completed phase */}
                {(phase.status === 'active' || phase.status === 'completed') && (
                  <div className="mb-3">
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${phase.color} rounded-full`}
                        initial={{ width: '0%' }}
                        whileInView={{ width: `${phase.progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-[10px] text-white/40">{phase.progress}%</span>
                    </div>
                  </div>
                )}

                {/* Item checklist */}
                <div className="space-y-1.5">
                  {phase.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {item.done ? (
                        <CircleCheck className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20 mt-0.5 flex-shrink-0" />
                      )}
                      <span className={`text-[11px] leading-tight ${
                        item.done ? 'text-white/60' : 'text-white/40'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
