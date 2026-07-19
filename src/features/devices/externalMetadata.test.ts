import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDeviceDefinition } from './deviceSchema';
import { resolvePhysicalPorts } from './hardware/physicalPorts';

/**
 * Every metadata.json shipped in public/devices must validate — a bad
 * drop-in would silently fall back to the built-in definition at
 * runtime, which is exactly the kind of failure that hides.
 */

const manifest = JSON.parse(
  readFileSync('public/devices/manifest.json', 'utf8'),
) as { devices: string[] };

describe('shipped external device metadata', () => {
  for (const entry of manifest.devices) {
    it(`${entry} validates and resolves`, () => {
      const raw = JSON.parse(
        readFileSync(`public/devices/${entry}/metadata.json`, 'utf8'),
      );
      const result = validateDeviceDefinition(raw);
      if (!result.ok) console.error(entry, result.issues);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Port resolution must not throw; portless management panels (brush,
      // blank) legitimately resolve to zero ports.
      expect(Array.isArray(resolvePhysicalPorts(result.value))).toBe(true);
    });
  }

  it('pro-max carries the hand-authored single-row port layout', () => {
    const raw = JSON.parse(
      readFileSync(
        'public/devices/ubiquiti/pro-max-24-poe/metadata.json',
        'utf8',
      ),
    );
    const result = validateDeviceDefinition(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Authored metadata is ground truth: calibration must stay off.
    expect(result.value.portsAuthored).toBe(true);
    const ports = resolvePhysicalPorts(result.value);
    // 24 RJ45 + 2 SFP+ on the front, plus the rear C13 power inlet.
    expect(ports.length).toBe(27);
    expect(ports.filter((p) => p.type === 'rj45').length).toBe(24);
    expect(ports.filter((p) => p.type === 'sfp+').length).toBe(2);
    expect(ports.filter((p) => p.type === 'c13').length).toBe(1);
    // Single row: every copper port shares the authored y and sits on the
    // front face (~163.5, within hand-authoring tolerance).
    for (const port of ports.filter((p) => p.type === 'rj45')) {
      expect(port.positionMm[1]).toBe(-6);
      expect(Math.abs(port.positionMm[2] - 163.5)).toBeLessThanOrEqual(0.5);
      expect(port.sizeMm).toEqual([14.46, 12.75]);
    }
  });
});
