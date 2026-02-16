---
name: color-theme-system
description: Comprehensive color and theme system for web applications. Includes semantic color tokens, dark/light mode, CSS variables, Tailwind configuration, and accessible color palettes for blockchain and AI applications.
---

# Color & Theme System

## CSS Custom Properties Foundation

```css
/* styles/tokens.css */
:root {
  /* === Base Colors === */
  
  /* Primary - Electric Purple (AI/Agent) */
  --color-primary-50: #f5f3ff;
  --color-primary-100: #ede9fe;
  --color-primary-200: #ddd6fe;
  --color-primary-300: #c4b5fd;
  --color-primary-400: #a78bfa;
  --color-primary-500: #8b5cf6;
  --color-primary-600: #7c3aed;
  --color-primary-700: #6d28d9;
  --color-primary-800: #5b21b6;
  --color-primary-900: #4c1d95;
  --color-primary-950: #2e1065;

  /* Cyan - Digital/Blockchain */
  --color-cyan-50: #ecfeff;
  --color-cyan-100: #cffafe;
  --color-cyan-200: #a5f3fc;
  --color-cyan-300: #67e8f9;
  --color-cyan-400: #22d3ee;
  --color-cyan-500: #06b6d4;
  --color-cyan-600: #0891b2;
  --color-cyan-700: #0e7490;
  --color-cyan-800: #155e75;
  --color-cyan-900: #164e63;
  --color-cyan-950: #083344;

  /* Success - Green */
  --color-success-50: #f0fdf4;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;

  /* Warning - Amber */
  --color-warning-50: #fffbeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;

  /* Error - Red */
  --color-error-50: #fef2f2;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;

  /* === Dark Theme (Default) === */
  --color-bg-base: #0a0a0f;
  --color-bg-surface: #111118;
  --color-bg-elevated: #1a1a24;
  --color-bg-subtle: #242432;
  
  --color-border-base: #2a2a3a;
  --color-border-subtle: #1f1f2e;
  --color-border-strong: #3a3a4a;
  
  --color-text-primary: #ffffff;
  --color-text-secondary: #a1a1aa;
  --color-text-tertiary: #71717a;
  --color-text-placeholder: #52525b;
  
  /* Semantic tokens */
  --color-accent: var(--color-primary-500);
  --color-accent-hover: var(--color-primary-400);
  --color-accent-active: var(--color-primary-600);
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, var(--color-primary-600), var(--color-cyan-500));
  --gradient-glow: radial-gradient(ellipse at center, var(--color-primary-500) 0%, transparent 70%);
  --gradient-mesh: radial-gradient(at 40% 20%, var(--color-primary-900) 0px, transparent 50%),
                   radial-gradient(at 80% 0%, var(--color-cyan-900) 0px, transparent 50%),
                   radial-gradient(at 0% 50%, var(--color-primary-800) 0px, transparent 50%);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4);
  --shadow-glow: 0 0 20px rgba(139, 92, 246, 0.3);
  --shadow-glow-lg: 0 0 40px rgba(139, 92, 246, 0.4);

  /* Animation */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Light Theme */
.light, [data-theme="light"] {
  --color-bg-base: #ffffff;
  --color-bg-surface: #f9fafb;
  --color-bg-elevated: #f3f4f6;
  --color-bg-subtle: #e5e7eb;
  
  --color-border-base: #e5e7eb;
  --color-border-subtle: #f3f4f6;
  --color-border-strong: #d1d5db;
  
  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-tertiary: #6b7280;
  --color-text-placeholder: #9ca3af;
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}
```

## Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Map CSS variables
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },
        cyan: {
          50: 'var(--color-cyan-50)',
          100: 'var(--color-cyan-100)',
          200: 'var(--color-cyan-200)',
          300: 'var(--color-cyan-300)',
          400: 'var(--color-cyan-400)',
          500: 'var(--color-cyan-500)',
          600: 'var(--color-cyan-600)',
          700: 'var(--color-cyan-700)',
          800: 'var(--color-cyan-800)',
          900: 'var(--color-cyan-900)',
          950: 'var(--color-cyan-950)',
        },
        // Semantic colors
        bg: {
          base: 'var(--color-bg-base)',
          surface: 'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          subtle: 'var(--color-bg-subtle)',
        },
        border: {
          base: 'var(--color-border-base)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          placeholder: 'var(--color-text-placeholder)',
        },
        // Status colors
        success: {
          50: 'var(--color-success-50)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
          700: 'var(--color-success-700)',
        },
        warning: {
          50: 'var(--color-warning-50)',
          500: 'var(--color-warning-500)',
          600: 'var(--color-warning-600)',
          700: 'var(--color-warning-700)',
        },
        error: {
          50: 'var(--color-error-50)',
          500: 'var(--color-error-500)',
          600: 'var(--color-error-600)',
          700: 'var(--color-error-700)',
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-glow': 'var(--gradient-glow)',
        'gradient-mesh': 'var(--gradient-mesh)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        'glow-lg': 'var(--shadow-glow-lg)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 5s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [
    // Custom utilities
    plugin(({ addUtilities }) => {
      addUtilities({
        '.glass': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-dark': {
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
        '.text-gradient': {
          background: 'linear-gradient(135deg, var(--color-primary-400), var(--color-cyan-400))',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          backgroundClip: 'text',
        },
      });
    }),
  ],
};

export default config;
```

## Theme Provider (React)

```tsx
// components/theme-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    
    let resolved: 'dark' | 'light';
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = theme;
    }
    
    setResolvedTheme(resolved);
    root.classList.remove('dark', 'light');
    root.classList.add(resolved);
    root.setAttribute('data-theme', resolved);
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

## Theme Toggle Component

```tsx
// components/theme-toggle.tsx
'use client';

import { useTheme } from './theme-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated border border-border-base">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            relative p-2 rounded-md transition-colors
            ${theme === value ? 'text-primary-500' : 'text-text-tertiary hover:text-text-secondary'}
          `}
          title={label}
        >
          {theme === value && (
            <motion.div
              layoutId="theme-indicator"
              className="absolute inset-0 bg-primary-500/10 rounded-md"
              transition={{ type: 'spring', duration: 0.3 }}
            />
          )}
          <Icon className="w-4 h-4 relative z-10" />
        </button>
      ))}
    </div>
  );
}
```

## Component Examples

```tsx
// Card with theme-aware styling
export function Card({ children, variant = 'default' }: { 
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass';
}) {
  const variants = {
    default: 'bg-bg-surface border-border-base',
    elevated: 'bg-bg-elevated border-border-strong shadow-lg',
    glass: 'glass',
  };

  return (
    <div className={`
      rounded-xl border p-6 
      transition-all duration-200
      hover:border-primary-500/30
      ${variants[variant]}
    `}>
      {children}
    </div>
  );
}

// Button with color variants
export function Button({ 
  children, 
  variant = 'primary',
  size = 'md',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-gradient-primary text-white hover:opacity-90 shadow-glow',
    secondary: 'bg-bg-elevated border border-border-base text-text-primary hover:bg-bg-subtle',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-subtle',
    danger: 'bg-error-600 text-white hover:bg-error-700',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button className={`
      rounded-lg font-medium
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-primary-500/50
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variants[variant]}
      ${sizes[size]}
    `}>
      {children}
    </button>
  );
}

// Status badge with semantic colors
export function StatusBadge({ status }: { 
  status: 'active' | 'pending' | 'error' | 'warning';
}) {
  const styles = {
    active: 'bg-success-500/10 text-success-500 border-success-500/20',
    pending: 'bg-warning-500/10 text-warning-500 border-warning-500/20',
    error: 'bg-error-500/10 text-error-500 border-error-500/20',
    warning: 'bg-warning-500/10 text-warning-500 border-warning-500/20',
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5
      px-2.5 py-0.5 rounded-full
      text-xs font-medium
      border
      ${styles[status]}
    `}>
      <span className={`
        w-1.5 h-1.5 rounded-full
        ${status === 'active' ? 'bg-success-500 animate-pulse' : ''}
        ${status === 'pending' ? 'bg-warning-500' : ''}
        ${status === 'error' ? 'bg-error-500' : ''}
      `} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

## Accessibility Guidelines

1. **Contrast ratios**: Ensure 4.5:1 for normal text, 3:1 for large text
2. **Focus indicators**: Use visible focus rings (ring-2 ring-primary-500)
3. **Color blindness**: Don't rely solely on color; use icons and labels
4. **Motion sensitivity**: Respect prefers-reduced-motion
5. **Dark mode**: Test both themes for readability

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
