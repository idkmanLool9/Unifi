import {
  validateDeviceDefinition,
  type DeviceCategory,
  type DeviceDefinition,
} from '@/features/devices/deviceSchema';

/**
 * The library's import pipeline. Accepts GLB and single-file GLTF
 * natively; OBJ and FBX are parsed with three's loaders and re-encoded
 * to GLB in the browser, so every import flows through the exact same
 * rendering pipeline afterwards. ZIP packages restore a full device
 * from an authored bundle (metadata.json + model.glb) OR carry raw
 * modeling output — an OBJ with its .mtl and texture images — which is
 * assembled and re-encoded to GLB on import. No servers, no
 * placeholders — the file lands ready for authoring.
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

/**
 * Fits an ambiguous-unit model (OBJ/FBX) to the dimensions the user
 * entered, centered at the origin. OBJ/FBX carry no reliable unit —
 * a value of 220 might mean 220 mm, cm or m — so a raw import is
 * routinely 1000× off and lands off-screen. We uniformly scale the
 * model so its largest extent matches the largest draft dimension
 * (preserving the model's real proportions) and re-encode; the GLB then
 * flows through the normal spec-matching pipeline at a sane size, ready
 * for fine adjustment in authoring. Returns a fresh centered+scaled
 * wrapper — the source group is left untouched.
 */
async function fitToDraft(
  group: import('three').Object3D,
  draft: DraftFields,
): Promise<import('three').Object3D> {
  const { Box3, Group, Vector3 } = await import('three');
  const box = new Box3().setFromObject(group);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  // Match sorted extents rank-for-rank so the fit is orientation-blind
  // (we can't know which model axis is width). The binding (smallest)
  // ratio keeps the model's true proportions and fits it inside the
  // draft box on every axis — never gigantic, never distorted. three
  // treats model units as meters; drafts are millimeters.
  const desc = (a: number, b: number) => b - a;
  const modelDims = [size.x, size.y, size.z].sort(desc);
  const draftDims = [draft.widthMm, draft.heightMm, draft.depthMm]
    .map((v) => v / 1000)
    .sort(desc);
  const scale = Math.min(
    draftDims[0] / (modelDims[0] || 1),
    draftDims[1] / (modelDims[1] || 1),
    draftDims[2] / (modelDims[2] || 1),
  );

  group.position.sub(center); // recenter geometry about the origin
  const wrapper = new Group();
  wrapper.add(group);
  wrapper.scale.setScalar(scale);
  return wrapper;
}

async function importObj(file: File, draft: DraftFields): Promise<Blob> {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
  const text = await file.text();
  const group = new OBJLoader().parse(text);
  if (group.children.length === 0) {
    throw new Error('The OBJ file contains no geometry.');
  }
  return sceneToGlb(await fitToDraft(group, draft));
}

const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;
const basename = (path: string): string =>
  (path.split('/').pop() ?? path).toLowerCase();

/**
 * Assembles an OBJ package (OBJ + optional MTL + texture images, all
 * from ZIP entries) into a GLB. Textures are served to three's loaders
 * from in-memory blob URLs via a URL-rewriting LoadingManager, so no
 * network or disk is touched; every image finishes decoding before the
 * scene is exported. Browser-only (uses DOM image decode + canvas).
 */
async function objEntriesToGlb(
  entries: readonly ZipEntry[],
  objEntry: ZipEntry,
  draft: DraftFields,
): Promise<Blob> {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
  const { MTLLoader } = await import('three/examples/jsm/loaders/MTLLoader.js');
  const { LoadingManager } = await import('three');

  // Serve every bundled image by basename from an in-memory blob URL.
  const urls = new Map<string, string>();
  const created: string[] = [];
  for (const entry of entries) {
    if (!IMAGE_RE.test(entry.name)) continue;
    const url = URL.createObjectURL(new Blob([entry.data.slice()]));
    urls.set(basename(entry.name), url);
    created.push(url);
  }

  const manager = new LoadingManager();
  manager.setURLModifier((url) => urls.get(basename(url)) ?? url);
  let started = false;
  manager.onStart = () => {
    started = true;
  };
  const settled = new Promise<void>((resolve) => {
    manager.onLoad = () => resolve();
    // Errors still advance the manager; a missing texture must not abort
    // the whole import, only leave that one map unset.
    manager.onError = () => undefined;
  });

  try {
    const mtlEntry = entries.find((e) => e.name.toLowerCase().endsWith('.mtl'));
    const loader = new OBJLoader(manager);
    if (mtlEntry) {
      const creator = new MTLLoader(manager).parse(
        new TextDecoder().decode(mtlEntry.data),
        '',
      );
      creator.preload();
      loader.setMaterials(creator);
    }

    const group = loader.parse(new TextDecoder().decode(objEntry.data));
    if (group.children.length === 0) {
      throw new Error('The OBJ file in the ZIP contains no geometry.');
    }
    // Wait for every texture to finish decoding before exporting, so the
    // GLB embeds real image data rather than blank maps.
    if (started) await settled;
    return await sceneToGlb(await fitToDraft(group, draft));
  } finally {
    created.forEach(URL.revokeObjectURL);
  }
}

async function importFbx(file: File, draft: DraftFields): Promise<Blob> {
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const buffer = await file.arrayBuffer();
  const group = new FBXLoader().parse(buffer, '');
  if (group.children.length === 0) {
    throw new Error('The FBX file contains no geometry.');
  }
  return sceneToGlb(await fitToDraft(group, draft));
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

/** The recognizable contents of an imported ZIP package. */
export interface ZipContents {
  metadataEntry?: ZipEntry;
  glbEntry?: ZipEntry;
  objEntry?: ZipEntry;
  hasMtl: boolean;
  imageCount: number;
}

/**
 * Classifies a ZIP's entries into the pieces the importer understands.
 * Ignores common junk (macOS __MACOSX resource forks, dotfiles). Pure —
 * no three.js, no DOM — so entry selection is unit-testable.
 */
export function classifyZip(entries: readonly ZipEntry[]): ZipContents {
  const usable = entries.filter((e) => {
    const base = basename(e.name);
    return !e.name.startsWith('__MACOSX/') && !base.startsWith('.');
  });
  const endsWith = (suffix: string) =>
    usable.find((e) => e.name.toLowerCase().endsWith(suffix));
  return {
    metadataEntry: endsWith('metadata.json'),
    glbEntry: endsWith('.glb'),
    objEntry: endsWith('.obj'),
    hasMtl: usable.some((e) => e.name.toLowerCase().endsWith('.mtl')),
    imageCount: usable.filter((e) => IMAGE_RE.test(e.name)).length,
  };
}

async function importZip(
  file: File,
  draft: DraftFields,
): Promise<ImportedDevice> {
  const entries = await readZip(await file.arrayBuffer());
  const { metadataEntry, glbEntry, objEntry } = classifyZip(entries);

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
  } else if (glbEntry || objEntry) {
    definition = buildDraftDefinition(draft);
  } else {
    throw new Error(
      'The ZIP contains no metadata.json, .glb, or .obj — nothing to import.',
    );
  }

  let modelBlob: Blob | null = null;
  if (glbEntry) {
    modelBlob = new Blob([glbEntry.data.slice()], {
      type: 'model/gltf-binary',
    });
  } else if (objEntry) {
    modelBlob = await objEntriesToGlb(entries, objEntry, draft);
  }

  return { definition, modelBlob };
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
        modelBlob: await importObj(file, draft),
      };
    case 'fbx':
      return {
        definition: buildDraftDefinition(draft),
        modelBlob: await importFbx(file, draft),
      };
    case 'zip':
      return importZip(file, draft);
    default:
      throw new Error(
        `Unsupported file type ".${ext}" — import GLB, GLTF, OBJ, FBX or a ZIP package.`,
      );
  }
}
