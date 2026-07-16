import { Box3, Matrix4, Mesh, type Object3D } from 'three';
import { create } from 'zustand';
import { resolvePhysicalPorts, type PhysicalPort } from './physicalPorts';
import type { DeviceDefinition, ModelTransform } from '../deviceSchema';

/**
 * Connector calibration: when a GLB models its connectors, the real mesh
 * geometry — not evenly spaced metadata — decides where every physical
 * port lives. The pipeline inspects the imported model once, detects
 * connector meshes (individual cages and multi-port bank strips), aligns
 * the metadata port groups onto that geometry class-by-class, and caches
 * the result per definition. Metadata remains the fallback whenever a
 * model has no detectable connector geometry (e.g. single-mesh GLBs).
 *
 * Everything here is deterministic and data-driven — no per-device code.
 */

export interface MeshBoundsMm {
  name: string;
  centerMm: [number, number, number];
  sizeMm: [number, number, number];
}

export type ConnectorClass = 'copper' | 'sfp' | 'other';

export interface DetectedConnector {
  kind: 'single' | 'strip';
  class: ConnectorClass;
  location: 'front' | 'rear';
  centerMm: [number, number, number];
  sizeMm: [number, number, number];
  /** Z of the visible opening face (panel surface). */
  faceZMm: number;
}

export interface CalibratedPort {
  positionMm: [number, number, number];
  widthMm: number;
  heightMm: number;
}

/* ---- stage 1: measure every mesh in device-local space -------------- */

/**
 * Per-mesh AABBs of the raw model, lifted through the resolved import
 * transform into canonical device-local millimeters.
 */
export function meshBoundsLocal(
  model: Object3D,
  transform: ModelTransform,
): MeshBoundsMm[] {
  model.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(model.matrixWorld).invert();
  const relative = new Matrix4();

  const scale =
    typeof transform.scale === 'number'
      ? [transform.scale, transform.scale, transform.scale]
      : transform.scale;
  const yawQuarter =
    Math.round(((transform.rotationDeg[1] % 360) + 360) / 90) % 4;

  const results: MeshBoundsMm[] = [];
  model.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.computeBoundingBox();
    const box = node.geometry.boundingBox;
    if (!box) return;
    relative.multiplyMatrices(toLocal, node.matrixWorld);
    const b = new Box3().copy(box).applyMatrix4(relative);

    // Apply the import transform (scale, quarter-turn yaw, offset).
    let min: number[] = [b.min.x * scale[0], b.min.y * scale[1], b.min.z * scale[2]];
    let max: number[] = [b.max.x * scale[0], b.max.y * scale[1], b.max.z * scale[2]];
    for (let q = 0; q < yawQuarter; q++) {
      // yaw -90 per step maps (x, z) -> (-z, x); re-sort the box.
      const nextMin = [
        Math.min(-min[2], -max[2]),
        min[1],
        Math.min(min[0], max[0]),
      ];
      const nextMax = [
        Math.max(-min[2], -max[2]),
        max[1],
        Math.max(min[0], max[0]),
      ];
      min = nextMin;
      max = nextMax;
    }
    const toMm = 1000;
    results.push({
      name: node.name,
      centerMm: [
        ((min[0] + max[0]) / 2) * toMm + transform.offsetMm[0],
        ((min[1] + max[1]) / 2) * toMm + transform.offsetMm[1],
        ((min[2] + max[2]) / 2) * toMm + transform.offsetMm[2],
      ],
      sizeMm: [
        (max[0] - min[0]) * toMm,
        (max[1] - min[1]) * toMm,
        (max[2] - min[2]) * toMm,
      ],
    });
  });
  return results;
}

/* ---- stage 2: detect connector geometry (pure) ----------------------- */

/** How close to the panel face a connector mesh must reach, mm. */
const FACE_TOLERANCE_MM = 20;

const isSfpSized = (w: number, h: number): boolean =>
  w >= 10 && w <= 26 && h >= 6 && h <= 14;
const isCopperSized = (w: number, h: number): boolean =>
  w >= 10 && w <= 22 && h >= 8 && h <= 20;
const isStripSized = (w: number, h: number): boolean =>
  w > 40 && h >= 6 && h <= 22;

/**
 * Finds connector-shaped meshes near the front/rear panel faces:
 * individual cages (SFP/RJ45-sized) and multi-port bank strips. Vents,
 * chassis shells and full-width panels are excluded by shape.
 */
export function detectConnectors(
  bounds: readonly MeshBoundsMm[],
  dims: Pick<DeviceDefinition, 'widthMm' | 'heightMm' | 'depthMm'>,
): DetectedConnector[] {
  const halfDepth = dims.depthMm / 2;
  const detected: DetectedConnector[] = [];

  for (const mesh of bounds) {
    const [w, h, d] = mesh.sizeMm;
    const [, , cz] = mesh.centerMm;
    const zFront = cz + d / 2;
    const zRear = cz - d / 2;

    let location: 'front' | 'rear' | null = null;
    let faceZ = 0;
    if (Math.abs(zFront - halfDepth) <= FACE_TOLERANCE_MM) {
      location = 'front';
      faceZ = zFront;
    } else if (Math.abs(zRear + halfDepth) <= FACE_TOLERANCE_MM) {
      location = 'rear';
      faceZ = zRear;
    }
    if (!location) continue;
    // Chassis shells: nearly device-wide AND device-tall.
    if (w > dims.widthMm * 0.95 && h > dims.heightMm * 0.7) continue;

    if (isStripSized(w, h)) {
      detected.push({
        kind: 'strip',
        class: 'copper',
        location,
        centerMm: mesh.centerMm,
        sizeMm: mesh.sizeMm,
        faceZMm: faceZ,
      });
    } else if (isSfpSized(w, h) && d > 20) {
      // SFP cages run deep into the chassis.
      detected.push({
        kind: 'single',
        class: 'sfp',
        location,
        centerMm: mesh.centerMm,
        sizeMm: mesh.sizeMm,
        faceZMm: faceZ,
      });
    } else if (isCopperSized(w, h)) {
      detected.push({
        kind: 'single',
        class: 'copper',
        location,
        centerMm: mesh.centerMm,
        sizeMm: mesh.sizeMm,
        faceZMm: faceZ,
      });
    }
  }

  // Bank strips often stack several meshes per bank (plastic body, pin
  // block, back plate) — merge strips whose x-centers nearly coincide.
  const strips = detected.filter((c) => c.kind === 'strip');
  const merged: DetectedConnector[] = detected.filter((c) => c.kind !== 'strip');
  const used = new Set<DetectedConnector>();
  for (const strip of strips) {
    if (used.has(strip)) continue;
    const cluster = strips.filter(
      (other) =>
        !used.has(other) &&
        other.location === strip.location &&
        Math.abs(other.centerMm[0] - strip.centerMm[0]) < 10,
    );
    cluster.forEach((c) => used.add(c));
    // The widest member is the visible plastic bank.
    const widest = cluster.reduce((a, b) => (b.sizeMm[0] > a.sizeMm[0] ? b : a));
    merged.push(widest);
  }
  return merged;
}

const portClass = (port: PhysicalPort): ConnectorClass =>
  port.type === 'rj45' || port.type === 'keystone' || port.type === 'poe-in' || port.type === 'console'
    ? 'copper'
    : port.type.startsWith('sfp') || port.type.startsWith('qsfp')
      ? 'sfp'
      : 'other';

/* ---- stage 3: align metadata ports onto detected geometry ------------ */

/**
 * Distributes the metadata ports of each connector class across the
 * detected geometry of that class (per panel face):
 *
 * - single connectors map 1:1 in x-order;
 * - bank strips receive ports proportionally to their width, evenly
 *   spaced inside the strip.
 *
 * Calibration only applies when the detected capacity exactly matches
 * the metadata count — anything else falls back to metadata untouched.
 */
export function calibratePorts(
  definition: DeviceDefinition,
  detected: readonly DetectedConnector[],
): Map<string, CalibratedPort> {
  const result = new Map<string, CalibratedPort>();
  const ports = resolvePhysicalPorts(definition);

  for (const location of ['front', 'rear'] as const) {
    for (const cls of ['copper', 'sfp'] as const) {
      const classPorts = ports
        .filter((p) => p.location === location && portClass(p) === cls)
        .sort((a, b) =>
          a.positionMm[1] !== b.positionMm[1]
            ? b.positionMm[1] - a.positionMm[1]
            : a.positionMm[0] - b.positionMm[0],
        );
      if (classPorts.length === 0) continue;

      const geo = detected
        .filter((c) => c.location === location && c.class === cls)
        .sort((a, b) => a.centerMm[0] - b.centerMm[0]);
      if (geo.length === 0) continue;

      const singles = geo.filter((g) => g.kind === 'single');
      const strips = geo.filter((g) => g.kind === 'strip');
      const stripWidth = strips.reduce((sum, s) => sum + s.sizeMm[0], 0);
      const stripPortCount = classPorts.length - singles.length;

      // Capacity must match exactly; otherwise leave metadata alone.
      if (stripPortCount < 0) continue;
      if (strips.length === 0 && singles.length !== classPorts.length) continue;
      if (strips.length > 0 && stripPortCount === 0) continue;

      // Slots per strip, proportional to width; counts must total AND
      // the implied pitch must be physically plausible for the class —
      // otherwise the detected geometry cannot hold these ports.
      const minPitch = cls === 'copper' ? 11 : 12;
      const slots = strips.map((s) =>
        Math.round((stripPortCount * s.sizeMm[0]) / stripWidth),
      );
      if (strips.length > 0) {
        if (slots.reduce((a, b) => a + b, 0) !== stripPortCount) continue;
        const pitchOk = strips.every(
          (s, i) => slots[i] > 0 && s.sizeMm[0] / slots[i] >= minPitch,
        );
        if (!pitchOk) continue;
      }

      // Build the calibrated positions in x-order across the geometry.
      const positions: CalibratedPort[] = [];
      for (const g of geo) {
        if (g.kind === 'single') {
          positions.push({
            positionMm: [g.centerMm[0], g.centerMm[1], g.faceZMm],
            widthMm: g.sizeMm[0],
            heightMm: g.sizeMm[1],
          });
        } else {
          const count = slots[strips.indexOf(g)];
          const pitch = g.sizeMm[0] / count;
          for (let i = 0; i < count; i++) {
            positions.push({
              positionMm: [
                g.centerMm[0] - g.sizeMm[0] / 2 + (i + 0.5) * pitch,
                g.centerMm[1],
                g.faceZMm,
              ],
              widthMm: pitch * 0.86,
              heightMm: g.sizeMm[1],
            });
          }
        }
      }
      if (positions.length !== classPorts.length) continue;

      classPorts.forEach((port, i) => result.set(port.ref, positions[i]));
    }
  }
  return result;
}

/* ---- cache + reactivity ---------------------------------------------- */

const cache = new Map<string, Map<string, CalibratedPort>>();

interface CalibrationState {
  version: number;
  bump: () => void;
}
/** Bumped when a model finishes calibrating, so layers re-derive. */
export const useCalibrationStore = create<CalibrationState>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/**
 * Runs detection + alignment for a loaded model, once per definition.
 * Called by the model loader after the import transform is resolved.
 */
export function calibrateFromModel(
  definition: DeviceDefinition,
  model: Object3D,
  transform: ModelTransform,
): void {
  if (cache.has(definition.id)) return;
  const bounds = meshBoundsLocal(model, transform);
  const detected = detectConnectors(bounds, definition);
  const calibrated = calibratePorts(definition, detected);
  cache.set(definition.id, calibrated);
  if (calibrated.size > 0) useCalibrationStore.getState().bump();
}

/** Calibrated position/size for a port ref, or null (metadata rules). */
export const calibratedPort = (
  definitionId: string,
  ref: string,
): CalibratedPort | null => cache.get(definitionId)?.get(ref) ?? null;

/** Test hook: seed or clear the cache directly. */
export function primeCalibration(
  definitionId: string,
  ports: Map<string, CalibratedPort> | null,
): void {
  if (ports === null) cache.delete(definitionId);
  else cache.set(definitionId, ports);
}
