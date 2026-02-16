/**
 * Agent Logo Loader Utility
 * 
 * Loads agent logos from public/agents/ folder
 * Supports 200 unique PNG logos (512x512)
 *
 * Logo files: agent-1.png, agent-2.png, ... agent-200.png
 * Types: Robot Head, Neural AI, ANOA Buffalo, Crystal, Circuit
 */

// Total number of available agent logos
export const TOTAL_AGENT_LOGOS = 200;

// Logo filename pattern
export const LOGO_PREFIX = 'agent-';
export const LOGO_EXTENSION = '.png';
export const LOGO_BASE_PATH = '/agents/';

/**
 * Get deterministic logo index from agent tokenId or name
 * Uses modulo to ensure index is within available logos range
 */
export function getLogoIndexFromTokenId(tokenId: bigint | number | string): number {
  const id = typeof tokenId === 'bigint' ? Number(tokenId) : Number(tokenId);
  // Use modulo to get index between 1 and TOTAL_AGENT_LOGOS
  return (Math.abs(id - 1) % TOTAL_AGENT_LOGOS) + 1;
}

/**
 * Get deterministic logo index from agent name
 * Creates a simple hash from the name to select a logo
 */
export function getLogoIndexFromName(name: string): number {
  if (!name || name.trim() === '') {
    return 1; // Default to first logo
  }
  
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use modulo to get index between 1 and TOTAL_AGENT_LOGOS
  return (Math.abs(hash) % TOTAL_AGENT_LOGOS) + 1;
}

/**
 * Get the full path to an agent logo
 */
export function getAgentLogoPath(index: number): string {
  // Ensure index is within valid range
  const safeIndex = Math.max(1, Math.min(index, TOTAL_AGENT_LOGOS));
  return `${LOGO_BASE_PATH}${LOGO_PREFIX}${safeIndex}${LOGO_EXTENSION}`;
}

/**
 * Get agent logo path from tokenId
 */
export function getAgentLogoByTokenId(tokenId: bigint | number | string): string {
  const index = getLogoIndexFromTokenId(tokenId);
  return getAgentLogoPath(index);
}

/**
 * Get agent logo path from name
 */
export function getAgentLogoByName(name: string): string {
  const index = getLogoIndexFromName(name);
  return getAgentLogoPath(index);
}

/**
 * Get a random agent logo path
 */
export function getRandomAgentLogo(): string {
  const index = Math.floor(Math.random() * TOTAL_AGENT_LOGOS) + 1;
  return getAgentLogoPath(index);
}

/**
 * Generate placeholder logo data URL with agent initials
 * Used as fallback when actual logo is not available
 */
export function generatePlaceholderLogo(
  name: string,
  size: number = 100
): string {
  const initials = name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
    
  // Generate a deterministic color from name
  const hash = getLogoIndexFromName(name);
  const hue = (hash * 37) % 360;
  const bgColor = `hsl(${hue}, 60%, 40%)`;
  
  // SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${bgColor}" rx="${size * 0.1}"/>
      <text 
        x="50%" 
        y="50%" 
        dominant-baseline="central" 
        text-anchor="middle" 
        fill="white" 
        font-family="system-ui, sans-serif" 
        font-weight="600"
        font-size="${size * 0.4}"
      >${initials}</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Agent logo info type
 */
export interface AgentLogoInfo {
  tokenId?: bigint | number;
  name: string;
  logoUrl: string;
  fallbackUrl: string;
}

/**
 * Get complete logo info for an agent
 */
export function getAgentLogoInfo(
  name: string,
  tokenId?: bigint | number | string
): AgentLogoInfo {
  const logoUrl = tokenId 
    ? getAgentLogoByTokenId(tokenId)
    : getAgentLogoByName(name);
    
  return {
    tokenId: tokenId ? (typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId)) : undefined,
    name,
    logoUrl,
    fallbackUrl: generatePlaceholderLogo(name),
  };
}
