import {
  speedClass,
  type EtherAnimationMode,
  type EtherColorMode,
  type EtherZone,
  type EtherlightingSettings,
} from './etherlightingStore';
import type { PortLinkStatus, PortRuntime } from './portRuntimeStore';
import type {
  DeviceDefinition,
  PortEtherLighting,
} from '@/features/devices/deviceSchema';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

/**
 * The Etherlighting resolver — pure functions turning the settings
 * hierarchy (global → device → port) plus a port's runtime state into
 * exactly what the renderer draws. Authored ports are the single
 * source of truth: if a port exists, it resolves; overrides only
 * refine. No renderer, store or device code ever re-implements any of
 * this logic.
 */

/** Zone bitmask bits (shader-side switch uses the same values). */
export const ZONE_BITS: Record<'top' | 'bottom' | 'left' | 'right', number> = {
  top: 1,
  bottom: 2,
  left: 4,
  right: 8,
};
export const ZONE_FULL = 15;

export interface ResolvedPortLight {
  /** Port participates in Etherlighting at all. */
  enabled: boolean;
  /** Primary emissive color, hex. */
  color: string;
  /** Secondary color (gradient / multi-zone / activity flash). */
  color2: string;
  /** Final brightness 0..maxBrightness. */
  brightness: number;
  /** Edge bitmask (top|bottom|left|right). */
  zoneMask: number;
  /** Light only the corners. */
  corners: boolean;
  /** Frame placement: -1 inner, 0 on the opening edge, 1 outer. */
  frameOffset: -1 | 0 | 1;
  /** Animation mode for the shader. */
  mode: EtherAnimationMode;
  /** Glow band width, fraction of the opening. */
  glowRadius: number;
  /** Color transition speed multiplier. */
  transitionSpeed: number;
  /** Traffic activity level 0–1 driving activity/traffic modes. */
  activity: number;
}

/** Power-family port types never light by default. */
const POWER_TYPES = new Set([
  'power',
  'dc',
  'c13',
  'c14',
  'c19',
  'c20',
  'iec-lock',
  'nema',
  'external-adapter',
]);

/** A port is Etherlighting-eligible purely from its metadata. */
export function isEligiblePort(port: PhysicalPort): boolean {
  return port.visible && !POWER_TYPES.has(port.type);
}

/** Effective port state, plus 'none' when nothing is connected. */
export type PortActivityState = PortLinkStatus | 'none';

/**
 * The operational state Activity mode visualises: an explicit runtime
 * status wins, otherwise a port with a link is 'up' and everything else
 * is 'none' (nothing plugged in). This is what turns unconnected ports
 * dark in Activity mode instead of leaving them glowing.
 */
export function portActivityState(runtime: PortRuntime): PortActivityState {
  if (runtime.status) return runtime.status;
  return runtime.link ? 'up' : 'none';
}

export function zonesToMask(zones: readonly EtherZone[]): {
  mask: number;
  corners: boolean;
  frameOffset: -1 | 0 | 1;
} {
  let mask = 0;
  let corners = false;
  let frameOffset: -1 | 0 | 1 = 0;
  for (const zone of zones) {
    switch (zone) {
      case 'full':
        mask |= ZONE_FULL;
        break;
      case 'top':
      case 'bottom':
      case 'left':
      case 'right':
        mask |= ZONE_BITS[zone];
        break;
      case 'corners':
        corners = true;
        break;
      case 'inner':
        frameOffset = -1;
        break;
      case 'outer':
        frameOffset = 1;
        break;
    }
  }
  if (mask === 0) mask = ZONE_FULL;
  return { mask, corners, frameOffset };
}

/** HSL hue interpolation for gradient mode (t 0..1 across the panel). */
function gradientHex(t: number): string {
  const hue = 210 - t * 180; // blue → violet sweep across the faceplate
  return `hsl(${((hue % 360) + 360) % 360}, 85%, 60%)`;
}

/** Shifts a hex/hsl color's hue for multi-zone secondary tinting. */
function hueShift(color: string, degrees: number): string {
  // Parse via a canvas-free path: rely on hsl passthrough or hex parse.
  const hex = color.startsWith('#') ? color : null;
  if (!hex) return color;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const nh = (((h + degrees) % 360) + 360) % 360;
  return `hsl(${nh.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%)`;
}

/**
 * The port's base Etherlighting hue for UI accents (cable-tool glow,
 * layout maps): the global speed palette by the port's speed class.
 * Null for ineligible ports.
 */
export function portGlowColor(
  settings: EtherlightingSettings,
  port: PhysicalPort,
): string | null {
  if (!isEligiblePort(port)) return null;
  const key = speedClass(port.speedGbps);
  return (key ? settings.speedPalette[key] : undefined) ?? settings.customColor;
}

export interface ResolveContext {
  settings: EtherlightingSettings;
  definition: DeviceDefinition;
  port: PhysicalPort;
  runtime: PortRuntime;
  /** Normalized panel position 0..1 (gradient mode). */
  xNorm: number;
}

/**
 * Resolves one port's Etherlighting through the full hierarchy.
 * Deterministic and allocation-light — the renderer calls this for
 * every port whenever settings, cables or runtime states change.
 */
export function resolvePortLight(context: ResolveContext): ResolvedPortLight {
  const { settings, definition, port, runtime } = context;
  const deviceLighting = definition.lighting;
  const portOverride: PortEtherLighting | undefined = port.etherLighting;

  const off: ResolvedPortLight = {
    enabled: false,
    color: '#000000',
    color2: '#000000',
    brightness: 0,
    zoneMask: ZONE_FULL,
    corners: false,
    frameOffset: 0,
    mode: 'off',
    glowRadius: settings.glowRadius,
    transitionSpeed: settings.transitionSpeed,
    activity: 0,
  };

  // Hierarchy: global kill switch → device opt-out → port opt-out →
  // metadata eligibility.
  if (!settings.enabled) return off;
  if (deviceLighting?.etherlighting === false) return off;
  if (portOverride?.enabled === false) return off;
  if (!isEligiblePort(port)) return off;

  const mode: EtherAnimationMode =
    portOverride?.animationMode ??
    (deviceLighting?.defaultMode === 'off'
      ? 'off'
      : (deviceLighting?.defaultMode === 'pulse' ? 'pulse' : undefined) ??
        settings.animationMode);
  if (mode === 'off') return off;

  const colorMode: EtherColorMode =
    portOverride?.colorMode ?? deviceLighting?.colorMode ?? settings.colorMode;

  const speedGbps = runtime.speedGbps ?? port.speedGbps;
  const speedKey = speedClass(speedGbps);
  const speedColor =
    (speedKey ? settings.speedPalette[speedKey] : undefined) ??
    settings.customColor;
  const manufacturerColor =
    (speedKey ? deviceLighting?.speedColors?.[speedKey] : undefined) ??
    deviceLighting?.portHighlightColor ??
    speedColor;

  const linked = runtime.link ?? false;
  let color = speedColor;
  let color2 = speedColor;
  let linkDim = 1;
  // Activity mode overrides the animation/traffic level for fault states
  // (a down port shouldn't flash like a busy one).
  let overrideMode: EtherAnimationMode | null = null;
  let overrideActivity: number | null = null;
  switch (colorMode) {
    case 'speed':
      color = speedColor;
      break;
    case 'poe':
      color = port.poe
        ? (portOverride?.poeColor ?? settings.poeColor)
        : speedColor;
      break;
    case 'activity':
      color = speedColor;
      color2 = settings.activityColor;
      break;
    case 'link':
      color = linked ? speedColor : '#6a7078';
      linkDim = linked ? 1 : 0.25;
      break;
    case 'custom':
      color = portOverride?.customColor ?? settings.customColor;
      break;
    case 'manufacturer':
      color = manufacturerColor;
      break;
    case 'gradient':
      color = gradientHex(context.xNorm);
      color2 = gradientHex(Math.min(1, context.xNorm + 0.15));
      break;
    case 'multi-zone':
      color = portOverride?.customColor ?? speedColor;
      color2 = hueShift(color, 70);
      break;
  }
  if (colorMode !== 'activity') color2 = color2 === color ? color : color2;

  // Live link-state treatment. Activity applies through EITHER the color
  // mode or the animation mode, so "Animation: Activity" alone still darks
  // out unconnected ports. Only connected ports light: a down port is solid
  // red, a degraded one pulses amber, a live port keeps its color and
  // flashes with traffic.
  const activitySemantics =
    colorMode === 'activity' || mode === 'activity' || mode === 'traffic';
  if (activitySemantics) {
    // Only connectivity/fault handling here — a live ("up") port keeps the
    // exact color and animation the color mode already gave it, so the lit
    // look is unchanged from before this behavior existed.
    const state = portActivityState(runtime);
    if (state === 'none' || state === 'disabled') return off;
    if (state === 'down') {
      color = settings.linkDownColor;
      color2 = settings.linkDownColor;
      overrideMode = 'static';
      overrideActivity = 0;
    } else if (state === 'warning') {
      color = settings.warningColor;
      color2 = settings.warningColor;
      overrideMode = 'breathing';
      overrideActivity = 0;
    }
  }

  const base =
    portOverride?.brightness ??
    deviceLighting?.brightness ??
    settings.brightness;
  const brightness = Math.min(settings.maxBrightness, base * linkDim);

  const zones = portOverride?.zones ?? settings.zones;
  const { mask, corners, frameOffset } = zonesToMask(zones);

  return {
    enabled: brightness > 0.01,
    color,
    color2,
    brightness,
    zoneMask: mask,
    corners,
    frameOffset,
    mode: settings.enableAnimations ? (overrideMode ?? mode) : 'static',
    glowRadius: portOverride?.glowRadius ?? settings.glowRadius,
    transitionSpeed: portOverride?.transitionSpeed ?? settings.transitionSpeed,
    activity: overrideActivity ?? runtime.activity ?? (linked ? 0.5 : 0),
  };
}
