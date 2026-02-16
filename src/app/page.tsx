'use client';

import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import Typewriter from 'typewriter-effect';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import {
  Lock,
  BarChart3,
  Zap,
  ShieldCheck,
  DollarSign,
  Sparkles,
  Users,
  ArrowRight,
  Plus,
  Wallet,
  Bot,
  HandCoins,
  Eye,
  Layers,
  TrendingUp,
  LayersPlus,
  Globe,
  Fingerprint,
  CircuitBoard,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RandomCyclingAvatar } from '@/components/ui/agent-avatar';
import { useGlobalStats } from '@/hooks/useGlobalStats';
import RoadmapTimeline from '@/components/layout/roadmap';

// Pre-calculated particle positions for deterministic rendering
const PARTICLE_POSITIONS = [
  { left: 5, top: 10, duration: 6, delay: 1 },
  { left: 15, top: 25, duration: 7, delay: 2 },
  { left: 25, top: 40, duration: 8, delay: 0.5 },
  { left: 35, top: 15, duration: 5.5, delay: 3 },
  { left: 45, top: 55, duration: 9, delay: 1.5 },
  { left: 55, top: 30, duration: 6.5, delay: 4 },
  { left: 65, top: 70, duration: 7.5, delay: 2.5 },
  { left: 75, top: 45, duration: 8.5, delay: 0 },
  { left: 85, top: 20, duration: 5, delay: 3.5 },
  { left: 95, top: 60, duration: 9.5, delay: 1 },
  { left: 10, top: 80, duration: 6, delay: 4.5 },
  { left: 20, top: 65, duration: 7, delay: 2 },
  { left: 30, top: 85, duration: 8, delay: 0.5 },
  { left: 40, top: 75, duration: 5.5, delay: 3 },
  { left: 50, top: 90, duration: 9, delay: 1.5 },
  { left: 60, top: 5, duration: 6.5, delay: 4 },
  { left: 70, top: 35, duration: 7.5, delay: 2.5 },
  { left: 80, top: 50, duration: 8.5, delay: 0 },
  { left: 90, top: 95, duration: 5, delay: 3.5 },
  { left: 50, top: 50, duration: 9.5, delay: 1 },
];

// partner logos for the marquee section
const PARTNER_LOGOS = [
  { name: 'Monad Foundation', src: '/partner/monad-foundation.png' },
  { name: 'nad.fun', src: '/partner/nadfun.png' },
  { name: 'LiFi', src: '/partner/lifi-dex.png' },
  { name: 'Relay', src: '/partner/relaylink.png' },
  { name: 'Cloudflare', src: '/partner/cloudflare.png' },
  { name: 'CoinGecko', src: '/partner/coingecko.png' },
  { name: 'DexScreener', src: '/partner/dexscener.png' },
];

// ============================================================================
// Animated background component
// ============================================================================
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Aurora glow layer — behind everything, very large & slow */}
      <div
        className="absolute top-[-30%] left-[-20%] w-[900px] h-[900px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(41, 11, 49, 0.8) 0%, rgba(139, 92, 246, 0.15) 40%, transparent 70%)',
          animation: 'aurora-drift-1 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-15%] w-[800px] h-[800px] rounded-full opacity-35"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.1) 40%, transparent 70%)',
          animation: 'aurora-drift-2 30s ease-in-out infinite',
        }}
      />

      {/* Gradient orbs */}
      <motion.div
        className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -30, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute top-[40%] left-[20%] w-[400px] h-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          x: [0, 40, 0],
          y: [0, -40, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Floating particles - pre-calculated positions */}
      {PARTICLE_POSITIONS.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Animated Counter — count-up effect when scrolled into view
// ============================================================================
function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    // Extract numeric part from value (handles "$1.2M", "82.5", "+12", etc.)
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const target = parseFloat(cleanValue);
    if (isNaN(target) || target === 0) {
      setDisplay(value);
      return;
    }

    const prefix = value.match(/^[^0-9]*/)?.[0] || '';
    const suffixPart = value.match(/[^0-9.]*$/)?.[0] || '';
    const hasDecimal = cleanValue.includes('.');
    const decimalPlaces = hasDecimal ? (cleanValue.split('.')[1]?.length || 0) : 0;

    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      // Ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        const formatted = hasDecimal ? current.toFixed(decimalPlaces) : Math.floor(current).toLocaleString();
        setDisplay(`${prefix}${formatted}${suffixPart}`);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return <span ref={ref}>{display}</span>;
}

// ============================================================================
// Section Glow Divider — decorative glow between sections
// ============================================================================
function SectionGlowDivider() {
  return (
    <motion.div
      className="section-glow-divider"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    />
  );
}

// ============================================================================
// Stats ticker component
// ============================================================================
function StatsTicker() {
  const { stats, isLoading } = useGlobalStats();

  const displayStats = [
    {
      label: 'Total Value Locked',
      value: isLoading ? '...' : stats.formattedTvl,
      change: stats.tvlChange,
    },
    {
      label: 'Active Agents',
      value: isLoading ? '...' : stats.totalAgents.toLocaleString(),
      change: stats.totalAgents > 0 ? `+${stats.totalAgents}` : '+0',
    },
    {
      label: 'Total Trades',
      value: isLoading ? '...' : stats.totalTrades.toLocaleString(),
      change: `+${stats.totalTrades}`,
    },
    {
      label: 'Avg Trust Score',
      value: isLoading ? '...' : stats.avgTrustScore.toFixed(1),
      change: stats.avgTrustScore > 0 ? `+${stats.avgTrustScore.toFixed(1)}` : '+0',
    },
  ];

  return (
    <div className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-8 overflow-x-auto bg-gradient-to-r from-purple-500 to-green-500 bg-clip-text text-transparent">
          {displayStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-4 min-w-fit"
            >
              <div>
                <div className="text-xs text-white/40">{stat.label}</div>
                <div className="text-xl font-bold text-white">
                  {isLoading ? stat.value : <AnimatedCounter value={stat.value} />}
                </div>
              </div>
              <Badge variant="success" size="sm" dot>
                {stat.change}
              </Badge>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Protocol Badge Marquee
// ============================================================================
function ProtocolBadges() {
  const protocols = [
    'ERC-8004', 'A2A Protocol', 'MCP Server', 'x402 Payment',
    'On-Chain Identity', 'Reputation System', 'Validation Artifacts',
    'Risk Router', 'PnL Tracking', 'Capital Vault',
  ];

  return (
    <div className="relative overflow-hidden py-4">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-bg-primary to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-bg-primary to-transparent z-10" />
      <motion.div
        className="flex gap-4 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {[...protocols, ...protocols].map((p, i) => (
          <span
            key={i}
            className="inline-flex items-center px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs font-medium text-purple-300/80"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 mr-2" />
            {p}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Feature card component
// ============================================================================
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="group relative h-full"
    >
      {/* Outer glow ring on hover */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-purple-500/20 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f0a20] to-[#080510] border border-white/[0.06] group-hover:border-purple-500/30 transition-all duration-500 h-full hover:-translate-y-1">
        {/* Canvas background layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.08)_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.04)_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none" />

        {/* Top accent line */}
        <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

        {/* Content */}
        <div className="relative p-6 sm:p-7">
          {/* Icon — purple gradient background */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 group-hover:scale-105 transition-all duration-300">
            {icon}
          </div>

          <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-purple-50 transition-colors duration-300">{title}</h3>
          <p className="text-sm text-white/45 leading-relaxed">{description}</p>
        </div>

        {/* Bottom corner decoration */}
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/[0.04] to-transparent pointer-events-none rounded-tl-full" />

        {/* Bottom accent line on hover */}
        <div className="absolute bottom-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </motion.div>
  );
}

// ============================================================================
// How it works step component
// ============================================================================
function HowItWorksStep({
  step,
  title,
  description,
  icon,
  delay,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="flex gap-4 group"
    >
      <div className="flex-shrink-0 relative">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
          {step}
        </div>
        {step < 4 && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-px h-10 bg-gradient-to-b from-purple-500/40 to-transparent" />
        )}
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-purple-400">{icon}</span>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Architecture Diagram
// ============================================================================
function ArchitectureDiagram() {
  const layers = [
    {
      label: 'AI Agent Layer',
      items: ['Strategy Engine', 'Risk Assessment', 'Market Analysis'],
      color: 'from-purple-500 to-violet-600',
      Icon: LayersPlus,
    },
    {
      label: 'Protocol Layer',
      items: ['A2A Protocol', 'MCP Server', 'x402 Payments'],
      color: 'from-cyan-500 to-blue-600',
      Icon: Globe,
    },
    {
      label: 'Trust Layer',
      items: ['Identity Registry', 'Reputation System', 'Validation'],
      color: 'from-emerald-500 to-teal-600',
      Icon: Fingerprint,
    },
    {
      label: 'Execution Layer',
      items: ['Capital Vault', 'Risk Router', 'DEX Integration'],
      color: 'from-amber-500 to-orange-600',
      Icon: CircuitBoard,
    },
  ];

  return (
    <div className="space-y-3">
      {layers.map((layer, i) => (
        <motion.div
          key={layer.label}
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.15 }}
          className="relative"
        >
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-purple-500/20 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${layer.color}`} />
              <layer.Icon className="w-4 h-4 text-white/60" />
              <span className="text-sm font-semibold text-white">{layer.label}</span>
            </div>
            <div className="flex flex-wrap gap-2 ml-5">
              {layer.items.map((item) => (
                <span
                  key={item}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] text-white/50 border border-white/[0.04]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="absolute -bottom-2 left-8 w-px h-3 bg-gradient-to-b from-white/10 to-transparent" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// RoadmapTimeline is now imported from @/components/layout/roadmap

// ============================================================================
// Main Landing Page
// ============================================================================
export default function LandingPage() {
  return (
    <div className="min-h-screen noise-overlay">
      <Header />

      {/* ================================================================ */}
      {/* HERO SECTION */}
      {/* ================================================================ */}
      <section className="relative min-h-screen flex items-center pt-20">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="mb-6">
                <span className="w-2 h-2 rounded-lg bg-red-500/20 text-red-500 border-purple-500/30 animate-pulse mr-2"/>
                ANOA - Live on MONAD
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight text-center max-w-4xl mx-auto"
            >
                <span className="block">
                <span className="block h-[4.5rem] sm:h-[5rem] lg:h-[6rem] flex items-center justify-center overflow-hidden">
                  <Typewriter
                  options={{
                    strings: [
                    'Beyond <span class="bg-gradient-to-r from-red-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">Agent to Agent</span>'
                    ],
                    autoStart: true,
                    loop: true,
                    delay: 75,
                    deleteSpeed: 50
                  }}
                  />
                </span>
                </span>

              <span className="block mt-1">
              ANOA is
              </span>

              <span className="block mt-1">
              <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-red-500 bg-clip-text text-transparent">
                Proof&#8209;Anchored
              </span>{' '}
                Intelligence
              </span>

              <span className="block mt-1">
                for{' '}
              <span className="bg-gradient-to-r from-primary-400 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                Autonomous Trading
              </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-lg text-white/60 max-w-2xl mx-auto"
            >
              Move beyond black-box strategies. Deploy AI agents with verifiable onchain execution.
              Built with ERC-8004 standard for identity, reputation, and validation—enabling trustless operations
              in DeFi markets where every trade is provable, every decision is verifiable.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/dashboard">
                <Button size="lg" className="px-8">
                  <span className="font-bold bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
                  Launch App
                  </span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <Link href="https://cuannode.greyscope.xyz/">
                <Button size="lg" className="px-8">
                  <span className="font-bold bg-gradient-to-r from-purple-500 to-green-500 bg-clip-text text-transparent">
                  Read Docs
                  </span>
                </Button>
              </Link>
            </motion.div>

            {/* Hero illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-16 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-transparent z-10" />
              <div className="glass rounded-2xl p-6 border border-white/10 mx-auto max-w-3xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-4 text-xs text-white/40">
                    Agent Dashboard
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 bg-white/5 rounded-xl p-4 h-40">
                    <div className="text-xs text-white/40 mb-2">
                      Performance Chart
                    </div>
                    <div className="flex items-end gap-1 h-24">
                      {[40, 65, 45, 80, 55, 70, 90, 75, 85, 95].map((h, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-green-500 to-purple-500 rounded-sm"
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ delay: 0.8 + i * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-xs text-white/40">Trust Score</div>
                      <div className="text-2xl font-bold bg-gradient-to-t from-green-500 to-purple-500 bg-clip-text text-transparent">
                        98.5
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-xs text-white/40">24h PnL</div>
                      <div className="text-2xl font-bold bg-gradient-to-t from-green-500 to-purple-500 bg-clip-text text-transparent">
                        +12.4%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* STATS TICKER */}
      {/* ================================================================ */}
      <StatsTicker />

      {/* ================================================================ */}
      {/* PROTOCOL BADGES MARQUEE */}
      {/* ================================================================ */}
      <ProtocolBadges />

      {/* Glow divider */}
      <SectionGlowDivider />

      {/* ================================================================ */}
      {/* FEATURES SECTION */}
      {/* ================================================================ */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
              Features
            </Badge>
            <h2 className="text-4xl font-bold text-white mb-4">
              Why <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">We Buidl</span> ANOA?
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              The most advanced trustless AI agent platform, built for
              autonomous on-chain trading with verifiable execution.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Lock className="w-6 h-6 text-white" />}
              title="Trustless Execution"
              description="Every trade intent is EIP-712 signed, risk-checked, and executed with on-chain proof. No black boxes — verify every agent decision through ERC-8004 identity and reputation artifacts."
              delay={0.1}
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-white" />}
              title="On-Chain Reputation"
              description="Agents earn trust scores through verifiable performance. The ERC-8004 Reputation Registry tracks feedback, PnL outcomes, and win rates — all visible on-chain."
              delay={0.2}
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-white" />}
              title="Monad Performance"
              description="Built on Monad's 10,000 TPS network with 400ms block times. Execute 6 agent strategies at unmatched speed with near-instant settlement."
              delay={0.3}
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6 text-white" />}
              title="Multi-Agent Intelligence"
              description="Two AI agents work in parallel — a Market Analyst runs bull/bear debate with 5 trading tools while a Risk Manager evaluates 6 risk dimensions. Agents learn from past trades via BM25 memory retrieval."
              delay={0.4}
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6 text-white" />}
              title="Strategy Architecture"
              description="Trade across 53+ tokens via three specialized routers — Nad.Fun, LiFi DEX aggregator, and Relay Protocol solver. Auto-detect best path per token with retry mechanism and fail-safe protection."
              delay={0.5}
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-white" />}
              title="Capital Delegation"
              description="Delegate capital to top-performing agents via the Capital Vault smart contract. Follow their trades on-chain like copy trading — fully transparent, trustless, with pro-rata PnL distribution."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Glow divider */}
      <SectionGlowDivider />

      {/* ================================================================ */}
      {/* HOW IT WORKS */}
      {/* ================================================================ */}
      <section className="py-24 bg-surface-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
                  Getting Started
                </Badge>
                <h2 className="text-4xl font-bold text-white mb-6">
                  Deploy First <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">Agent</span> in Minutes
                </h2>
                <p className="text-white/60 mb-10">
                  Get started with trustless AI trading in four simple steps.
                  No coding required.
                </p>
              </motion.div>

              <div>
                <HowItWorksStep
                  step={1}
                  title="Connect Your Wallet"
                  description="Connect with MetaMask, Rabby, or your preferred wallet to access the platform."
                  icon={<Wallet className="w-4 h-4" />}
                  delay={0.1}
                />
                <HowItWorksStep
                  step={2}
                  title="Create an Agent"
                  description="Configure your agent's strategy, risk parameters, and delegation limits."
                  icon={<Bot className="w-4 h-4" />}
                  delay={0.2}
                />
                <HowItWorksStep
                  step={3}
                  title="Fund & Delegate"
                  description="Deposit funds or delegate A2A trading permissions to agents using ERC-8004."
                  icon={<HandCoins className="w-4 h-4" />}
                  delay={0.3}
                />
                <HowItWorksStep
                  step={4}
                  title="Monitor & Earn"
                  description="Track performance in real-time. All actions are verifiable on-chain."
                  icon={<Eye className="w-4 h-4" />}
                  delay={0.4}
                />
              </div>
            </div>

            {/* Visual representation */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
              <Card variant="glass" className="relative">
                <CardContent className="pt-6 space-y-6">
                  {/* Agent preview */}
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                    <RandomCyclingAvatar
                      cycleCount={10}
                      interval={2500}
                      size="lg"
                      gradientBorder
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          Alpha Hunter
                        </span>
                        <Badge variant="success" size="sm" dot>
                          Active
                        </Badge>
                      </div>
                      <div className="text-sm text-white/60">
                        Momentum Trading Strategy
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold bg-gradient-to-t from-green-300 to-green-500 bg-clip-text text-transparent">+34.5%</div>
                      <div className="text-xs text-white/40">30d Return</div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-xs text-white/40 mb-1">
                        Trust Score
                      </div>
                      <div className="text-2xl font-bold text-white">96.8</div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                        <div
                          className="from-purple-500 to-purple-800 bg-gradient-to-t h-1.5 rounded-full"
                          style={{ width: '96.8%' }}
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-xs text-white/40 mb-1">
                        Total Trades
                      </div>
                      <div className="text-2xl font-bold text-white">1,247</div>
                      <div className="text-xs text-white/40 mt-2">
                        89% Win Rate
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-xs text-white/40 mb-1">
                        Sharpe Ratio
                      </div>
                      <div className="text-2xl font-bold text-white">2.14</div>
                      <div className="text-xs from-green-400 to-green-500 bg-gradient-to-t bg-clip-text text-transparent mt-2">
                        Above benchmark
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-xs text-white/40 mb-1">
                        Max Drawdown
                      </div>
                      <div className="text-2xl font-bold bg-gradient-to-t from-red-400 to-red-500 bg-clip-text text-transparent">-4.2%</div>
                      <div className="text-xs text-white/40 mt-2">
                        12 Delegators
                      </div>
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div>
                    <div className="text-sm font-medium text-white mb-3">
                      Recent Activity
                    </div>
                    <div className="space-y-2">
                      {[
                        { action: 'Buy', token: 'MONAD', amount: '500', time: '2m ago' },
                        { action: 'Sell', token: 'USDC', amount: '1,200', time: '5m ago' },
                        { action: 'Delegate', token: 'MON', amount: '2,000', time: '8m ago' },
                      ].map((tx, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={tx.action === 'Buy' ? 'success' : tx.action === 'Sell' ? 'danger' : 'info'}
                              size="sm"
                            >
                              {tx.action}
                            </Badge>
                            <span className="text-white">{tx.token}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-white/80">${tx.amount}</span>
                            <span className="text-white/40">{tx.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Glow divider */}
      <SectionGlowDivider />

      {/* ================================================================ */}
      {/* EARN WITH AGENT to AGENT — Delegate Capital */}
      {/* ================================================================ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0820] via-[#130a2e] to-bg-primary" />
        <div className="absolute inset-0 grid-pattern opacity-20" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
              Earn Agent to Agent
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Delegate Capital,{' '}
              <span className="bg-gradient-to-br from-gray-200 to-gray-800 bg-clip-text text-transparent">
                With Trustlessly
              </span>
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto text-base leading-relaxed">
              AI agents execute verified strategies while you retain full control. Capital delegation
              with on-chain proof of performance — every trade, every return, fully transparent.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Capital Vault',
                desc: 'Delegate MON to top-performing agents and follow their trades on-chain — like copy trading but fully trustless. View agent reputation, PnL, and win rate before delegating.',
                stat: 'A2A Copying',
                Icon: Layers,
              },
              {
                title: 'AI Trading Strategies',
                desc: 'AI-powered strategies including Momentum Trading, Grid Trading Bot, DCA Accumulator, Flash Arbitrage, Yield Strategy & Hedge . Each managed by verified autonomous agents.',
                stat: 'Use 6+ Strategies',
                Icon: TrendingUp,
              },
              {
                title: 'Risk-Managed',
                desc: 'Every strategy operates within defined risk parameters. Agents are monitored for max drawdown, Sharpe ratio, PnL, and win rate — all tracked on-chain through the leaderboard.',
                stat: 'On-Chain Risk',
                Icon: ShieldCheck,
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative h-full"
              >
                {/* Outer glow ring on hover */}
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-purple-500/20 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f0a20] to-[#080510] border border-white/[0.06] group-hover:border-purple-500/30 transition-all duration-500 h-full hover:-translate-y-1">
                  {/* Canvas background layers */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.08)_0%,_transparent_60%)] pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.04)_0%,_transparent_60%)] pointer-events-none" />
                  <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none" />

                  {/* Top accent line */}
                  <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

                  <div className="relative p-6 sm:p-7">
                    {/* Icon — purple gradient */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 group-hover:scale-105 transition-all duration-300">
                      <item.Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-50 transition-colors duration-300">{item.title}</h3>
                    <p className="text-sm text-white/45 leading-relaxed mb-6">{item.desc}</p>
                    <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06] text-sm font-medium text-purple-300">
                      {item.stat}
                    </div>
                  </div>

                  {/* Bottom corner decoration */}
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/[0.04] to-transparent pointer-events-none rounded-tl-full" />

                  {/* Bottom accent line on hover */}
                  <div className="absolute bottom-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PROTOCOL ARCHITECTURE */}
      {/* ================================================================ */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
                Architecture
              </Badge>
              <h2 className="text-4xl font-bold text-white mb-4">
                Protocol{' '}
                <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
                  Architecture
                </span>
              </h2>
              <p className="text-white/60 mb-6 leading-relaxed">
                ANOA is built on a layered architecture that separates concerns between AI intelligence,
                protocol communication, trust verification, and on-chain execution. Each layer is independently
                auditable and composable.
              </p>
              <div className="space-y-3 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <LayersPlus className="w-4 h-4 text-purple-400" />
                  <span><strong className="text-white">AI Layer</strong> — Strategy logic and risk assessment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span><strong className="text-white">Protocol Layer</strong> — Agent-to-agent communication</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span><strong className="text-white">Trust Layer</strong> — EIP-8004-712-2612 (sign-permit identity and reputation)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CircuitBoard className="w-4 h-4 text-amber-400" />
                  <span><strong className="text-white">Execution Layer</strong> — On-chain capital and DEX routing</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <ArchitectureDiagram />
            </motion.div>
          </div>
        </div>
      </section>

      <SectionGlowDivider />

      {/* ================================================================ */}
      {/* ROADMAP / TIMELINE */}
      {/* ================================================================ */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-[#0d0820] to-bg-primary" />
        <div className="absolute inset-0 grid-pattern opacity-15" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
              Timelines
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Protocol{' '}
              <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-green-500 bg-clip-text text-transparent">
                Roadmap
              </span>
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto text-base leading-relaxed">
              From ERC-8004 identity to multi-agent swarm intelligence —
              our phased approach to building the most advanced trustless AI agent protocol on Monad.
            </p>
          </motion.div>

          <RoadmapTimeline />
        </div>
      </section>

      {/* ================================================================ */}
      {/* OUR PARTNERS */}
      {/* ================================================================ */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-[#0a0a0f] to-bg-primary" />
        <div className="absolute inset-0 grid-pattern opacity-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 bg-gradient-to-r from-purple-500 to-red-500 bg-clip-text text-transparent">
              Infrastructure
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Our{' '}
              <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
                Partners
              </span>
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto text-base leading-relaxed">
              Powered by the leading protocols and infrastructure in the Monad ecosystem.
            </p>
          </motion.div>

          {/* Partner Marquee */}
          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

            <div
              className="flex"
              style={{ animation: 'marquee-scroll 60s linear infinite' }}
            >
              {/* Set A — original logos */}
              <div className="flex shrink-0 items-center gap-12 sm:gap-20 pr-12 sm:pr-20">
                {PARTNER_LOGOS.map((partner, i) => (
                  <div
                    key={`a-${partner.name}`}
                    className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={partner.src}
                      alt={partner.name}
                      className="h-10 sm:h-14 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              {/* Set B — duplicate for seamless loop */}
              <div className="flex shrink-0 items-center gap-12 sm:gap-20 pr-12 sm:pr-20" aria-hidden="true">
                {PARTNER_LOGOS.map((partner, i) => (
                  <div
                    key={`b-${partner.name}`}
                    className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={partner.src}
                      alt={partner.name}
                      className="h-10 sm:h-14 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionGlowDivider />

      {/* ================================================================ */}
      {/* CTA SECTION */}
      {/* ================================================================ */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 via-purple-600/20" />
        <div className="absolute inset-0 grid-pattern opacity-20" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              <span className="bg-gradient-to-br from-gray-100 to-gray-500 bg-clip-text text-transparent">
              Ready to Deploy Your First Agent?
              </span>
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
              Join thousands of traders using ANOA to automate their DeFi
              strategies with trustless, verifiable AI agents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/agents/create">
                <Button size="xl" className="px-10">
                  <span className="font-bold bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
                  Create Agent Now
                  </span>
                  <Plus className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant="secondary" size="xl">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
