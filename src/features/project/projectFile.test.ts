import { describe, expect, it } from 'vitest';
import {
  base64ToBlob,
  blobToBase64,
  parseProjectFile,
  projectFileName,
  summarizeProject,
  PROJECT_FORMAT,
  type ProjectFile,
} from './projectFile';

const validFile = (over: Partial<ProjectFile> = {}): string =>
  JSON.stringify({
    format: PROJECT_FORMAT,
    exportedAt: '2026-07-17T00:00:00.000Z',
    stores: {
      'rackforge-rack': {
        state: { rack: { name: 'Studio Rack', units: 12 } },
        version: 0,
      },
      'rackforge-devices': {
        state: { instances: [{ id: 'i1' }, { id: 'i2' }] },
        version: 0,
      },
      'rackforge-cables': {
        state: { cables: [{ id: 'c1' }], bundles: [] },
        version: 0,
      },
      'rackforge-authored-devices': {
        state: { definitions: { 'dev-a': {}, 'dev-b': {} } },
        version: 0,
      },
    },
    models: [],
    ...over,
  });

describe('project file format', () => {
  it('round-trips binary model data through base64', async () => {
    const bytes = new Uint8Array(300).map((_, i) => (i * 7) % 256);
    const base64 = await blobToBase64(
      new Blob([bytes], { type: 'model/gltf-binary' }),
    );
    const back = base64ToBlob(base64, 'model/gltf-binary');
    expect(back.type).toBe('model/gltf-binary');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  });

  it('parses a valid project file', () => {
    const parsed = parseProjectFile(validFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.format).toBe(PROJECT_FORMAT);
    expect(Object.keys(parsed.value.stores)).toContain('rackforge-rack');
    expect(parsed.value.models).toEqual([]);
  });

  it('tolerates a missing models array (metadata-only projects)', () => {
    const raw = JSON.parse(validFile()) as Record<string, unknown>;
    delete raw.models;
    const parsed = parseProjectFile(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.models).toEqual([]);
  });

  it('rejects non-JSON, foreign formats and corrupt payloads', () => {
    expect(parseProjectFile('not json').ok).toBe(false);
    expect(parseProjectFile('42').ok).toBe(false);
    expect(
      parseProjectFile(JSON.stringify({ format: 'other@1', stores: {} })).ok,
    ).toBe(false);
    expect(
      parseProjectFile(JSON.stringify({ format: PROJECT_FORMAT })).ok,
    ).toBe(false);
    expect(
      parseProjectFile(
        JSON.stringify({
          format: PROJECT_FORMAT,
          stores: {},
          models: [{ deviceId: 42, base64: 'x' }],
        }),
      ).ok,
    ).toBe(false);
  });

  it('summarizes the workspace the file would restore', () => {
    const parsed = parseProjectFile(
      validFile({
        models: [{ deviceId: 'dev-a', type: 'model/gltf-binary', base64: '' }],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const summary = summarizeProject(parsed.value);
    expect(summary.rackName).toBe('Studio Rack');
    expect(summary.deviceCount).toBe(2);
    expect(summary.cableCount).toBe(1);
    expect(summary.authoredCount).toBe(2);
    expect(summary.modelCount).toBe(1);
  });

  it('derives a safe download filename from the project name', () => {
    expect(projectFileName('Studio Rack #2')).toBe(
      'studio-rack-2.rackforge-project.json',
    );
    expect(projectFileName('   ')).toBe(
      'rackforge-project.rackforge-project.json',
    );
  });
});
