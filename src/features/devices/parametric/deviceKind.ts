import type { DeviceDefinition } from '../deviceSchema';

/**
 * Parametric Device Generator — kind inference. Every device resolves to
 * one visual archetype from its existing metadata alone (accessory kind,
 * cable-management kind, category, faceplate style, name and tags). No
 * new schema fields, no device-specific code: the same definition that
 * drives ports, power and placement also decides what the generated
 * chassis looks like.
 */

export const DEVICE_KINDS = [
  'switch',
  'router',
  'gateway',
  'firewall',
  'server',
  'storage',
  'nas',
  'ups',
  'pdu',
  'patch-panel',
  'fiber-panel',
  'blank-panel',
  'brush-panel',
  'shelf',
  'drawer',
  'cable-manager',
  'media-converter',
  'modem',
  'generic',
] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

const textOf = (definition: DeviceDefinition): string =>
  [definition.productName, definition.modelNumber, ...definition.tags]
    .join(' ')
    .toLowerCase();

const isFiberish = (definition: DeviceDefinition): boolean => {
  const text = textOf(definition);
  if (text.includes('fiber') || text.includes('fibre') || text.includes('lc '))
    return true;
  const dataPorts = definition.ports.filter((g) => g.count > 0);
  const fiber = dataPorts.filter((g) => g.type === 'fiber-lc');
  return fiber.length > 0 && fiber.length >= dataPorts.length / 2;
};

/** One archetype per device, derived purely from existing metadata. */
export function inferDeviceKind(definition: DeviceDefinition): DeviceKind {
  // Accessory metadata is authoritative — it already names the hardware.
  switch (definition.accessoryKind) {
    case 'blank-panel':
      return 'blank-panel';
    case 'brush-panel':
      return 'brush-panel';
    case 'patch-panel':
      return isFiberish(definition) ? 'fiber-panel' : 'patch-panel';
    case 'pdu':
      return 'pdu';
    case 'cantilever-shelf':
    case 'fixed-shelf':
      return textOf(definition).includes('drawer') ? 'drawer' : 'shelf';
    case 'cable-manager':
      return 'cable-manager';
    case 'support-bracket':
      return 'generic';
  }
  if (definition.cableManagement) return 'cable-manager';

  const text = textOf(definition);
  if (text.includes('drawer')) return 'drawer';
  if (text.includes('shelf')) return 'shelf';
  if (text.includes('patch panel') || text.includes('keystone')) {
    return isFiberish(definition) ? 'fiber-panel' : 'patch-panel';
  }
  if (text.includes('blank')) return 'blank-panel';
  if (text.includes('firewall')) return 'firewall';
  if (text.includes('media converter')) return 'media-converter';
  if (text.includes('modem')) return 'modem';
  if (text.includes('nas')) return 'nas';
  if (/\bups\b/.test(text) || text.includes('battery backup')) return 'ups';
  if (/\bpdu\b/.test(text) || text.includes('power distribution'))
    return 'pdu';
  if (text.includes('gateway')) return 'gateway';
  if (text.includes('router')) return 'router';

  switch (definition.presentation.faceplate) {
    case 'ups':
      return 'ups';
    case 'pdu':
      return 'pdu';
    case 'storage':
      return text.includes('nas') ? 'nas' : 'storage';
  }

  switch (definition.category) {
    case 'routing':
      return 'router';
    case 'switching':
      return 'switch';
    case 'servers':
      return 'server';
    case 'storage':
      return 'storage';
    case 'power':
      return 'ups';
    default:
      return 'generic';
  }
}

/** Kinds whose generated body is a full enclosed box. */
export const BOX_KINDS: ReadonlySet<DeviceKind> = new Set([
  'switch',
  'router',
  'gateway',
  'firewall',
  'server',
  'storage',
  'nas',
  'ups',
  'pdu',
  'drawer',
  'media-converter',
  'modem',
  'generic',
]);

/** Kinds rendered as a faceplate with a shallow return (no deep body). */
export const PANEL_KINDS: ReadonlySet<DeviceKind> = new Set([
  'patch-panel',
  'fiber-panel',
  'blank-panel',
  'brush-panel',
]);
