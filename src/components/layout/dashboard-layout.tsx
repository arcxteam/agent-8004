'use client';

import * as React from 'react';
import { Menu, X } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Footer } from '@/components/layout/footer';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  /**
   * Whether to show the footer inside the main content area
   */
  showFooter?: boolean;
  /**
   * Additional className for the main content area
   */
  className?: string;
}

/**
 * Shared dashboard layout component that provides consistent layout
 * across all dashboard pages with proper overflow handling.
 */
export function DashboardLayout({ 
  children, 
  showFooter = true,
  className 
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      {/* Mobile Hamburger Button - Fixed position */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          'fixed top-4 left-4 z-[60] p-2 rounded-xl lg:hidden',
          'bg-[#1a1a2e]/90 backdrop-blur-md border border-white/10',
          'text-white/80 hover:text-white hover:bg-[#1a1a2e] transition-all'
        )}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>
      
      {/* Sidebar - fixed on desktop, overlay on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[280px]">
        {/* Header */}
        <Header />
        
        {/* Main content */}
        <main className={cn(
          'flex-1 pt-16 px-4 sm:px-6 lg:px-8 pb-8',
          'max-w-full overflow-x-hidden',
          className
        )}>
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        {showFooter && <Footer />}
      </div>
    </div>
  );
}

export default DashboardLayout;
