---
name: framer-motion-animations
description: Advanced animations and micro-interactions using Framer Motion, GSAP, and CSS animations. Use for creating fluid page transitions, scroll-triggered animations, 3D effects, and interactive UI elements that elevate user experience.
---

# Advanced Animations with Framer Motion

## Setup

```bash
npm install framer-motion
```

## Core Animation Patterns

### Basic Motion Components

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// Fade and slide up
export function FadeUp({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.5, 
        delay,
        ease: [0.25, 0.1, 0.25, 1] // custom easing
      }}
    >
      {children}
    </motion.div>
  );
}

// Scale with spring physics
export function ScaleIn({ children }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

// Stagger children
export function StaggerContainer({ children }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
};
```

### Page Transitions

```tsx
// components/page-transition.tsx
'use client';

import { motion } from 'framer-motion';

const pageVariants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.3,
    },
  },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
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

// Slide transitions
export const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
  }),
};
```

### Scroll-Triggered Animations

```tsx
// hooks/useScrollAnimation.ts
'use client';

import { useInView } from 'framer-motion';
import { useRef } from 'react';

export function useScrollAnimation(threshold = 0.2) {
  const ref = useRef(null);
  const isInView = useInView(ref, { 
    once: true, 
    amount: threshold 
  });
  
  return { ref, isInView };
}

// components/scroll-reveal.tsx
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function ScrollReveal({ children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [100, 0, 0, -100]);

  return (
    <motion.div ref={ref} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

// Parallax effect
export function Parallax({ children, speed = 0.5 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`]);

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}
```

### Gesture Animations

```tsx
// Interactive card with tilt effect
export function TiltCard({ children }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    setRotateX(-mouseY / 10);
    setRotateY(mouseX / 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      style={{
        perspective: 1000,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        animate={{ rotateX, rotateY }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative rounded-2xl bg-dark-card p-6"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Draggable component
export function DraggableCard({ children }) {
  return (
    <motion.div
      drag
      dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
      dragElastic={0.2}
      whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}
```

### Loading Animations

```tsx
// Skeleton loader
export function Skeleton({ className = '' }) {
  return (
    <motion.div
      className={`bg-dark-elevated rounded-lg ${className}`}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Spinner with orbit
export function OrbitSpinner() {
  return (
    <div className="relative w-12 h-12">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 bg-primary-500 rounded-full"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.2,
          }}
          style={{
            top: '50%',
            left: '50%',
            transformOrigin: '0 -16px',
          }}
        />
      ))}
    </div>
  );
}

// Progress bar
export function AnimatedProgress({ value }: { value: number }) {
  return (
    <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-primary-600 to-cyan-500"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}
```

### Number Counter Animation

```tsx
// Animated counter
import { useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

export function AnimatedCounter({ 
  value, 
  duration = 2,
  formatFn = (v: number) => v.toFixed(0)
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => formatFn(v));
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    const controls = animate(count, value, { 
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayValue(formatFn(v)),
    });
    return controls.stop;
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

// Usage
<AnimatedCounter 
  value={1234567} 
  formatFn={(v) => `$${v.toLocaleString()}`}
/>
```

### Text Animations

```tsx
// Character by character animation
export function TextReveal({ text, delay = 0 }) {
  const characters = text.split('');
  
  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delay,
            staggerChildren: 0.03,
          },
        },
      }}
    >
      {characters.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Word by word animation
export function WordReveal({ text, delay = 0 }) {
  const words = text.split(' ');
  
  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delay,
            staggerChildren: 0.1,
          },
        },
      }}
      className="flex flex-wrap"
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="mr-2"
          variants={{
            hidden: { opacity: 0, y: 30, rotateX: -90 },
            visible: { 
              opacity: 1, 
              y: 0, 
              rotateX: 0,
              transition: { duration: 0.5 }
            },
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Typewriter effect
export function Typewriter({ text, speed = 50 }) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed]);
  
  return (
    <span>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        |
      </motion.span>
    </span>
  );
}
```

### Modal & Overlay Animations

```tsx
// Animated modal
export function AnimatedModal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-dark-card rounded-2xl border border-dark-border p-6 max-w-lg w-full">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### List Animations

```tsx
// Animated list with reordering
import { Reorder } from 'framer-motion';

export function ReorderableList({ items, setItems }) {
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={setItems}
      className="space-y-2"
    >
      {items.map((item) => (
        <Reorder.Item
          key={item.id}
          value={item}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}
          className="p-4 bg-dark-card rounded-xl cursor-grab active:cursor-grabbing"
        >
          {item.content}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}
```

### SVG Path Animations

```tsx
// Draw SVG path
export function DrawPath() {
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20">
      <motion.path
        d="M 10 80 Q 50 10 90 80"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
    </svg>
  );
}

// Animated checkmark
export function AnimatedCheck({ isChecked }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <motion.path
        d="M5 13l4 4L19 7"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: isChecked ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}
```

### Performance Tips

1. **Use `layoutId`** for shared element transitions
2. **Prefer `transform` and `opacity`** for GPU acceleration
3. **Use `will-change`** sparingly for complex animations
4. **Avoid animating `width/height`** - use `scale` instead
5. **Use `AnimatePresence`** for exit animations
6. **Memoize variants** to prevent re-renders
7. **Use `useReducedMotion`** for accessibility
