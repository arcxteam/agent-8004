/**
 * ANOA NFT Logo Generator - 200 Unique Buffalo Variations
 *
 * Generates 200 unique high-DPI PNG logos for ANOA Trustless AI Agents
 * All featuring the Anoa (dwarf buffalo from Sulawesi, Indonesia)
 *
 * Run: npx tsx scripts/generate-logos.ts
 *
 * Features:
 * - Purple gradient background (primary-500 to purple-600)
 * - 12 horn styles (curved, straight, spiral, branched, wavy, crystalline, flame, lightning, tribal, mechanical, crown, double)
 * - 12 eye styles (glowing, scanner, compound, cyber, flame, void, star, target, diamond, circuit, crescent, split)
 * - 10 face patterns (tribal, circuit, holographic, geometric, nature, binary, constellation, crack, grid, wave)
 * - 8 head shapes (round, angular, elongated, wide, heart, shield, diamond, hexagonal)
 * - 6 nose styles (oval, triangular, wide-buffalo, snub, pointed, flat)
 * - 6 mouth styles (neutral, smirk, open, fangs, line, curved)
 * - 8 ear styles (pointed, round, folded, long, tufted, small, wing, horn)
 * - 20 accent color schemes
 */

import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'public/agents');
const TOTAL_LOGOS = 200;
const SIZE = 512;

// Accent color palettes (used for features on top of purple bg)
const accentPalettes = [
  { primary: '#c084fc', secondary: '#06b6d4', accent: '#f472b6', glow: '#e9d5ff' },
  { primary: '#00ff88', secondary: '#22d3ee', accent: '#a78bfa', glow: '#86efac' },
  { primary: '#ff6b35', secondary: '#fbbf24', accent: '#f472b6', glow: '#ffb366' },
  { primary: '#38bdf8', secondary: '#a5f3fc', accent: '#818cf8', glow: '#7dd3fc' },
  { primary: '#fbbf24', secondary: '#f97316', accent: '#ef4444', glow: '#fde68a' },
  { primary: '#a3e635', secondary: '#4ade80', accent: '#2dd4bf', glow: '#d9f99d' },
  { primary: '#fb7185', secondary: '#f472b6', accent: '#c084fc', glow: '#fecdd3' },
  { primary: '#2dd4bf', secondary: '#06b6d4', accent: '#3b82f6', glow: '#99f6e4' },
  { primary: '#e879f9', secondary: '#a855f7', accent: '#6366f1', glow: '#f0abfc' },
  { primary: '#4ade80', secondary: '#34d399', accent: '#2dd4bf', glow: '#bbf7d0' },
  { primary: '#f43f5e', secondary: '#e11d48', accent: '#db2777', glow: '#fda4af' },
  { primary: '#60a5fa', secondary: '#3b82f6', accent: '#8b5cf6', glow: '#bfdbfe' },
  { primary: '#facc15', secondary: '#eab308', accent: '#f59e0b', glow: '#fef08a' },
  { primary: '#a78bfa', secondary: '#8b5cf6', accent: '#7c3aed', glow: '#ddd6fe' },
  { primary: '#f97316', secondary: '#ea580c', accent: '#dc2626', glow: '#fed7aa' },
  { primary: '#14b8a6', secondary: '#0d9488', accent: '#0891b2', glow: '#5eead4' },
  { primary: '#ec4899', secondary: '#d946ef', accent: '#a855f7', glow: '#f9a8d4' },
  { primary: '#22d3ee', secondary: '#06b6d4', accent: '#0ea5e9', glow: '#a5f3fc' },
  { primary: '#84cc16', secondary: '#65a30d', accent: '#16a34a', glow: '#d9f99d' },
  { primary: '#f472b6', secondary: '#ec4899', accent: '#be185d', glow: '#fbcfe8' },
];

// Types
type HornStyle = 'curved' | 'straight' | 'spiral' | 'branched' | 'wavy' | 'crystalline' | 'flame' | 'lightning' | 'tribal' | 'mechanical' | 'crown' | 'double';
type EyeStyle = 'glowing' | 'scanner' | 'compound' | 'cyber' | 'flame' | 'void' | 'star' | 'target' | 'diamond' | 'circuit' | 'crescent' | 'split';
type FacePattern = 'tribal' | 'circuit' | 'holographic' | 'geometric' | 'nature' | 'binary' | 'constellation' | 'crack' | 'grid' | 'wave';
type HeadShape = 'round' | 'angular' | 'elongated' | 'wide' | 'heart' | 'shield' | 'diamond' | 'hexagonal';
type NoseStyle = 'oval' | 'triangular' | 'wide' | 'snub' | 'pointed' | 'flat';
type MouthStyle = 'neutral' | 'smirk' | 'open' | 'fangs' | 'line' | 'curved';
type EarStyle = 'pointed' | 'round' | 'folded' | 'long' | 'tufted' | 'small' | 'wing' | 'horn';

const hornStyles: HornStyle[] = ['curved', 'straight', 'spiral', 'branched', 'wavy', 'crystalline', 'flame', 'lightning', 'tribal', 'mechanical', 'crown', 'double'];
const eyeStyles: EyeStyle[] = ['glowing', 'scanner', 'compound', 'cyber', 'flame', 'void', 'star', 'target', 'diamond', 'circuit', 'crescent', 'split'];
const facePatterns: FacePattern[] = ['tribal', 'circuit', 'holographic', 'geometric', 'nature', 'binary', 'constellation', 'crack', 'grid', 'wave'];
const headShapes: HeadShape[] = ['round', 'angular', 'elongated', 'wide', 'heart', 'shield', 'diamond', 'hexagonal'];
const noseStyles: NoseStyle[] = ['oval', 'triangular', 'wide', 'snub', 'pointed', 'flat'];
const mouthStyles: MouthStyle[] = ['neutral', 'smirk', 'open', 'fangs', 'line', 'curved'];
const earStyles: EarStyle[] = ['pointed', 'round', 'folded', 'long', 'tufted', 'small', 'wing', 'horn'];

// Seeded random
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function addAlpha(hexColor: string, alpha: number): string {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  hex = hex.substring(0, 6);
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${hex}${alphaHex}`;
}

// ─── Purple gradient background ───
function drawBackground(ctx: CanvasRenderingContext2D, size: number, variation: number) {
  // Core purple gradient: from-primary-500 (#8b5cf6) to-purple-600 (#9333ea)
  const purpleShades = [
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
    { from: '#471575', to: '#581c87' },
  ];
  const shade = purpleShades[variation % purpleShades.length];

  const gradient = ctx.createRadialGradient(size / 2, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.75);
  gradient.addColorStop(0, shade.from);
  gradient.addColorStop(1, shade.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Subtle vignette
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
}

// ─── Glow helper ───
function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, addAlpha(color, 0.6));
  gradient.addColorStop(0.3, addAlpha(color, 0.3));
  gradient.addColorStop(0.6, addAlpha(color, 0.1));
  gradient.addColorStop(1, addAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Head shapes ───
function drawHead(ctx: CanvasRenderingContext2D, size: number, shape: HeadShape, palette: typeof accentPalettes[0], random: () => number) {
  drawGlow(ctx, size / 2, size * 0.55, size * 0.38, palette.primary);

  const headGrad = ctx.createLinearGradient(0, size * 0.35, 0, size * 0.85);
  headGrad.addColorStop(0, addAlpha(palette.primary, 0.35));
  headGrad.addColorStop(0.5, addAlpha(palette.primary, 0.18));
  headGrad.addColorStop(1, addAlpha(palette.primary, 0.06));
  ctx.fillStyle = headGrad;

  ctx.beginPath();
  switch (shape) {
    case 'round':
      ctx.moveTo(size * 0.28, size * 0.5);
      ctx.quadraticCurveTo(size * 0.32, size * 0.38, size * 0.5, size * 0.35);
      ctx.quadraticCurveTo(size * 0.68, size * 0.38, size * 0.72, size * 0.5);
      ctx.quadraticCurveTo(size * 0.75, size * 0.65, size * 0.68, size * 0.82);
      ctx.lineTo(size * 0.32, size * 0.82);
      ctx.quadraticCurveTo(size * 0.25, size * 0.65, size * 0.28, size * 0.5);
      break;
    case 'angular':
      ctx.moveTo(size * 0.3, size * 0.5);
      ctx.lineTo(size * 0.38, size * 0.36);
      ctx.lineTo(size * 0.5, size * 0.33);
      ctx.lineTo(size * 0.62, size * 0.36);
      ctx.lineTo(size * 0.7, size * 0.5);
      ctx.lineTo(size * 0.68, size * 0.72);
      ctx.lineTo(size * 0.6, size * 0.82);
      ctx.lineTo(size * 0.4, size * 0.82);
      ctx.lineTo(size * 0.32, size * 0.72);
      break;
    case 'elongated':
      ctx.moveTo(size * 0.32, size * 0.48);
      ctx.quadraticCurveTo(size * 0.36, size * 0.32, size * 0.5, size * 0.28);
      ctx.quadraticCurveTo(size * 0.64, size * 0.32, size * 0.68, size * 0.48);
      ctx.quadraticCurveTo(size * 0.7, size * 0.68, size * 0.62, size * 0.88);
      ctx.lineTo(size * 0.38, size * 0.88);
      ctx.quadraticCurveTo(size * 0.3, size * 0.68, size * 0.32, size * 0.48);
      break;
    case 'wide':
      ctx.moveTo(size * 0.22, size * 0.5);
      ctx.quadraticCurveTo(size * 0.28, size * 0.4, size * 0.5, size * 0.38);
      ctx.quadraticCurveTo(size * 0.72, size * 0.4, size * 0.78, size * 0.5);
      ctx.quadraticCurveTo(size * 0.8, size * 0.62, size * 0.72, size * 0.78);
      ctx.lineTo(size * 0.28, size * 0.78);
      ctx.quadraticCurveTo(size * 0.2, size * 0.62, size * 0.22, size * 0.5);
      break;
    case 'heart':
      ctx.moveTo(size * 0.5, size * 0.38);
      ctx.quadraticCurveTo(size * 0.35, size * 0.3, size * 0.28, size * 0.48);
      ctx.quadraticCurveTo(size * 0.25, size * 0.65, size * 0.5, size * 0.85);
      ctx.quadraticCurveTo(size * 0.75, size * 0.65, size * 0.72, size * 0.48);
      ctx.quadraticCurveTo(size * 0.65, size * 0.3, size * 0.5, size * 0.38);
      break;
    case 'shield':
      ctx.moveTo(size * 0.3, size * 0.38);
      ctx.lineTo(size * 0.7, size * 0.38);
      ctx.lineTo(size * 0.72, size * 0.6);
      ctx.quadraticCurveTo(size * 0.7, size * 0.78, size * 0.5, size * 0.88);
      ctx.quadraticCurveTo(size * 0.3, size * 0.78, size * 0.28, size * 0.6);
      break;
    case 'diamond':
      ctx.moveTo(size * 0.5, size * 0.3);
      ctx.lineTo(size * 0.72, size * 0.55);
      ctx.lineTo(size * 0.5, size * 0.85);
      ctx.lineTo(size * 0.28, size * 0.55);
      break;
    case 'hexagonal':
      const cx = size * 0.5, cy = size * 0.58, r = size * 0.24;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const hx = cx + r * Math.cos(angle);
        const hy = cy + r * Math.sin(angle) * 1.1;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      break;
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner highlight
  ctx.strokeStyle = addAlpha(palette.glow, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size * 0.36, size * 0.5);
  ctx.quadraticCurveTo(size * 0.4, size * 0.42, size * 0.5, size * 0.4);
  ctx.quadraticCurveTo(size * 0.6, size * 0.42, size * 0.64, size * 0.5);
  ctx.stroke();
}

// ─── Ears ───
function drawEars(ctx: CanvasRenderingContext2D, size: number, style: EarStyle, color: string, random: () => number) {
  ctx.strokeStyle = addAlpha(color, 0.6);
  ctx.lineWidth = 2;
  ctx.fillStyle = addAlpha(color, 0.15);

  for (let side = 0; side < 2; side++) {
    const xMult = side === 0 ? -1 : 1;
    const baseX = size * (side === 0 ? 0.28 : 0.72);
    const baseY = size * 0.45;

    ctx.beginPath();
    switch (style) {
      case 'pointed':
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + xMult * 25, baseY - 30);
        ctx.lineTo(baseX + xMult * 10, baseY + 5);
        break;
      case 'round':
        ctx.arc(baseX + xMult * 15, baseY - 10, 15, 0, Math.PI * 2);
        break;
      case 'folded':
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(baseX + xMult * 30, baseY - 20, baseX + xMult * 25, baseY + 10);
        ctx.lineTo(baseX + xMult * 12, baseY + 5);
        break;
      case 'long':
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + xMult * 35, baseY - 40);
        ctx.lineTo(baseX + xMult * 15, baseY + 5);
        break;
      case 'tufted':
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + xMult * 20, baseY - 25);
        ctx.lineTo(baseX + xMult * 25, baseY - 35);
        ctx.lineTo(baseX + xMult * 18, baseY - 20);
        ctx.lineTo(baseX + xMult * 8, baseY + 5);
        break;
      case 'small':
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + xMult * 12, baseY - 15);
        ctx.lineTo(baseX + xMult * 5, baseY + 3);
        break;
      case 'wing':
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(baseX + xMult * 40, baseY - 15, baseX + xMult * 30, baseY - 35);
        ctx.quadraticCurveTo(baseX + xMult * 20, baseY - 10, baseX + xMult * 5, baseY + 5);
        break;
      case 'horn':
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + xMult * 18, baseY - 22);
        ctx.lineTo(baseX + xMult * 22, baseY - 18);
        ctx.lineTo(baseX + xMult * 10, baseY + 5);
        break;
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// ─── Horns ───
function drawHorns(ctx: CanvasRenderingContext2D, size: number, style: HornStyle, color: string, glowColor: string, random: () => number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 10 + random() * 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (style) {
    case 'curved':
      ctx.beginPath(); ctx.moveTo(size * 0.32, size * 0.45);
      ctx.quadraticCurveTo(size * 0.12, size * 0.3, size * 0.18, size * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.68, size * 0.45);
      ctx.quadraticCurveTo(size * 0.88, size * 0.3, size * 0.82, size * 0.12); ctx.stroke();
      break;
    case 'straight':
      ctx.beginPath(); ctx.moveTo(size * 0.35, size * 0.42); ctx.lineTo(size * 0.22, size * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.65, size * 0.42); ctx.lineTo(size * 0.78, size * 0.1); ctx.stroke();
      break;
    case 'spiral':
      ctx.lineWidth = 8;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? 1 : -1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.45);
        for (let t = 0; t < Math.PI * 1.5; t += 0.1) {
          const spiralR = 30 + t * 25;
          ctx.lineTo(baseX + xMult * spiralR * Math.cos(t - Math.PI / 2) * 0.7, size * 0.35 - spiralR * Math.sin(t - Math.PI / 2) * 0.5);
        }
        ctx.stroke();
      }
      break;
    case 'branched':
      ctx.lineWidth = 6;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.45); ctx.lineTo(baseX + xMult * 50, size * 0.15); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(baseX + xMult * 20, size * 0.35); ctx.lineTo(baseX + xMult * 45, size * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(baseX + xMult * 35, size * 0.25); ctx.lineTo(baseX + xMult * 60, size * 0.18); ctx.stroke();
      }
      break;
    case 'wavy':
      ctx.lineWidth = 8;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.45);
        for (let t = 0; t < 1; t += 0.05) {
          ctx.lineTo(baseX + xMult * (t * 80 + Math.sin(t * 8) * 15), size * 0.45 - t * 180);
        }
        ctx.stroke();
      }
      break;
    case 'crystalline':
      ctx.lineWidth = 2;
      ctx.fillStyle = addAlpha(color, 0.3);
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.38 : 0.62);
        ctx.beginPath();
        ctx.moveTo(baseX, size * 0.45); ctx.lineTo(baseX + xMult * 30, size * 0.3);
        ctx.lineTo(baseX + xMult * 50, size * 0.1); ctx.lineTo(baseX + xMult * 40, size * 0.25);
        ctx.lineTo(baseX + xMult * 15, size * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    case 'flame':
      ctx.lineWidth = 3;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        for (let i = 0; i < 5; i++) {
          const grad = ctx.createLinearGradient(baseX, size * 0.45, baseX + xMult * 60, size * 0.1);
          grad.addColorStop(0, color); grad.addColorStop(1, addAlpha(glowColor, 0.5));
          ctx.strokeStyle = grad;
          ctx.beginPath(); ctx.moveTo(baseX + i * xMult * 5, size * 0.45);
          ctx.quadraticCurveTo(baseX + xMult * (40 + random() * 20), size * (0.2 + random() * 0.1), baseX + xMult * (50 + random() * 20), size * 0.08);
          ctx.stroke();
        }
      }
      break;
    case 'lightning':
      ctx.lineWidth = 4;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        ctx.beginPath();
        ctx.moveTo(baseX, size * 0.45); ctx.lineTo(baseX + xMult * 30, size * 0.35);
        ctx.lineTo(baseX + xMult * 20, size * 0.3); ctx.lineTo(baseX + xMult * 50, size * 0.2);
        ctx.lineTo(baseX + xMult * 35, size * 0.15); ctx.lineTo(baseX + xMult * 55, size * 0.08);
        ctx.stroke();
      }
      break;
    case 'tribal':
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(size * 0.32, size * 0.45);
      ctx.quadraticCurveTo(size * 0.15, size * 0.3, size * 0.2, size * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.68, size * 0.45);
      ctx.quadraticCurveTo(size * 0.85, size * 0.3, size * 0.8, size * 0.12); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = glowColor;
      for (let i = 0; i < 4; i++) {
        const t = 0.2 + i * 0.2;
        ctx.beginPath(); ctx.arc(size * 0.15 + t * 50, size * (0.4 - t * 0.35), 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(size * 0.85 - t * 50, size * (0.4 - t * 0.35), 8, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case 'mechanical':
      ctx.lineWidth = 4; ctx.fillStyle = addAlpha(color, 0.5);
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        for (let i = 0; i < 4; i++) {
          const segY = size * (0.42 - i * 0.08);
          const segX = baseX + xMult * (10 + i * 15);
          ctx.fillRect(segX - 10, segY - 8, 20, 16);
          ctx.strokeRect(segX - 10, segY - 8, 20, 16);
        }
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.42); ctx.lineTo(baseX + xMult * 55, size * 0.1); ctx.stroke();
      }
      break;
    case 'crown':
      ctx.lineWidth = 3; ctx.fillStyle = addAlpha(color, 0.25);
      ctx.beginPath();
      ctx.moveTo(size * 0.28, size * 0.42);
      ctx.lineTo(size * 0.22, size * 0.18); ctx.lineTo(size * 0.32, size * 0.28);
      ctx.lineTo(size * 0.4, size * 0.12); ctx.lineTo(size * 0.5, size * 0.25);
      ctx.lineTo(size * 0.6, size * 0.12); ctx.lineTo(size * 0.68, size * 0.28);
      ctx.lineTo(size * 0.78, size * 0.18); ctx.lineTo(size * 0.72, size * 0.42);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'double':
      ctx.lineWidth = 6;
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? -1 : 1;
        const baseX = size * (side === 0 ? 0.33 : 0.67);
        // Inner horn
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.45);
        ctx.quadraticCurveTo(baseX + xMult * 20, size * 0.3, baseX + xMult * 15, size * 0.15); ctx.stroke();
        // Outer horn
        ctx.beginPath(); ctx.moveTo(baseX + xMult * 5, size * 0.45);
        ctx.quadraticCurveTo(baseX + xMult * 45, size * 0.28, baseX + xMult * 55, size * 0.1); ctx.stroke();
      }
      break;
  }

  // Horn tip glows
  drawGlow(ctx, size * 0.2, size * 0.12, size * 0.08, glowColor);
  drawGlow(ctx, size * 0.8, size * 0.12, size * 0.08, glowColor);
}

// ─── Eyes ───
function drawEyes(ctx: CanvasRenderingContext2D, size: number, style: EyeStyle, color: string, glowColor: string, random: () => number) {
  const lx = size * 0.38, rx = size * 0.62, ey = size * 0.52;

  switch (style) {
    case 'glowing':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(lx, ey, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx, ey, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'scanner':
      drawGlow(ctx, lx, ey, 20, glowColor); drawGlow(ctx, rx, ey, 20, glowColor);
      ctx.fillStyle = color;
      ctx.fillRect(lx - 18, ey - 3, 36, 6); ctx.fillRect(rx - 18, ey - 3, 36, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 5, ey - 2, 10, 4); ctx.fillRect(rx - 5, ey - 2, 10, 4);
      break;
    case 'compound':
      drawGlow(ctx, lx, ey, 30, glowColor); drawGlow(ctx, rx, ey, 30, glowColor);
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7;
        ctx.fillStyle = i % 2 === 0 ? color : addAlpha(color, 0.5);
        ctx.beginPath(); ctx.arc(lx + 12 * Math.cos(angle) * 0.7, ey + 12 * Math.sin(angle) * 0.7, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx + 12 * Math.cos(angle) * 0.7, ey + 12 * Math.sin(angle) * 0.7, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cyber':
      drawGlow(ctx, size * 0.5, ey, size * 0.25, glowColor);
      const visorGrad = ctx.createLinearGradient(size * 0.25, ey, size * 0.75, ey);
      visorGrad.addColorStop(0, addAlpha(color, 0.3)); visorGrad.addColorStop(0.5, color); visorGrad.addColorStop(1, addAlpha(color, 0.3));
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.moveTo(size * 0.28, ey - 8); ctx.lineTo(size * 0.72, ey - 8);
      ctx.lineTo(size * 0.68, ey + 10); ctx.lineTo(size * 0.32, ey + 10);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 3, ey - 2, 6, 4); ctx.fillRect(rx - 3, ey - 2, 6, 4);
      break;
    case 'flame':
      drawGlow(ctx, lx, ey, 30, glowColor); drawGlow(ctx, rx, ey, 30, glowColor);
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        for (let i = 0; i < 5; i++) {
          const flameGrad = ctx.createLinearGradient(ex, ey + 10, ex, ey - 20);
          flameGrad.addColorStop(0, color); flameGrad.addColorStop(1, addAlpha(glowColor, 0.3));
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(ex - 8 + i * 4, ey + 5);
          ctx.quadraticCurveTo(ex - 8 + i * 4 + random() * 5, ey - 15, ex - 6 + i * 4, ey - 10 - random() * 10);
          ctx.quadraticCurveTo(ex - 4 + i * 4, ey - 5, ex - 4 + i * 4, ey + 5);
          ctx.closePath(); ctx.fill();
        }
      }
      break;
    case 'void':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx, ey, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ey, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(lx, ey, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'star':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.fillStyle = color;
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
          const r = i % 2 === 0 ? 14 : 7;
          const px = ex + r * Math.cos(angle), py = ey + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'target':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 18, ey); ctx.lineTo(ex + 18, ey);
        ctx.moveTo(ex, ey - 18); ctx.lineTo(ex, ey + 18); ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(lx, ey, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'diamond':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.fillStyle = color;
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        ctx.beginPath();
        ctx.moveTo(ex, ey - 14); ctx.lineTo(ex + 12, ey); ctx.lineTo(ex, ey + 14); ctx.lineTo(ex - 12, ey);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'circuit':
      drawGlow(ctx, lx, ey, 20, glowColor); drawGlow(ctx, rx, ey, 20, glowColor);
      ctx.fillStyle = color;
      ctx.fillRect(lx - 12, ey - 8, 24, 16); ctx.fillRect(rx - 12, ey - 8, 24, 16);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        ctx.beginPath(); ctx.moveTo(ex - 10, ey - 5); ctx.lineTo(ex, ey - 5); ctx.lineTo(ex + 5, ey); ctx.lineTo(ex + 10, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 8, ey + 4); ctx.lineTo(ex + 8, ey + 4); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'crescent':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      ctx.fillStyle = color;
      for (let e = 0; e < 2; e++) {
        const ex = e === 0 ? lx : rx;
        ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = addAlpha('#000000', 0.8);
        ctx.beginPath(); ctx.arc(ex + (e === 0 ? 5 : -5), ey - 3, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
      }
      break;
    case 'split':
      drawGlow(ctx, lx, ey, 25, glowColor); drawGlow(ctx, rx, ey, 25, glowColor);
      // Left eye one color, right eye secondary
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(lx, ey, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = glowColor;
      ctx.beginPath(); ctx.ellipse(rx, ey, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(lx, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ey, 5, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

// ─── Nose ───
function drawNose(ctx: CanvasRenderingContext2D, size: number, style: NoseStyle, color: string, random: () => number) {
  const ny = size * 0.7;
  ctx.strokeStyle = addAlpha(color, 0.5);
  ctx.lineWidth = 2;

  switch (style) {
    case 'oval':
      ctx.beginPath(); ctx.ellipse(size * 0.5, ny, 18, 12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = addAlpha(color, 0.3);
      ctx.beginPath(); ctx.ellipse(size * 0.45, ny, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(size * 0.55, ny, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'triangular':
      ctx.beginPath(); ctx.moveTo(size * 0.5, ny - 10);
      ctx.lineTo(size * 0.56, ny + 8); ctx.lineTo(size * 0.44, ny + 8);
      ctx.closePath(); ctx.stroke();
      break;
    case 'wide':
      ctx.beginPath(); ctx.moveTo(size * 0.4, ny - 5);
      ctx.quadraticCurveTo(size * 0.5, ny - 12, size * 0.6, ny - 5);
      ctx.quadraticCurveTo(size * 0.62, ny + 8, size * 0.5, ny + 10);
      ctx.quadraticCurveTo(size * 0.38, ny + 8, size * 0.4, ny - 5);
      ctx.stroke();
      break;
    case 'snub':
      ctx.beginPath(); ctx.arc(size * 0.5, ny, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = addAlpha(color, 0.3);
      ctx.beginPath(); ctx.arc(size * 0.47, ny + 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.53, ny + 2, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'pointed':
      ctx.beginPath(); ctx.moveTo(size * 0.5, ny - 15);
      ctx.quadraticCurveTo(size * 0.56, ny, size * 0.52, ny + 5);
      ctx.lineTo(size * 0.48, ny + 5);
      ctx.quadraticCurveTo(size * 0.44, ny, size * 0.5, ny - 15);
      ctx.stroke();
      break;
    case 'flat':
      ctx.beginPath(); ctx.moveTo(size * 0.42, ny);
      ctx.lineTo(size * 0.58, ny);
      ctx.stroke();
      ctx.fillStyle = addAlpha(color, 0.3);
      ctx.beginPath(); ctx.arc(size * 0.46, ny + 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.54, ny + 3, 3, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

// ─── Mouth ───
function drawMouth(ctx: CanvasRenderingContext2D, size: number, style: MouthStyle, color: string, random: () => number) {
  const my = size * 0.78;
  ctx.strokeStyle = addAlpha(color, 0.45);
  ctx.lineWidth = 2;

  switch (style) {
    case 'neutral':
      ctx.beginPath(); ctx.moveTo(size * 0.44, my); ctx.lineTo(size * 0.56, my); ctx.stroke();
      break;
    case 'smirk':
      ctx.beginPath(); ctx.moveTo(size * 0.44, my);
      ctx.quadraticCurveTo(size * 0.5, my + 5, size * 0.56, my - 3); ctx.stroke();
      break;
    case 'open':
      ctx.fillStyle = addAlpha('#000000', 0.3);
      ctx.beginPath(); ctx.ellipse(size * 0.5, my, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    case 'fangs':
      ctx.beginPath(); ctx.moveTo(size * 0.42, my);
      ctx.quadraticCurveTo(size * 0.5, my + 4, size * 0.58, my); ctx.stroke();
      // Fangs
      ctx.fillStyle = addAlpha(color, 0.6);
      ctx.beginPath(); ctx.moveTo(size * 0.44, my); ctx.lineTo(size * 0.46, my + 8); ctx.lineTo(size * 0.48, my); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.52, my); ctx.lineTo(size * 0.54, my + 8); ctx.lineTo(size * 0.56, my); ctx.fill();
      break;
    case 'line':
      ctx.beginPath(); ctx.moveTo(size * 0.42, my); ctx.lineTo(size * 0.58, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.45, my + 4); ctx.lineTo(size * 0.55, my + 4); ctx.stroke();
      break;
    case 'curved':
      ctx.beginPath(); ctx.moveTo(size * 0.42, my);
      ctx.quadraticCurveTo(size * 0.5, my + 8, size * 0.58, my); ctx.stroke();
      break;
  }
}

// ─── Face patterns ───
function drawFacePattern(ctx: CanvasRenderingContext2D, size: number, pattern: FacePattern, color: string, random: () => number) {
  ctx.strokeStyle = addAlpha(color, 0.4);
  ctx.lineWidth = 1;

  switch (pattern) {
    case 'tribal':
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? 1 : -1;
        const baseX = size * (side === 0 ? 0.35 : 0.65);
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.58); ctx.lineTo(baseX + xMult * 15, size * 0.62);
        ctx.lineTo(baseX + xMult * 8, size * 0.68); ctx.lineTo(baseX + xMult * 20, size * 0.72); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.48); ctx.lineTo(baseX + xMult * 25, size * 0.46); ctx.stroke();
      }
      break;
    case 'circuit':
      for (let i = 0; i < 8; i++) {
        const y = size * (0.56 + i * 0.03);
        ctx.beginPath(); ctx.moveTo(size * 0.32, y); ctx.lineTo(size * 0.32 + random() * 30, y);
        if (random() > 0.5) ctx.lineTo(size * 0.32 + random() * 30, y + 10);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 0.68, y); ctx.lineTo(size * 0.68 - random() * 30, y);
        if (random() > 0.5) ctx.lineTo(size * 0.68 - random() * 30, y + 10);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(size * (0.32 + random() * 0.08), size * (0.56 + random() * 0.2), 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(size * (0.68 - random() * 0.08), size * (0.56 + random() * 0.2), 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'holographic':
      for (let i = 0; i < 12; i++) {
        const grad = ctx.createLinearGradient(size * 0.3, 0, size * 0.7, 0);
        grad.addColorStop(0, addAlpha(color, 0)); grad.addColorStop(0.5, addAlpha(color, 0.3)); grad.addColorStop(1, addAlpha(color, 0));
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(size * 0.3, size * (0.45 + i * 0.03)); ctx.lineTo(size * 0.7, size * (0.45 + i * 0.03)); ctx.stroke();
      }
      break;
    case 'geometric':
      ctx.strokeStyle = addAlpha(color, 0.3);
      for (let i = 0; i < 4; i++) {
        const cx = size * (0.35 + random() * 0.3), cy = size * (0.6 + random() * 0.15), s = 8 + random() * 8;
        ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy + s); ctx.lineTo(cx - s, cy + s); ctx.closePath(); ctx.stroke();
      }
      break;
    case 'nature':
      ctx.strokeStyle = addAlpha(color, 0.3);
      for (let side = 0; side < 2; side++) {
        const xMult = side === 0 ? 1 : -1;
        const baseX = size * (side === 0 ? 0.4 : 0.6);
        ctx.beginPath(); ctx.moveTo(baseX, size * 0.55); ctx.lineTo(baseX + xMult * 10, size * 0.75); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const t = 0.2 + i * 0.2;
          ctx.beginPath(); ctx.moveTo(baseX + xMult * t * 10, size * (0.55 + t * 0.2));
          ctx.lineTo(baseX + xMult * (t * 10 + 15), size * (0.55 + t * 0.2 + 0.05)); ctx.stroke();
        }
      }
      break;
    case 'binary':
      ctx.font = '8px monospace'; ctx.fillStyle = addAlpha(color, 0.3);
      for (let i = 0; i < 5; i++) {
        const binary = Array(8).fill(0).map(() => random() > 0.5 ? '1' : '0').join('');
        ctx.fillText(binary, size * 0.32, size * (0.58 + i * 0.04));
        ctx.fillText(binary, size * 0.55, size * (0.58 + i * 0.04));
      }
      break;
    case 'constellation':
      ctx.fillStyle = color;
      const stars: { x: number; y: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const x = size * (0.32 + random() * 0.36), y = size * (0.58 + random() * 0.18);
        stars.push({ x, y });
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = addAlpha(color, 0.2);
      for (let i = 0; i < stars.length - 1; i++) {
        if (random() > 0.4) {
          ctx.beginPath(); ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[i + 1].x, stars[i + 1].y); ctx.stroke();
        }
      }
      break;
    case 'crack':
      ctx.strokeStyle = addAlpha(color, 0.4);
      for (let i = 0; i < 5; i++) {
        let x = size * 0.5, y = size * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += (random() - 0.5) * 40; y += random() * 20; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      break;
    case 'grid':
      ctx.strokeStyle = addAlpha(color, 0.15);
      for (let x = size * 0.3; x < size * 0.7; x += 15) { ctx.beginPath(); ctx.moveTo(x, size * 0.5); ctx.lineTo(x, size * 0.8); ctx.stroke(); }
      for (let y = size * 0.5; y < size * 0.8; y += 15) { ctx.beginPath(); ctx.moveTo(size * 0.3, y); ctx.lineTo(size * 0.7, y); ctx.stroke(); }
      break;
    case 'wave':
      ctx.strokeStyle = addAlpha(color, 0.3);
      for (let i = 0; i < 5; i++) {
        const baseY = size * (0.58 + i * 0.04);
        ctx.beginPath();
        for (let x = size * 0.3; x < size * 0.7; x += 5) {
          const y = baseY + Math.sin((x - size * 0.3) * 0.1) * 5;
          if (x === size * 0.3) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
  }
}

// ─── Special effects ───
function addSpecialEffects(ctx: CanvasRenderingContext2D, size: number, palette: typeof accentPalettes[0], effectType: number, random: () => number) {
  switch (effectType % 8) {
    case 0: // Particle aura
      ctx.fillStyle = palette.glow;
      for (let i = 0; i < 20; i++) {
        const angle = random() * Math.PI * 2, dist = size * (0.35 + random() * 0.12);
        ctx.beginPath(); ctx.arc(size / 2 + dist * Math.cos(angle), size * 0.55 + dist * Math.sin(angle) * 0.8, 1 + random() * 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 1: // Energy rings
      ctx.strokeStyle = addAlpha(palette.secondary, 0.3); ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(size / 2, size * 0.55, size * (0.3 + i * 0.05), size * (0.25 + i * 0.04), 0, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case 2: // Corner brackets
      ctx.strokeStyle = palette.accent; ctx.lineWidth = 2;
      const cs = 30;
      ctx.beginPath(); ctx.moveTo(20, 20 + cs); ctx.lineTo(20, 20); ctx.lineTo(20 + cs, 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size - 20 - cs, 20); ctx.lineTo(size - 20, 20); ctx.lineTo(size - 20, 20 + cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, size - 20 - cs); ctx.lineTo(20, size - 20); ctx.lineTo(20 + cs, size - 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size - 20 - cs, size - 20); ctx.lineTo(size - 20, size - 20); ctx.lineTo(size - 20, size - 20 - cs); ctx.stroke();
      break;
    case 3: // Energy lines from horns
      ctx.strokeStyle = addAlpha(palette.glow, 0.4); ctx.lineWidth = 1;
      for (let side = 0; side < 2; side++) {
        const startX = side === 0 ? size * 0.2 : size * 0.8;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(startX, size * 0.12); ctx.lineTo(startX + (random() - 0.5) * 100, 0); ctx.stroke(); }
      }
      break;
    case 4: // Hexagon frame
      ctx.strokeStyle = addAlpha(palette.secondary, 0.2); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const hx = size / 2 + size * 0.45 * Math.cos(angle), hy = size / 2 + size * 0.45 * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath(); ctx.stroke();
      break;
    case 5: // Scan lines
      ctx.strokeStyle = addAlpha(palette.glow, 0.04); ctx.lineWidth = 1;
      for (let y = 0; y < size; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
      break;
    case 6: // Diamond sparks
      ctx.fillStyle = addAlpha(palette.glow, 0.6);
      for (let i = 0; i < 8; i++) {
        const sx = size * (0.1 + random() * 0.8), sy = size * (0.1 + random() * 0.8), ss = 2 + random() * 4;
        ctx.beginPath(); ctx.moveTo(sx, sy - ss); ctx.lineTo(sx + ss * 0.5, sy); ctx.lineTo(sx, sy + ss); ctx.lineTo(sx - ss * 0.5, sy); ctx.closePath(); ctx.fill();
      }
      break;
    case 7: // Circular pulse
      ctx.strokeStyle = addAlpha(palette.accent, 0.15); ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(size / 2, size * 0.55, size * (0.15 + i * 0.1), 0, Math.PI * 2); ctx.stroke();
      }
      break;
  }
}

// ─── Main generator ───
function generateLogo(index: number): Buffer {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(index * 12345);

  // Select variations
  const paletteIdx = index % accentPalettes.length;
  const hornIdx = (index + Math.floor(index / 20)) % hornStyles.length;
  const eyeIdx = (index + Math.floor(index / 5)) % eyeStyles.length;
  const faceIdx = (index * 3 + Math.floor(index / 7)) % facePatterns.length;
  const headIdx = (index * 2 + Math.floor(index / 8)) % headShapes.length;
  const noseIdx = (index + Math.floor(index / 3)) % noseStyles.length;
  const mouthIdx = (index * 5 + Math.floor(index / 4)) % mouthStyles.length;
  const earIdx = (index * 7 + Math.floor(index / 6)) % earStyles.length;

  const palette = accentPalettes[paletteIdx];

  // Draw layers
  drawBackground(ctx, SIZE, index);
  drawHorns(ctx, SIZE, hornStyles[hornIdx], palette.primary, palette.glow, random);
  drawHead(ctx, SIZE, headShapes[headIdx], palette, random);
  drawEars(ctx, SIZE, earStyles[earIdx], palette.primary, random);
  drawEyes(ctx, SIZE, eyeStyles[eyeIdx], palette.secondary, palette.glow, random);
  drawNose(ctx, SIZE, noseStyles[noseIdx], palette.secondary, random);
  drawMouth(ctx, SIZE, mouthStyles[mouthIdx], palette.secondary, random);
  drawFacePattern(ctx, SIZE, facePatterns[faceIdx], palette.secondary, random);
  addSpecialEffects(ctx, SIZE, palette, index, random);

  return canvas.toBuffer('image/png');
}

// ─── Main execution ───
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Clean old files
  const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(OUTPUT_DIR, file));
  }

  console.log('');
  console.log('ANOA NFT Logo Generator');
  console.log('=========================================');
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Size: ${SIZE}x${SIZE}px | Total: ${TOTAL_LOGOS}`);
  console.log(`Palettes: ${accentPalettes.length} | Horns: ${hornStyles.length} | Eyes: ${eyeStyles.length}`);
  console.log(`Heads: ${headShapes.length} | Noses: ${noseStyles.length} | Mouths: ${mouthStyles.length}`);
  console.log(`Ears: ${earStyles.length} | Patterns: ${facePatterns.length}`);
  console.log('Background: Purple gradient (primary-500 to purple-600)');
  console.log('=========================================');
  console.log('');

  for (let i = 1; i <= TOTAL_LOGOS; i++) {
    const pngBuffer = generateLogo(i);
    const filename = `agent-${i}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, pngBuffer);

    if (i % 20 === 0) {
      const palette = accentPalettes[(i - 1) % accentPalettes.length];
      const horn = hornStyles[(i + Math.floor(i / 20)) % hornStyles.length];
      const head = headShapes[(i * 2 + Math.floor(i / 8)) % headShapes.length];
      console.log(`Generated ${i}/${TOTAL_LOGOS} | Accent: ${palette.primary} | Horn: ${horn} | Head: ${head}`);
    }
  }

  console.log('');
  console.log('=========================================');
  console.log(`Done! Generated ${TOTAL_LOGOS} unique ANOA agent logos`);
  console.log('');
  console.log('Each logo features:');
  console.log('  - Purple gradient background');
  console.log('  - Unique head shape, horn, eye, nose, mouth, ear combination');
  console.log('  - Face pattern overlay');
  console.log('  - Special effects');
  console.log('=========================================');
}

main().catch(console.error);
