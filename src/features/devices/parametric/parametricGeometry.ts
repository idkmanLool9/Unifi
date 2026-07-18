import { ExtrudeGeometry, Path, Shape } from 'three';
import type { RectMm } from './chassisSpec';
import type { VentStyle } from './stylePresets';

/**
 * Pure layout math + cached geometries for the parametric renderer.
 * Vent fields and mounting ears are the two elements whose geometry is
 * data-dependent; everything else renders from shared unit primitives.
 */

/* ---- vent instance layout (pure, tested) ------------------------------ */

export interface VentLayout {
  /** Instance centers relative to the region center, mm. */
  offsets: Array<[number, number]>;
  /** One instance's size, mm. */
  slotWMm: number;
  slotHMm: number;
  /** Round instances (holes) vs bars (slots/grille). */
  round: boolean;
}

/** Hard cap per region — pitch grows instead of instance count. */
const MAX_INSTANCES = 360;

/**
 * Fills a rect with vent instances for the given style. Deterministic
 * and bounded: large regions increase pitch rather than instance count.
 */
export function ventLayout(region: RectMm, style: VentStyle): VentLayout {
  const { wMm, hMm } = region;

  if (style === 'slots') {
    // Vertical slats across the width.
    const slotW = 2.2;
    const slotH = Math.max(4, hMm - 6);
    let pitch = 6.5;
    let count = Math.max(1, Math.floor(wMm / pitch));
    if (count > MAX_INSTANCES) {
      pitch = wMm / MAX_INSTANCES;
      count = MAX_INSTANCES;
    }
    const span = (count - 1) * pitch;
    return {
      offsets: Array.from({ length: count }, (_, i) => [
        -span / 2 + i * pitch,
        0,
      ]),
      slotWMm: slotW,
      slotHMm: slotH,
      round: false,
    };
  }

  if (style === 'grille') {
    // Horizontal bars down the height.
    const slotH = 1.8;
    const slotW = Math.max(6, wMm - 4);
    let pitch = 5.5;
    let count = Math.max(1, Math.floor(hMm / pitch));
    if (count > MAX_INSTANCES) {
      pitch = hMm / MAX_INSTANCES;
      count = MAX_INSTANCES;
    }
    const span = (count - 1) * pitch;
    return {
      offsets: Array.from({ length: count }, (_, i) => [
        0,
        -span / 2 + i * pitch,
      ]),
      slotWMm: slotW,
      slotHMm: slotH,
      round: false,
    };
  }

  // holes / hex: a grid of circular perforations; hex offsets odd rows.
  const d = style === 'hex' ? 4.2 : 3.2;
  let pitch = style === 'hex' ? 5.4 : 6;
  let cols = Math.max(1, Math.floor(wMm / pitch));
  let rows = Math.max(1, Math.floor(hMm / pitch));
  while (cols * rows > MAX_INSTANCES) {
    pitch *= 1.3;
    cols = Math.max(1, Math.floor(wMm / pitch));
    rows = Math.max(1, Math.floor(hMm / pitch));
  }
  const spanX = (cols - 1) * pitch;
  const spanY = (rows - 1) * pitch;
  const offsets: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    const stagger = style === 'hex' && r % 2 === 1 ? pitch / 2 : 0;
    for (let c = 0; c < cols; c++) {
      const x = -spanX / 2 + c * pitch + stagger;
      if (Math.abs(x) > wMm / 2 - d / 2) continue;
      offsets.push([x, -spanY / 2 + r * pitch]);
    }
  }
  return { offsets, slotWMm: d, slotHMm: d, round: true };
}

/* ---- mounting ear geometry (cached) ----------------------------------- */

/** EIA-310 hole: 6.35 mm square holes at 15.875/15.875/12.7 mm rhythm. */
const HOLE_D_MM = 6.2;
const U_MM = 44.45;
const HOLE_OFFSETS_IN_U = [6.35, 22.225, 38.1];

const earCache = new Map<string, ExtrudeGeometry>();
const skirtCache = new Map<string, ExtrudeGeometry>();

/**
 * Cantilever-shelf side skirt: a vertical plate that is the full unit
 * height at the front (where the bending moment lives) and tapers to a
 * thin edge at the rear. Built in shape space with x = distance behind
 * the front edge and y = height; extruded 2.2 mm along z (the plate
 * thickness — world X after the renderer's 90° yaw).
 */
export function skirtGeometry(
  heightMm: number,
  depthMm: number,
): ExtrudeGeometry {
  const key = `${heightMm}|${depthMm}`;
  const cached = skirtCache.get(key);
  if (cached) return cached;

  const MM = 0.001;
  const top = (heightMm / 2 - 4) * MM;
  const bottom = (-heightMm / 2) * MM;
  const run = depthMm * 0.92 * MM;
  const tail = 8 * MM;
  const shape = new Shape();
  shape.moveTo(0, top);
  shape.lineTo(0, bottom);
  shape.lineTo(24 * MM, bottom);
  shape.lineTo(run, top - tail);
  shape.lineTo(run, top);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: 2.2 * MM,
    bevelEnabled: false,
  });
  skirtCache.set(key, geometry);
  return geometry;
}

/**
 * One mounting ear as an extruded plate with real punched holes, built
 * in meters (width × height × thickness), origin at the plate center.
 * Cached per (width, height, holeCount) — both ears and every instance
 * of the same chassis share one geometry.
 */
export function earGeometry(
  widthMm: number,
  heightMm: number,
  units: number,
): ExtrudeGeometry {
  const key = `${widthMm}|${heightMm}|${units}`;
  const cached = earCache.get(key);
  if (cached) return cached;

  const MM = 0.001;
  const w = widthMm * MM;
  const h = heightMm * MM;
  const shape = new Shape();
  const r = 1.5 * MM;
  // Rounded-corner plate outline.
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  // Punched mounting holes on the EIA rhythm, clipped to the plate.
  const radius = (HOLE_D_MM / 2) * MM;
  for (let u = 0; u < units; u++) {
    for (const offset of HOLE_OFFSETS_IN_U) {
      const y = (-(units * U_MM) / 2 + u * U_MM + offset) * MM;
      if (Math.abs(y) > h / 2 - radius - 1 * MM) continue;
      const hole = new Path();
      hole.absarc(0, y, radius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }

  const geometry = new ExtrudeGeometry(shape, {
    depth: 2.2 * MM,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -1.1 * MM);
  earCache.set(key, geometry);
  return geometry;
}
