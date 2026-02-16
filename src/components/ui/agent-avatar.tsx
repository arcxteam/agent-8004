'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  getAgentLogoInfo,
  type AgentLogoInfo
} from '@/lib/agent-logos';

// ============================================================================
// Utility Functions
// ============================================================================

// Generate deterministic random seed from string
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seeded random number generator
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// ============================================================================
// Basic AgentAvatar Component
// ============================================================================

export interface AgentAvatarProps {
  /** Agent name - used for initials and logo selection if no tokenId */
  name: string;
  /** Agent tokenId (ERC721) - used for deterministic logo selection */
  tokenId?: bigint | number | string;
  /** Size of the avatar in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Whether to show a border */
  showBorder?: boolean;
  /** Whether the agent is active/online */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * AgentAvatar Component
 * 
 * Displays an agent's logo based on their tokenId or name.
 * Falls back to generated placeholder with initials if logo fails to load.
 */
export function AgentAvatar({
  name,
  tokenId,
  size = 48,
  className,
  style,
  showBorder = true,
  isActive,
  onClick,
}: AgentAvatarProps) {
  const [hasError, setHasError] = React.useState(false);
  const logoInfo: AgentLogoInfo = getAgentLogoInfo(name, tokenId);
  
  // Use placeholder if image fails to load
  const imageSrc = hasError ? logoInfo.fallbackUrl : logoInfo.logoUrl;
  
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-blue-500/20',
        showBorder && 'ring-2 ring-white/10',
        onClick && 'cursor-pointer hover:ring-purple-500/50 transition-all',
        className
      )}
      style={{ width: size, height: size, ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={`${name} avatar`}
          width={size}
          height={size}
          className="object-cover"
        />
      ) : (
        <Image
          src={imageSrc}
          alt={`${name} avatar`}
          width={size}
          height={size}
          className="object-cover"
          onError={() => setHasError(true)}
          unoptimized
        />
      )}
      
      {/* Active indicator */}
      {isActive !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a12]',
            isActive ? 'bg-green-500' : 'bg-gray-500'
          )}
          style={{
            width: Math.max(8, size * 0.2),
            height: Math.max(8, size * 0.2),
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Animated AgentAvatar Component
// ============================================================================

const sizeClasses = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16',
  '2xl': 'w-20 h-20',
};

const animations = ['flip', 'pulse', 'bounce', 'rotate', 'glow'] as const;
type AnimationType = typeof animations[number] | 'none';

export interface AnimatedAgentAvatarProps {
  /** Unique identifier for the agent (used for deterministic random selection) */
  agentId?: string;
  /** Size of the avatar */
  size?: keyof typeof sizeClasses;
  /** Animation style */
  animation?: AnimationType;
  /** Whether to show a gradient border */
  gradientBorder?: boolean;
  /** Custom className */
  className?: string;
  /** Fallback emoji if image fails to load */
  fallbackEmoji?: string;
  /** Whether to randomize the animation */
  randomizeAnimation?: boolean;
}

export function AnimatedAgentAvatar({
  agentId = 'default',
  size = 'md',
  animation = 'pulse',
  gradientBorder = true,
  className,
  fallbackEmoji = '🤖',
  randomizeAnimation = false,
}: AnimatedAgentAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Generate deterministic avatar number from agentId
  const seed = hashCode(agentId);
  const random = seededRandom(seed);
  const avatarNumber = Math.floor(random() * 200) + 1;
  
  // Deterministic animation selection
  const selectedAnimation = randomizeAnimation 
    ? animations[Math.floor(random() * animations.length)]
    : animation;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-600/20 flex items-center justify-center',
        className
      )}>
        <span className="text-xs opacity-50">{fallbackEmoji}</span>
      </div>
    );
  }

  const animationVariants = {
    flip: {
      animate: { rotateY: [0, 180, 360] },
      transition: { duration: 3, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' as const },
    },
    pulse: {
      animate: { scale: [1, 1.05, 1], opacity: [1, 0.9, 1] },
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
    },
    bounce: {
      animate: { y: [0, -4, 0] },
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
    },
    rotate: {
      animate: { rotate: [0, 5, -5, 0] },
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
    },
    glow: {
      animate: {
        boxShadow: [
          '0 0 0 0 rgba(139, 92, 246, 0)',
          '0 0 20px 4px rgba(139, 92, 246, 0.4)',
          '0 0 0 0 rgba(139, 92, 246, 0)',
        ],
      },
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
    },
    none: {
      animate: {},
      transition: undefined,
    },
  };

  const { animate, transition } = animationVariants[selectedAnimation];

  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        'rounded-xl overflow-hidden relative flex items-center justify-center',
        gradientBorder && 'p-[2px] bg-gradient-to-br from-primary-500 to-purple-600',
        className
      )}
      animate={animate}
      transition={transition as any}
      style={{ perspective: '1000px' }}
    >
      <div className={cn(
        'w-full h-full rounded-[10px] overflow-hidden',
        gradientBorder ? 'bg-bg-card' : 'bg-gradient-to-br from-primary-500/20 to-purple-600/20'
      )}>
        <AnimatePresence mode="wait">
          {imageError ? (
            <motion.div
              key="emoji"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-full h-full flex items-center justify-center text-lg"
            >
              {fallbackEmoji}
            </motion.div>
          ) : (
            <motion.div
              key="image"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <Image
                src={`/agents/agent-${avatarNumber}.png`}
                alt={`Agent ${agentId}`}
                fill
                sizes={size === 'xl' ? '64px' : size === 'lg' ? '56px' : size === 'md' ? '48px' : size === 'sm' ? '40px' : '32px'}
                className="object-cover"
                onError={() => setImageError(true)}
                priority={false}
                unoptimized
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Random Cycling Avatar Component (for landing page)
// ============================================================================

export interface RandomCyclingAvatarProps {
  /** Number of random logos to cycle through */
  cycleCount?: number;
  /** Interval for cycling in milliseconds */
  interval?: number;
  /** Size of the avatar */
  size?: keyof typeof sizeClasses;
  /** Whether to show a gradient border */
  gradientBorder?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * RandomCyclingAvatar Component
 * 
 * Displays an avatar that cycles through random logos with animation.
 * Perfect for landing pages and hero sections.
 */
export function RandomCyclingAvatar({
  cycleCount = 10,
  interval = 2000,
  size = 'lg',
  gradientBorder = true,
  className,
}: RandomCyclingAvatarProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  
  // Generate random avatar numbers on mount
  const [avatarNumbers] = React.useState(() => {
    const numbers: number[] = [];
    const used = new Set<number>();
    while (numbers.length < cycleCount) {
      const num = Math.floor(Math.random() * 200) + 1;
      if (!used.has(num)) {
        used.add(num);
        numbers.push(num);
      }
    }
    return numbers;
  });

  React.useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % cycleCount);
    }, interval);
    return () => clearInterval(timer);
  }, [cycleCount, interval]);

  if (!mounted) {
    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-600/20',
        className
      )} />
    );
  }

  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        'rounded-xl overflow-hidden relative',
        gradientBorder && 'p-[2px] bg-gradient-to-br from-primary-500 to-purple-600',
        className
      )}
      animate={{
        boxShadow: [
          '0 0 0 0 rgba(139, 92, 246, 0)',
          '0 0 30px 6px rgba(139, 92, 246, 0.5)',
          '0 0 0 0 rgba(139, 92, 246, 0)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className={cn(
        'w-full h-full rounded-[10px] overflow-hidden',
        gradientBorder ? 'bg-bg-card' : 'bg-gradient-to-br from-primary-500/20 to-purple-600/20'
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="w-full h-full relative"
          >
            <Image
              src={`/agents/agent-${avatarNumbers[currentIndex]}.png`}
              alt={`Agent Avatar ${currentIndex + 1}`}
              fill
              className="object-cover"
              priority={currentIndex === 0}
              unoptimized
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Agent Avatar Group Component
// ============================================================================

export interface AgentAvatarGroupProps {
  agents?: Array<{ name: string; tokenId?: bigint | number | string }>;
  /** Number of avatars to display (if no agents provided) */
  count?: number;
  max?: number;
  size?: number | keyof typeof sizeClasses;
  className?: string;
  overlap?: boolean;
  animated?: boolean;
}

/**
 * AgentAvatarGroup Component
 * 
 * Displays a group of agent avatars with overlap effect.
 */
export function AgentAvatarGroup({
  agents,
  count = 5,
  max = 5,
  size = 32,
  className,
  overlap = true,
  animated = false,
}: AgentAvatarGroupProps) {
  const [mounted, setMounted] = React.useState(false);
  
  // Generate random avatar IDs if no agents provided
  const [avatarIds] = React.useState(() => 
    Array.from({ length: count }, (_, i) => `group-avatar-${i}-${Date.now()}`)
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // If agents provided, use them
  if (agents && agents.length > 0) {
    const displayAgents = agents.slice(0, max);
    const remaining = agents.length - max;
    const pixelSize = typeof size === 'number' ? size : 32;
    
    return (
      <div className={cn('flex', overlap ? '-space-x-2' : 'space-x-1', className)}>
        {displayAgents.map((agent, index) => (
          <AgentAvatar
            key={agent.tokenId?.toString() || agent.name}
            name={agent.name}
            tokenId={agent.tokenId}
            size={pixelSize}
            showBorder
            className="ring-2 ring-[#0a0a12]"
            style={{ zIndex: displayAgents.length - index } as React.CSSProperties}
          />
        ))}
        {remaining > 0 && (
          <div
            className="flex items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 text-xs font-medium ring-2 ring-[#0a0a12]"
            style={{ width: pixelSize, height: pixelSize }}
          >
            +{remaining}
          </div>
        )}
      </div>
    );
  }

  // Otherwise use generated animated avatars
  const sizeKey = typeof size === 'string' ? size : 'sm';
  
  if (!mounted) {
    return (
      <div className={cn('flex', overlap ? '-space-x-2' : 'space-x-1', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              sizeClasses[sizeKey as keyof typeof sizeClasses],
              'rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-600/20'
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex', overlap ? '-space-x-2' : 'space-x-1', className)}>
      {avatarIds.map((id, index) => (
        <motion.div
          key={id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative"
          style={{ zIndex: count - index }}
        >
          <AnimatedAgentAvatar
            agentId={id}
            size={sizeKey as keyof typeof sizeClasses}
            animation={animated ? animations[index % animations.length] : 'none'}
            gradientBorder
            className="border-2 border-bg-primary"
          />
        </motion.div>
      ))}
    </div>
  );
}

export default AgentAvatar;
