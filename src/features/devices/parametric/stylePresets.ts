/**
 * Manufacturer style presets for the Parametric Device Generator. A
 * preset is pure data — colors, finish, corner radius, vent pattern —
 * consumed by the chassis spec builder and renderer. Adding a brand is
 * adding one record here; nothing else in the pipeline changes.
 */

export const VENT_STYLES = ['slots', 'hex', 'holes', 'grille'] as const;
export type VentStyle = (typeof VENT_STYLES)[number];

export type ChassisFinish = 'brushed' | 'powder' | 'plastic';

export interface StylePreset {
  id: string;
  /** Chassis paint: main body, faceplate, small details, brand accent. */
  body: string;
  face: string;
  detail: string;
  accent: string;
  /** Face finish drives the material family. */
  finish: ChassisFinish;
  metalness: number;
  roughness: number;
  cornerRadiusMm: number;
  ventStyle: VentStyle;
  /** Silkscreen inks. */
  badgeInk: string;
  labelInk: string;
}

const preset = (
  id: string,
  over: Partial<Omit<StylePreset, 'id'>> = {},
): StylePreset => ({
  id,
  body: '#1d1f23',
  face: '#26282d',
  detail: '#101114',
  accent: '#4c82f7',
  finish: 'powder',
  metalness: 0.62,
  roughness: 0.46,
  cornerRadiusMm: 2.5,
  ventStyle: 'slots',
  badgeInk: 'rgba(255,255,255,0.78)',
  labelInk: 'rgba(255,255,255,0.4)',
  ...over,
});

/** Keyed by lowercase manufacturer id/name substring. */
const PRESETS: ReadonlyArray<{ match: string[]; style: StylePreset }> = [
  {
    match: ['ubiquiti', 'unifi', 'ubnt'],
    style: preset('ubiquiti', {
      body: '#c8ccd2',
      face: '#dfe2e6',
      detail: '#9aa0a8',
      accent: '#2f8cff',
      finish: 'brushed',
      metalness: 0.85,
      roughness: 0.32,
      cornerRadiusMm: 3.5,
      ventStyle: 'holes',
      badgeInk: 'rgba(20,24,30,0.72)',
      labelInk: 'rgba(20,24,30,0.42)',
    }),
  },
  {
    match: ['cisco'],
    style: preset('cisco', {
      body: '#2a3540',
      face: '#33404c',
      detail: '#1a222a',
      accent: '#00bceb',
      ventStyle: 'slots',
      cornerRadiusMm: 1.5,
    }),
  },
  {
    match: ['dell'],
    style: preset('dell', {
      body: '#23262a',
      face: '#2c3034',
      detail: '#141619',
      accent: '#0672cb',
      ventStyle: 'hex',
      cornerRadiusMm: 2,
    }),
  },
  {
    match: ['hpe', 'hewlett'],
    style: preset('hpe', {
      body: '#26292c',
      face: '#303438',
      detail: '#17191c',
      accent: '#01a982',
      ventStyle: 'hex',
      cornerRadiusMm: 2,
    }),
  },
  {
    match: ['juniper'],
    style: preset('juniper', {
      body: '#232830',
      face: '#2c323c',
      detail: '#151a20',
      accent: '#84b135',
      ventStyle: 'slots',
    }),
  },
  {
    match: ['mikrotik'],
    style: preset('mikrotik', {
      body: '#d6d9dd',
      face: '#e8eaed',
      detail: '#aeb3ba',
      accent: '#d6001c',
      finish: 'plastic',
      metalness: 0.25,
      roughness: 0.55,
      cornerRadiusMm: 2,
      ventStyle: 'grille',
      badgeInk: 'rgba(24,28,34,0.75)',
      labelInk: 'rgba(24,28,34,0.42)',
    }),
  },
  {
    match: ['tp-link', 'tplink'],
    style: preset('tp-link', {
      body: '#1f2226',
      face: '#282b30',
      detail: '#121417',
      accent: '#4acbd6',
      ventStyle: 'grille',
      cornerRadiusMm: 3,
    }),
  },
  {
    match: ['netgear'],
    style: preset('netgear', {
      body: '#25282d',
      face: '#2f3339',
      detail: '#16181c',
      accent: '#f5a623',
      ventStyle: 'slots',
      cornerRadiusMm: 2,
    }),
  },
  {
    match: ['synology'],
    style: preset('synology', {
      body: '#191b1e',
      face: '#222429',
      detail: '#0e1012',
      accent: '#0086e5',
      finish: 'plastic',
      metalness: 0.3,
      roughness: 0.58,
      ventStyle: 'grille',
      cornerRadiusMm: 3,
    }),
  },
  {
    match: ['supermicro'],
    style: preset('supermicro', {
      body: '#565b62',
      face: '#666c74',
      detail: '#3a3f45',
      accent: '#2a6fb4',
      finish: 'brushed',
      metalness: 0.8,
      roughness: 0.38,
      cornerRadiusMm: 1,
      ventStyle: 'holes',
    }),
  },
  {
    match: ['apc', 'schneider'],
    style: preset('apc', {
      body: '#17181b',
      face: '#212327',
      detail: '#0c0d0f',
      accent: '#7db343',
      ventStyle: 'slots',
      cornerRadiusMm: 2.5,
    }),
  },
];

const GENERIC_DARK = preset('generic-dark');
const GENERIC_METAL = preset('generic-metal', {
  body: '#4c5158',
  face: '#5b6067',
  detail: '#2c3036',
  finish: 'brushed',
  metalness: 0.78,
  roughness: 0.4,
  ventStyle: 'holes',
});

/**
 * Resolves the style for a device: manufacturer preset first, otherwise
 * a generic preset chosen by the definition's presentation tone.
 */
export function styleFor(
  manufacturer: string,
  tone: 'dark' | 'metal',
): StylePreset {
  const key = manufacturer.toLowerCase();
  for (const { match, style } of PRESETS) {
    if (match.some((m) => key.includes(m))) return style;
  }
  return tone === 'metal' ? GENERIC_METAL : GENERIC_DARK;
}
