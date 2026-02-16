---
name: framer-motion-advanced
description: Advanced animations using Framer Motion for React. Includes page transitions, scroll-triggered animations, gesture interactions, SVG animations, stagger effects, and complex choreographed sequences. Use for creating immersive, interactive web experiences.
---

# Framer Motion Advanced Animations

## Installation

```bash
npm install framer-motion
```

## Core Animation Patterns

### Fade In/Out with Scale

```tsx
import { motion, AnimatePresence } from 'framer-motion';

const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

function Card({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeInScale}
      className="p-6 bg-dark-card rounded-2xl"
    >
      {children}
    </motion.div>
  );
}
```

### Stagger Children

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

function AgentList({ agents }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-3 gap-6"
    >
      {agents.map((agent) => (
        <motion.div key={agent.id} variants={itemVariants}>
          <AgentCard agent={agent} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Page Transitions

```tsx
// app/template.tsx
'use client';

import { motion } from 'framer-motion';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: 'blur(10px)',
  },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    filter: 'blur(10px)',
    transition: {
      duration: 0.3,
    },
  },
};

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  );
}
```

### Scroll-Triggered Animations

```tsx
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';

function ParallaxSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);

  return (
    <motion.section
      ref={ref}
      style={{ y, opacity, scale }}
      className="min-h-screen flex items-center justify-center"
    >
      <h2 className="text-6xl font-bold">Scroll Animation</h2>
    </motion.section>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-cyan-500 origin-left z-50"
    />
  );
}
```

### Hover Interactions

```tsx
function InteractiveCard({ children }) {
  return (
    <motion.div
      className="relative p-6 bg-dark-card rounded-2xl cursor-pointer overflow-hidden"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {/* Gradient hover effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-0"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(6,182,212,0.5))',
          padding: '1px',
        }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
```

### Gesture Animations

```tsx
import { motion, useDragControls, useMotionValue, useTransform } from 'framer-motion';

function DraggableCard() {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      style={{ x, rotate, opacity }}
      whileDrag={{ scale: 1.1 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 150) {
          // Handle swipe action
          console.log(info.offset.x > 0 ? 'Swiped right' : 'Swiped left');
        }
      }}
      className="p-8 bg-dark-card rounded-2xl cursor-grab active:cursor-grabbing"
    >
      <p>Drag me!</p>
    </motion.div>
  );
}
```

### SVG Path Animation

```tsx
function AnimatedLogo() {
  const pathVariants = {
    hidden: {
      pathLength: 0,
      opacity: 0,
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: 2, ease: 'easeInOut' },
        opacity: { duration: 0.5 },
      },
    },
  };

  return (
    <motion.svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      initial="hidden"
      animate="visible"
    >
      <motion.path
        d="M 50 100 Q 100 50 150 100 T 250 100"
        fill="none"
        stroke="url(#gradient)"
        strokeWidth="4"
        strokeLinecap="round"
        variants={pathVariants}
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
```

### Animated Counter

```tsx
import { motion, useSpring, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect } from 'react';

function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  const spring = useSpring(0, {
    stiffness: 50,
    damping: 30,
    duration: duration * 1000,
  });
  
  const display = useTransform(spring, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <motion.span ref={ref} className="tabular-nums">
      {display}
    </motion.span>
  );
}

// Usage
<div className="text-4xl font-bold">
  $<AnimatedCounter value={1234567} />
</div>
```

### Morphing Shapes

```tsx
function MorphingShape() {
  const paths = {
    circle: "M 100 50 A 50 50 0 1 1 100 150 A 50 50 0 1 1 100 50",
    square: "M 50 50 L 150 50 L 150 150 L 50 150 Z",
    triangle: "M 100 30 L 170 150 L 30 150 Z",
  };

  const [shape, setShape] = useState<'circle' | 'square' | 'triangle'>('circle');

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <motion.path
          fill="url(#morph-gradient)"
          animate={{ d: paths[shape] }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
        <defs>
          <linearGradient id="morph-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      
      <div className="flex gap-2">
        {(['circle', 'square', 'triangle'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setShape(s)}
            className={`px-4 py-2 rounded-lg ${
              shape === s ? 'bg-primary-600' : 'bg-dark-elevated'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Loading Animations

```tsx
// Spinner
function Spinner() {
  return (
    <motion.div
      className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Dots
function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 bg-primary-500 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Skeleton Pulse
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-dark-elevated rounded-lg ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}
```

### Layout Animations

```tsx
import { motion, LayoutGroup } from 'framer-motion';

function TabsWithIndicator() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Overview', 'Analytics', 'Settings'];

  return (
    <LayoutGroup>
      <div className="flex gap-1 p-1 bg-dark-elevated rounded-xl">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className="relative px-6 py-2 rounded-lg"
          >
            {activeTab === i && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary-600 rounded-lg"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
```

### Orchestrated Animations

```tsx
function HeroAnimation() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="text-center"
    >
      <motion.span variants={textVariants} className="inline-block text-primary-400 mb-4">
        ERC-8004 Compliant
      </motion.span>
      
      <motion.h1 variants={textVariants} className="text-6xl font-bold mb-6">
        AI Agents with
        <br />
        On-Chain Trust
      </motion.h1>
      
      <motion.p variants={textVariants} className="text-xl text-gray-400 mb-8">
        Build autonomous AI agents that execute on-chain strategies
      </motion.p>
      
      <motion.div variants={buttonVariants} className="flex gap-4 justify-center">
        <button className="px-8 py-4 bg-primary-600 rounded-xl">
          Get Started
        </button>
        <button className="px-8 py-4 bg-white/10 rounded-xl">
          Learn More
        </button>
      </motion.div>
    </motion.div>
  );
}
```

### Animation Hooks

```tsx
// Custom hook for scroll-triggered animations
function useScrollAnimation(threshold = 0.1) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  
  const variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    },
  };

  return { ref, isInView, variants };
}

// Usage
function Section() {
  const { ref, isInView, variants } = useScrollAnimation();
  
  return (
    <motion.section
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      Content
    </motion.section>
  );
}
```
