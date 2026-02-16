---
name: modern-ui-design
description: Create stunning modern UI designs with glassmorphism, neomorphism, dark mode, gradient effects, micro-interactions, and cutting-edge visual aesthetics. Use for building visually impressive, unique web interfaces that stand out from generic designs.
---

# Modern UI Design System

## Design Philosophy

Create interfaces that are:
- **Distinctive** - Unique visual identity, not generic
- **Immersive** - Rich visual depth and dimension
- **Responsive** - Fluid across all devices
- **Accessible** - Beautiful AND usable by everyone

## Color System

### Primary Palette (Violet/Indigo Tech Theme)
```css
:root {
  /* Primary Colors */
  --primary-50: #f5f3ff;
  --primary-100: #ede9fe;
  --primary-200: #ddd6fe;
  --primary-300: #c4b5fd;
  --primary-400: #a78bfa;
  --primary-500: #8b5cf6;
  --primary-600: #7c3aed;
  --primary-700: #6d28d9;
  --primary-800: #5b21b6;
  --primary-900: #4c1d95;
  --primary-950: #2e1065;

  /* Accent Colors */
  --accent-cyan: #06b6d4;
  --accent-pink: #ec4899;
  --accent-amber: #f59e0b;
  --accent-emerald: #10b981;

  /* Semantic Colors */
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --info: #3b82f6;

  /* Dark Theme Background */
  --bg-primary: #0a0a0f;
  --bg-secondary: #111118;
  --bg-tertiary: #1a1a24;
  --bg-elevated: #242432;
  
  /* Text Colors */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
}
```

### Gradient Combinations
```css
/* Hero Gradients */
.gradient-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-cosmic {
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.gradient-aurora {
  background: linear-gradient(135deg, #00c6fb 0%, #005bea 50%, #8b5cf6 100%);
}

.gradient-sunset {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

/* Mesh Gradient (CSS only) */
.gradient-mesh {
  background-color: #0a0a0f;
  background-image: 
    radial-gradient(at 40% 20%, rgba(124, 58, 237, 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(236, 72, 153, 0.2) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(124, 58, 237, 0.2) 0px, transparent 50%);
}

/* Animated Gradient */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.gradient-animated {
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradient-shift 15s ease infinite;
}
```

## Glassmorphism

```css
/* Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Frosted Glass */
.glass-frosted {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(40px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
}

/* Glass Button */
.glass-button {
  background: rgba(124, 58, 237, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 12px;
  padding: 12px 24px;
  color: white;
  font-weight: 600;
  transition: all 0.3s ease;
}

.glass-button:hover {
  background: rgba(124, 58, 237, 0.4);
  border-color: rgba(124, 58, 237, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(124, 58, 237, 0.3);
}
```

## Neomorphism

```css
/* Neomorphic Card (Dark Theme) */
.neo-card {
  background: #1a1a24;
  border-radius: 20px;
  box-shadow: 
    8px 8px 16px #0d0d14,
    -8px -8px 16px #272734;
}

/* Neomorphic Pressed */
.neo-pressed {
  background: linear-gradient(145deg, #171720, #1c1c28);
  box-shadow: 
    inset 5px 5px 10px #0f0f16,
    inset -5px -5px 10px #252532;
}

/* Neomorphic Button */
.neo-button {
  background: linear-gradient(145deg, #1c1c28, #181820);
  border-radius: 12px;
  box-shadow: 
    5px 5px 10px #0d0d14,
    -5px -5px 10px #272734;
  transition: all 0.2s ease;
}

.neo-button:active {
  box-shadow: 
    inset 3px 3px 6px #0d0d14,
    inset -3px -3px 6px #272734;
}
```

## Glow Effects

```css
/* Neon Glow */
.glow-neon {
  box-shadow: 
    0 0 5px currentColor,
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 40px currentColor;
}

/* Subtle Glow */
.glow-subtle {
  box-shadow: 
    0 0 20px rgba(124, 58, 237, 0.3),
    0 0 40px rgba(124, 58, 237, 0.2),
    0 0 60px rgba(124, 58, 237, 0.1);
}

/* Pulsing Glow */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
  }
  50% {
    box-shadow: 0 0 40px rgba(124, 58, 237, 0.6),
                0 0 60px rgba(124, 58, 237, 0.4);
  }
}

.glow-pulse {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Text Glow */
.text-glow {
  text-shadow: 
    0 0 10px rgba(124, 58, 237, 0.8),
    0 0 20px rgba(124, 58, 237, 0.6),
    0 0 30px rgba(124, 58, 237, 0.4);
}
```

## Border Effects

```css
/* Gradient Border */
.border-gradient {
  position: relative;
  background: #1a1a24;
  border-radius: 16px;
}

.border-gradient::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4, #ec4899);
  border-radius: 18px;
  z-index: -1;
}

/* Animated Border */
@keyframes border-rotate {
  from { --angle: 0deg; }
  to { --angle: 360deg; }
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.border-animated {
  border: 2px solid transparent;
  background: 
    linear-gradient(#1a1a24, #1a1a24) padding-box,
    conic-gradient(from var(--angle), #8b5cf6, #06b6d4, #ec4899, #8b5cf6) border-box;
  animation: border-rotate 4s linear infinite;
}

/* Shimmer Border */
.border-shimmer {
  position: relative;
  overflow: hidden;
}

.border-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
```

## Tailwind CSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        dark: {
          bg: '#0a0a0f',
          card: '#111118',
          elevated: '#1a1a24',
          border: '#2a2a3a',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': `
          radial-gradient(at 40% 20%, rgba(124, 58, 237, 0.3) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.2) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(236, 72, 153, 0.2) 0px, transparent 50%)
        `,
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(124, 58, 237, 0.3)',
        'glow-lg': '0 0 40px rgba(124, 58, 237, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(124, 58, 237, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
```

## Component Examples

### Hero Section
```tsx
function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-dark-bg">
      {/* Mesh Background */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      
      {/* Animated Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/30 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-3s' }} />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm text-primary-300">ERC-8004 Compliant</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-primary-200 to-primary-400 bg-clip-text text-transparent">
              AI Agents with
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              On-Chain Trust
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Build autonomous AI agents that access capital, execute strategies, 
            and earn verifiable trust on the blockchain.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button className="group relative px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl font-semibold text-white overflow-hidden transition-all hover:shadow-glow-lg">
              <span className="relative z-10">Launch App</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <button className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white hover:bg-white/10 transition-all">
              Read Docs
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### Glass Card
```tsx
function GlassCard({ children, className = '' }) {
  return (
    <div className={`
      relative p-6 rounded-2xl
      bg-white/5 backdrop-blur-xl
      border border-white/10
      shadow-xl shadow-black/20
      hover:bg-white/[0.08] hover:border-white/20
      transition-all duration-300
      ${className}
    `}>
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

### Stat Card with Glow
```tsx
function StatCard({ label, value, change, icon: Icon }) {
  const isPositive = change >= 0;
  
  return (
    <div className="group relative p-6 rounded-2xl bg-dark-card border border-dark-border hover:border-primary-500/30 transition-all">
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-primary-500/5 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">{label}</span>
          <div className="p-2 rounded-lg bg-primary-500/10">
            <Icon className="w-5 h-5 text-primary-400" />
          </div>
        </div>
        
        <div className="text-3xl font-bold text-white mb-2">{value}</div>
        
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(change)}%</span>
          <span className="text-gray-500">vs last week</span>
        </div>
      </div>
    </div>
  );
}
```

## Typography

```css
/* Modern Typography Scale */
.heading-display {
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.heading-1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.heading-2 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.body-large {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Gradient Text */
.text-gradient {
  background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```
