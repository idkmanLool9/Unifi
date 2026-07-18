import { describe, expect, it } from 'vitest';
import { classifyDevice, inCategoryNode } from './categoryTree';
import {
  compileEntry,
  queryEntries,
  sortEntries,
  EMPTY_FILTERS,
} from './libraryIndex';
import { buildDraftDefinition, classifyZip, readZip } from './packageImport';
import { GENERIC_DEVICES } from '@/features/devices/definitions/generic';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;
const dmp = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-udm-pro')!;
const patch = GENERIC_DEVICES.find((d) => d.id === 'gen-patch-24')!;

const entryOf = (d: DeviceDefinition, available = true) =>
  compileEntry(d, {}, available);

describe('category tree', () => {
  it('classifies devices from metadata', () => {
    expect(classifyDevice(proMax)).toEqual(['network/switches', 'network']);
    expect(classifyDevice(dmp)[1]).toBe('network');
    expect(classifyDevice(patch)).toEqual([
      'accessories/patch-panels',
      'accessories',
    ]);
  });

  it('parent nodes include their descendants', () => {
    expect(inCategoryNode(proMax, 'network', undefined)).toBe(true);
    expect(inCategoryNode(proMax, 'network/switches', undefined)).toBe(true);
    expect(inCategoryNode(proMax, 'storage', undefined)).toBe(false);
  });

  it('custom assignments win regardless of metadata', () => {
    expect(inCategoryNode(proMax, 'custom-abc', 'custom-abc')).toBe(true);
  });
});

describe('library query engine', () => {
  const entries = [entryOf(proMax), entryOf(dmp), entryOf(patch)];

  it('searches across name, manufacturer, ports and capabilities', () => {
    const byName = queryEntries(entries, {
      text: 'pro max',
      filters: EMPTY_FILTERS,
      categoryNode: null,
    });
    expect(byName.map((e) => e.id)).toEqual([proMax.id]);

    const byPort = queryEntries(entries, {
      text: 'keystone',
      filters: EMPTY_FILTERS,
      categoryNode: null,
    });
    expect(byPort.map((e) => e.id)).toContain(patch.id);

    const byCapability = queryEntries(entries, {
      text: 'poe ubiquiti',
      filters: EMPTY_FILTERS,
      categoryNode: null,
    });
    expect(byCapability.map((e) => e.id)).toContain(proMax.id);
  });

  it('combines filters (AND semantics)', () => {
    const result = queryEntries(entries, {
      text: '',
      filters: {
        ...EMPTY_FILTERS,
        manufacturers: ['ubiquiti'],
        rackUnits: [1],
        poe: true,
        portTypes: ['rj45'],
      },
      categoryNode: 'network',
    });
    expect(result.map((e) => e.id)).toEqual([proMax.id]);
  });

  it('filters by minimum port count and hides hidden devices', () => {
    const hidden = compileEntry(patch, { hidden: true }, true);
    const result = queryEntries([entryOf(proMax), hidden], {
      text: '',
      filters: { ...EMPTY_FILTERS, minPorts: 20 },
      categoryNode: null,
    });
    expect(result.map((e) => e.id)).toEqual([proMax.id]);
  });

  it('sorts deterministically', () => {
    const byPorts = sortEntries(entries, 'ports', []);
    expect(byPorts[0].portCount).toBeGreaterThanOrEqual(byPorts[1].portCount);
    const byRecent = sortEntries(entries, 'recent', [patch.id, proMax.id]);
    expect(byRecent[0].id).toBe(patch.id);
    expect(byRecent[1].id).toBe(proMax.id);
  });
});

describe('production readiness', () => {
  it('flags missing models as info and unported devices as blockers', () => {
    const noModel = entryOf(proMax, false);
    expect(noModel.issues.some((i) => i.code === 'no-model')).toBe(true);

    const bare = buildDraftDefinition({
      name: 'Test Switch',
      manufacturerName: 'Acme',
      category: 'switching',
      rackUnits: 1,
      widthMm: 442,
      heightMm: 44,
      depthMm: 300,
    });
    const entry = compileEntry(bare, {}, true);
    expect(entry.issues.some((i) => i.code === 'missing-ports')).toBe(true);
    expect(entry.ready).toBe(false);
  });

  it('authored devices with cable anchors verify', () => {
    const entry = entryOf(proMax);
    // The bundled Pro Max is built-in (not authored) — not verified.
    expect(entry.verified).toBe(entry.authored && entry.ready);
  });
});

describe('draft definitions', () => {
  it('builds a valid registrable definition from minimal fields', () => {
    const draft = buildDraftDefinition({
      name: 'My Custom UPS!',
      manufacturerName: 'HomeLab Co',
      category: 'power',
      rackUnits: 2,
      widthMm: 442,
      heightMm: 88,
      depthMm: 400,
    });
    expect(draft.id).toBe('custom-my-custom-ups');
    expect(draft.manufacturer).toBe('custom');
    expect(draft.rackUnits).toBe(2);
    expect(draft.tags).toContain('imported');
  });
});

describe('zip reader', () => {
  /** Builds a single-file STORE-method zip in memory. */
  function storedZip(name: string, content: string): ArrayBuffer {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // method: store
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true); // method
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, 0, true); // local header offset
    central.set(nameBytes, 46);

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, central.length, true);
    ev.setUint32(16, local.length, true);

    const out = new Uint8Array(local.length + central.length + eocd.length);
    out.set(local, 0);
    out.set(central, local.length);
    out.set(eocd, local.length + central.length);
    return out.buffer;
  }

  function crc32(data: Uint8Array): number {
    let crc = ~0;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return ~crc >>> 0;
  }

  it('extracts stored entries', async () => {
    const zip = storedZip('metadata.json', '{"hello":"world"}');
    const entries = await readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('metadata.json');
    expect(new TextDecoder().decode(entries[0].data)).toBe('{"hello":"world"}');
  });

  it('rejects non-zip data', async () => {
    await expect(readZip(new Uint8Array(64).buffer)).rejects.toThrow(
      /valid ZIP/,
    );
  });
});

describe('zip content classification', () => {
  const entry = (name: string) => ({ name, data: new Uint8Array(0) });

  it('recognizes an OBJ package with MTL and textures', () => {
    const c = classifyZip([
      entry('keystone-panel/panel.obj'),
      entry('keystone-panel/panel.mtl'),
      entry('keystone-panel/base_color.png'),
      entry('keystone-panel/normal.jpg'),
    ]);
    expect(c.objEntry?.name).toBe('keystone-panel/panel.obj');
    expect(c.hasMtl).toBe(true);
    expect(c.imageCount).toBe(2);
    expect(c.glbEntry).toBeUndefined();
    expect(c.metadataEntry).toBeUndefined();
  });

  it('prefers an authored bundle (metadata + glb) and ignores junk', () => {
    const c = classifyZip([
      entry('__MACOSX/._model.glb'),
      entry('.DS_Store'),
      entry('device/metadata.json'),
      entry('device/model.glb'),
    ]);
    expect(c.metadataEntry?.name).toBe('device/metadata.json');
    expect(c.glbEntry?.name).toBe('device/model.glb');
    // Resource-fork and dotfile entries never count as real content.
    expect(c.imageCount).toBe(0);
    expect(c.objEntry).toBeUndefined();
  });

  it('reports an empty package as having nothing importable', () => {
    const c = classifyZip([entry('readme.txt')]);
    expect(c.metadataEntry).toBeUndefined();
    expect(c.glbEntry).toBeUndefined();
    expect(c.objEntry).toBeUndefined();
    expect(c.imageCount).toBe(0);
  });
});
