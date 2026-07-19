import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  EtherAnimationMode,
  EtherColorMode,
  EtherZone,
} from '@/features/devices/deviceSchema';

/**
 * Global Etherlighting configuration — the base layer of the
 * settings hierarchy (global → device → port). Everything here is
 * user-editable and persists; the resolver merges it with device and
 * port overrides into the values the renderer consumes.
 */

export type { EtherAnimationMode, EtherColorMode, EtherZone };
export {
  ETHER_ANIMATION_MODES,
  ETHER_COLOR_MODES,
  ETHER_ZONES,
} from '@/features/devices/deviceSchema';

/** Editable global speed→color palette (hex), keyed by speed class. */
export const DEFAULT_SPEED_PALETTE: Record<string, string> = {
  '10m': '#8a8f99',
  '100m': '#4c82f7',
  '1g': '#3fb970',
  '2.5g': '#9be34c',
  '5g': '#e8d44d',
  '10g': '#e8973f',
  '25g': '#e5544b',
  '40g': '#e86ab8',
  '100g': '#9b6ae8',
};

/** Speed class key for a link speed in Gbps. */
export function speedClass(speedGbps: number | undefined): string | null {
  if (speedGbps === undefined || speedGbps <= 0) return null;
  if (speedGbps <= 0.01) return '10m';
  if (speedGbps <= 0.1) return '100m';
  if (speedGbps <= 1) return '1g';
  if (speedGbps <= 2.5) return '2.5g';
  if (speedGbps <= 5) return '5g';
  if (speedGbps <= 10) return '10g';
  if (speedGbps <= 25) return '25g';
  if (speedGbps <= 40) return '40g';
  return '100g';
}

export interface EtherlightingSettings {
  enabled: boolean;
  /** Default frame brightness 0–1. */
  brightness: number;
  /** Ceiling any override may reach 0–2. */
  maxBrightness: number;
  /** Animation playback speed multiplier. */
  animationSpeed: number;
  /** Color transition ease speed multiplier. */
  transitionSpeed: number;
  colorMode: EtherColorMode;
  animationMode: EtherAnimationMode;
  /** Global color saturation multiplier 0–1.5. */
  saturation: number;
  /** Global emissive intensity multiplier. */
  intensity: number;
  /** Bloom pass strength (when bloom is enabled). */
  bloomStrength: number;
  /** Frame glow band width as a fraction of the opening size. */
  glowRadius: number;
  /** HDR emissive multiplier (>1 feeds bloom). */
  hdrStrength: number;
  /** Render quality: frame tessellation/effect fidelity. */
  quality: 'performance' | 'balanced' | 'high';
  /** Camera distance beyond which frames stop rendering, meters. */
  renderDistanceM: number;
  enableBloom: boolean;
  enableHdr: boolean;
  enableAnimations: boolean;
  /** Default zones lit on every frame. */
  zones: EtherZone[];
  /** Custom color used by the 'custom' color mode. */
  customColor: string;
  /** PoE indication color. */
  poeColor: string;
  /** Activity flash color (traffic accent for a live/up port). */
  activityColor: string;
  /** Color for a connected port with no link (activity mode). */
  linkDownColor: string;
  /** Color for a connected port in a degraded/warning state. */
  warningColor: string;
  /** Editable speed palette. */
  speedPalette: Record<string, string>;
}

export const DEFAULT_ETHERLIGHTING: EtherlightingSettings = {
  enabled: true,
  brightness: 0.9,
  maxBrightness: 1.6,
  animationSpeed: 1,
  transitionSpeed: 1,
  colorMode: 'speed',
  animationMode: 'static',
  saturation: 1,
  intensity: 1,
  bloomStrength: 0.55,
  glowRadius: 0.24,
  hdrStrength: 1.8,
  quality: 'balanced',
  renderDistanceM: 6,
  enableBloom: true,
  enableHdr: true,
  enableAnimations: true,
  zones: ['full'],
  customColor: '#4c82f7',
  poeColor: '#3fb970',
  activityColor: '#e8d44d',
  linkDownColor: '#e5544b',
  warningColor: '#e8973f',
  speedPalette: DEFAULT_SPEED_PALETTE,
};

interface EtherlightingState {
  settings: EtherlightingSettings;
  patch: (patch: Partial<EtherlightingSettings>) => void;
  setSpeedColor: (speedKey: string, hex: string) => void;
  reset: () => void;
}

export const useEtherlightingStore = create<EtherlightingState>()(
  persist(
    (set) => ({
      settings: DEFAULT_ETHERLIGHTING,
      patch: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setSpeedColor: (speedKey, hex) =>
        set((s) => ({
          settings: {
            ...s.settings,
            speedPalette: { ...s.settings.speedPalette, [speedKey]: hex },
          },
        })),
      reset: () => set({ settings: DEFAULT_ETHERLIGHTING }),
    }),
    {
      name: 'rackforge-etherlighting',
      // Backfill any settings added since a user's state was persisted, so
      // new keys (e.g. link-down / warning colors) always have a default
      // instead of resolving to undefined.
      merge: (persisted, current) => {
        const p = persisted as { settings?: Partial<EtherlightingSettings> };
        return {
          ...current,
          settings: { ...DEFAULT_ETHERLIGHTING, ...(p?.settings ?? {}) },
        };
      },
    },
  ),
);
