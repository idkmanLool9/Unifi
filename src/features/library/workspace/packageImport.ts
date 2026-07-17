import {
  validateDeviceDefinition,
  type DeviceCategory,
  type DeviceDefinition,
} from '@/features/devices/deviceSchema';

/**
 * The library's import pipeline. Accepts GLB and single-file GLTF
 * natively; OBJ and FBX are parsed with three's loaders and re-encoded
 * to GLB in the browser, so every import flows through the exact same
 * rendering pipeline afterwards. ZIP packages (metadata.json +
 * model.glb) restore a full device including its authored metadata.
 * No servers, no placeholders — the file lands ready for authoring.
 */

export interface DraftFields {
  name: string;
  manufacturerName: string;
  category: DeviceCategory;
  rackUnits: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export interface ImportedDevice {
  definition: DeviceDefinition;
  /** GLB payload to persist (null when the package had metadata only). */
  modelBlob: Blob | null;
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'device';

/** Builds a validated draft definition for a freshly imported model. */
export function buildDraftDefinition(draft: DraftFields): DeviceDefinition {
  const slug = slugify(draft.name);
  const raw = {
    id: `custom-${slug}`,
    slug,
    manufacturer: 'custom',
    manufacturerName: draft.manufacturerName || 'Custom',
    productName: draft.name,
    modelNumber: draft.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 24),
    category: draft.category,
    rackUnits: draft.rackUnits,
    widthMm: draft.widthMm,
    heightMm: draft.heightMm,
    depthMm: draft.depthMm,
    weightKg: 3,
    mountingStandard: 'eia-310',
    defaultFacing: 'front',
    powerConsumptionWatts: 0,
    maximumPowerWatts: 0,
    tags: ['imported'],
    description: `Imported device (${draft.manufacturerName || 'custom'}).`,
    ports: [],
    presentation: {
      faceplate: 'network',
      tone: 'dark',
      portsLabel: '—',
    },
  };
  const parsed = validateDeviceDefinition(raw);
  if (!parsed.ok) {
    throw new Error(
      `Draft definition invalid: ${parsed.issues.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
    );
  }
  return parsed.value;
}

/** Re-encodes a parsed three scene into a binary GLB blob. */
async function sceneToGlb(object: import('three').Object3D): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, { binary: true });
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('GLB export failed — unexpected exporter output.');
  }
  return new Blob([result], { type: 'model/gltf-binary' });
}

async function importObj(file: File): Promise<Blob> {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
  const text = await file.text();
  const group = new OBJLoader().parse(text);
  if (group.children.length === 0) {
    throw new Error('The OBJ file contains no geometry.');
  }
  return sceneToGlb(group);
}

async function importFbx(file: File): Promise<Blob> {
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const buffer = await file.arrayBuffer();
  const group = new FBXLoader().parse(buffer, '');
  if (group.children.length === 0) {
    throw new Error('The FBX file contains no geometry.');
  }
  return sceneToGlb(group);
}

async function importGltfJson(file: File): Promise<Blob> {
  const text = await file.text();
  const json = JSON.parse(text) as {
    buffers?: Array<{ uri?: string }>;
    images?: Array<{ uri?: string }>;
  };
  const external = [
    ...(json.buffers ?? []),
    ...(json.images ?? []),
  ].some((b) => b.uri !== undefined && !b.uri.startsWith('data:'));
  if (external) {
    throw new Error(
      'This .gltf references external files. Export as a single .glb (or embedded .gltf) and import that.',
    );
  }
  return new Blob([text], { type: 'model/gltf+json' });
}

/* ---- minimal ZIP reader (STORE + DEFLATE via DecompressionStream) ----- */

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Parses a ZIP archive using the end-of-central-directory records. */
export async function readZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Locate End Of Central Directory (scan backwards for its signature).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP archive.');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );

    // Local header: skip its (possibly different) name/extra lengths.
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localName + localExtra;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    if (!name.endsWith('/')) {
      let data: Uint8Array;
      if (method === 0) {
        data = compressed.slice();
      } else if (method === 8) {
        const stream = new Response(
          new Blob([compressed.slice()]).stream().pipeThrough(
            new DecompressionStream('deflate-raw'),
          ),
        );
        data = new Uint8Array(await stream.arrayBuffer());
      } else {
        throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
      }
      entries.push({ name, data });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function importZip(
  file: File,
  draft: DraftFields,
): Promise<ImportedDevice> {
  const entries = await readZip(await file.arrayBuffer());
  const metadataEntry = entries.find((e) =>
    e.name.toLowerCase().endsWith('metadata.json'),
  );
  const modelEntry = entries.find((e) => e.name.toLowerCase().endsWith('.glb'));

  let definition: DeviceDefinition;
  if (metadataEntry) {
    const parsed = validateDeviceDefinition(
      JSON.parse(new TextDecoder().decode(metadataEntry.data)),
    );
    if (!parsed.ok) {
      throw new Error(
        `Package metadata invalid: ${parsed.issues
          .slice(0, 3)
          .map((e) => `${e.path}: ${e.message}`)
          .join('; ')}`,
      );
    }
    definition = parsed.value;
  } else if (modelEntry) {
    definition = buildDraftDefinition(draft);
  } else {
    throw new Error('The ZIP contains neither metadata.json nor a .glb model.');
  }

  return {
    definition,
    modelBlob: modelEntry
      ? new Blob([modelEntry.data.slice()], { type: 'model/gltf-binary' })
      : null,
  };
}

/** Imports any supported file into a definition + optional model blob. */
export async function importDeviceFile(
  file: File,
  draft: DraftFields,
): Promise<ImportedDevice> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'glb':
      return { definition: buildDraftDefinition(draft), modelBlob: file };
    case 'gltf':
      return {
        definition: buildDraftDefinition(draft),
        modelBlob: await importGltfJson(file),
      };
    case 'obj':
      return {
        definition: buildDraftDefinition(draft),
        modelBlob: await importObj(file),
      };
    case 'fbx':
      return {
        definition: buildDraftDefinition(draft),
        modelBlob: await importFbx(file),
      };
    case 'zip':
      return importZip(file, draft);
    default:
      throw new Error(
        `Unsupported file type ".${ext}" — import GLB, GLTF, OBJ, FBX or a ZIP package.`,
      );
  }
}
