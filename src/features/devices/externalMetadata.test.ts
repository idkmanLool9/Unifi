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
    // Single row: every copper port shares one authored y (one row), sits
    // on the front face, and carries a uniform authored size. The exact
    // coordinates come from hand-authoring in the app and change whenever
    // the device is re-authored, so we assert the layout is internally
    // consistent rather than pinning magic numbers (which would let a
    // legitimate re-author break the build and freeze deploys).
    const rj45 = ports.filter((p) => p.type === 'rj45');
    const [first] = rj45;
    expect(first).toBeDefined();
    for (const port of rj45) {
      expect(port.positionMm[1]).toBeCloseTo(first.positionMm[1], 2); // one row
      expect(port.positionMm[2]).toBeGreaterThan(150); // on the front face
      expect(port.positionMm[2]).toBeCloseTo(first.positionMm[2], 2); // coplanar
      expect(port.sizeMm).toEqual(first.sizeMm); // uniform size
    }
  });
});
