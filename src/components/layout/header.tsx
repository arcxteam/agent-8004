'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Agents', href: '/agents' },
  { name: 'Trading', href: '/trading' },
  { name: 'Portfolio', href: '/portfolio' },
  { name: 'Leaderboard', href: '/leaderboard' },
  { name: 'Yield', href: '/yield' },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  
  // Reown AppKit hooks
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get deterministic random agent avatar based on wallet address
  const getAgentAvatar = (addr: string) => {
    // Use address bytes to generate a consistent number between 1-100
    const addressNum = parseInt(addr.slice(2, 10), 16);
    const avatarNum = (addressNum % 200) + 1;
    return `/agents/agent-${avatarNum}.png`;
  };

  // Check if we're on a dashboard page (where sidebar is visible on desktop)
  const isDashboardPage = pathname !== '/' && (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/trading') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/yield') ||
    pathname.startsWith('/settings')
  );

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0f0f1a]/95 backdrop-blur-md border-b border-white/5 py-2'
          : 'bg-[#0f0f1a]/90 backdrop-blur-sm py-3',
        // On dashboard pages with sidebar, adjust left margin on desktop
        isDashboardPage && 'lg:left-[280px] lg:right-0'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo - hidden on desktop dashboard pages since sidebar has logo */}
          <Link 
            href="/" 
            className={cn(
              "flex items-center gap-3 group",
              isDashboardPage && "lg:hidden",
              // On mobile dashboard pages, add left margin for hamburger button
              isDashboardPage && "ml-12 lg:ml-0"
            )}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image
                src="/logo.png"
                alt="ANOA Network"
                width={100}
                height={100}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                ANOA Network
              </span>
              <span className="hidden sm:block text-xs text-white/40 font-semibold text-lg font-bold mb-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-purple-500 bg-clip-text text-transparent">
                Trustless AI Agents
              </span>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'relative px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive ? 'text-white' : 'text-white/60 hover:text-white'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-white/10 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Wallet Connect */}
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                {/* Network Button */}
                <button
                  onClick={() => open({ view: 'Networks' })}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Image 
                    src="/icons/monad.png" 
                    alt="Monad" 
                    width={20} 
                    height={20} 
                    className="rounded-full"
                  />
                  <span className="text-sm text-white/80 hidden sm:block">
                    {caipNetwork?.name || 'Network'}
                  </span>
                </button>

                {/* Account Button */}
                <button
                  onClick={() => open({ view: 'Account' })}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-primary-500/30">
                    <Image
                      src={getAgentAvatar(address)}
                      alt="Avatar"
                      width={24}
                      height={24}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    {formatAddress(address)}
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => open()}
                className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Connect Wallet
              </button>
            )}

            {/* Mobile Menu Button - only shown on landing page (homepage) */}
            {!isDashboardPage && (
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
              >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation - only shown on landing page (homepage) */}
      {!isDashboardPage && (
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-[#0a0a12]/95 backdrop-blur-xl"
            >
              <nav className="px-4 py-4 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'block px-4 py-3 rounded-xl transition-colors',
                        isActive 
                          ? 'bg-primary-600/20 text-white' 
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </header>
  );
}
