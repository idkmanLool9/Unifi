import { BOX_KINDS, PANEL_KINDS, inferDeviceKind, type DeviceKind } from './deviceKind';
import { styleFor, type StylePreset, type VentStyle } from './stylePresets';
import {
  resolvePhysicalPorts,
  resolvePowerConnectors,
  CONNECTOR_SIZES,
} from '../hardware/physicalPorts';
import type { DeviceDefinition } from '../deviceSchema';

/**
 * Parametric Device Generator — the chassis spec. buildChassisSpec turns
 * a DeviceDefinition into a declarative description of professional
 * placeholder hardware: panels, ears, vents, bays, PSUs, buttons,
 * handles, badges. Pure math over existing metadata — no three.js — so
 * every layout rule is unit-testable, and swapping in a real GLB later
 * changes nothing about the definition.
 *
 * All values are device-local millimeters (chassis center origin, front
 * face toward +Z), matching ports, cables and the placement engine.
 */

export interface RectMm {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export type PanelFace = 'front' | 'rear' | 'side-left' | 'side-right' | 'top';

export interface VentRegion extends RectMm {
  face: PanelFace;
  style: VentStyle;
}

export interface ChassisSpec {
  kind: DeviceKind;
  style: StylePreset;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** 'box': enclosed chassis. 'panel': faceplate + shallow return.
   *  'open': skeletal accessory (shelf, tray, rings). */
  bodyStyle: 'box' | 'panel' | 'open';
  faceThicknessMm: number;
  /** Body is inset from the faceplate silhouette on every side. */
  bodyInsetMm: number;
  cornerRadiusMm: number;
  /** EIA-310 mounting ears each side of the faceplate. */
  ears: { widthMm: number; holeCount: number } | null;
  /** Screw heads seated in ear holes (installed look). */
  earScrewsMm: Array<[number, number]>;
  vents: VentRegion[];
  badge: { xMm: number; yMm: number; heightMm: number } | null;
  label: { xMm: number; yMm: number; heightMm: number } | null;
  buttons: Array<{
    xMm: number;
    yMm: number;
    diameterMm: number;
    kind: 'power' | 'reset';
  }>;
  /** Vertical pull handles at the faceplate's outer edges. */
  handles: Array<{ xMm: number; heightMm: number }>;
  driveBays: RectMm[];
  /** Rear PSU module frames (drawn around resolved power inlets). */
  psuFramesMm: RectMm[];
  /** Visual outlet strip for PDUs without authored outlet connectors. */
  outletStrip: RectMm | null;
  /** Rubber feet footprints (x, z) for non-rack devices. */
  feetMm: Array<[number, number]>;
  /** Recessed row bands behind patch-panel keystones. */
  patchRows: RectMm[];
  /** Cable-management fingers along an axis. */
  fingers: {
    axis: 'x' | 'y';
    count: number;
    slotMm: number;
    depthMm: number;
    cover: boolean;
  } | null;
  /** D-ring loops (x offsets on the faceplate). */
  rings: Array<{ xMm: number; wMm: number; hMm: number }>;
  brush: RectMm | null;
  /**
   * Cantilever shelf / drawer deck. Shelves carry a perforated top
   * plate with corner cable slots, a front apron and tapered side
   * skirts (the classic toolless rack shelf); drawers keep a closed
   * front face instead.
   */
  deck: {
    lipMm: number;
    drawer: boolean;
    /** Dense round-hole field across the deck. */
    perforated: boolean;
    /** Oblong cable pass-throughs in the deck plane (x across the
     *  width, y along the depth from the deck center). */
    slotsMm: RectMm[];
  } | null;
  /** Base shape for open (non-box, non-panel) accessories. */
  openBody: 'deck' | 'tray' | 'raceway' | 'bar' | 'frame' | null;
  /**
   * Rear cable-support bar behind patch panels: a horizontal tube on
   * standoff arms that carries the weight of the terminated cables.
   */
  rearBar: { spanMm: number; yMm: number; zMm: number } | null;
}

/* ---- geometry helpers -------------------------------------------------- */

const overlaps = (a: RectMm, b: RectMm, marginMm = 0): boolean =>
  Math.abs(a.xMm - b.xMm) < (a.wMm + b.wMm) / 2 + marginMm &&
  Math.abs(a.yMm - b.yMm) < (a.hMm + b.hMm) / 2 + marginMm;

/**
 * Everything already occupying the front face (rendered by the hardware
 * layer): visible front connectors, the display cutout, authored LEDs.
 * Generated furniture must never collide with these.
 */
export function occupiedFrontRects(definition: DeviceDefinition): RectMm[] {
  const rects: RectMm[] = [];
  const all = [
    ...resolvePhysicalPorts(definition),
    ...resolvePowerConnectors(definition),
  ];
  for (const port of all) {
    if (!port.visible || port.location !== 'front') continue;
    const size = CONNECTOR_SIZES[port.type];
    rects.push({
      xMm: port.positionMm[0],
      yMm: port.positionMm[1],
      wMm: port.sizeMm?.[0] ?? size.widthMm,
      hMm: port.sizeMm?.[1] ?? size.heightMm,
    });
  }
  const display = definition.display;
  if (display?.lcd) {
    const pos = display.positionMm ?? [
      definition.widthMm / 2 - 60,
      0,
      definition.depthMm / 2,
    ];
    if (pos[2] >= 0) {
      rects.push({
        xMm: pos[0],
        yMm: pos[1],
        wMm: (display.widthMm ?? 60) + 2 * (display.bezelMm ?? 2),
        hMm: (display.heightMm ?? 25) + 2 * (display.bezelMm ?? 2),
      });
    }
  }
  for (const led of definition.leds) {
    const pos = led.positionMm;
    if (!pos || pos[2] < 0) continue;
    const d = (led.diameterMm ?? 2) + 4;
    rects.push({ xMm: pos[0], yMm: pos[1], wMm: d, hMm: d });
  }
  return rects;
}

/**
 * Free horizontal intervals on a front-face lane after subtracting the
 * occupied rects that intersect it. Interval ends are clamped to the
 * usable width (side margins excluded).
 */
export function freeIntervals(
  occupied: readonly RectMm[],
  lane: { yMm: number; hMm: number },
  usableHalfWidthMm: number,
  marginMm = 4,
): Array<[number, number]> {
  const blockers = occupied
    .filter(
      (r) => Math.abs(r.yMm - lane.yMm) < (r.hMm + lane.hMm) / 2 + marginMm,
    )
    .map(
      (r) =>
        [r.xMm - r.wMm / 2 - marginMm, r.xMm + r.wMm / 2 + marginMm] as [
          number,
          number,
        ],
    )
    .sort((a, b) => a[0] - b[0]);

  const out: Array<[number, number]> = [];
  let cursor = -usableHalfWidthMm;
  for (const [start, end] of blockers) {
    if (start > cursor) out.push([cursor, Math.min(start, usableHalfWidthMm)]);
    cursor = Math.max(cursor, end);
    if (cursor >= usableHalfWidthMm) break;
  }
  if (cursor < usableHalfWidthMm) out.push([cursor, usableHalfWidthMm]);
  return out.filter(([a, b]) => b - a > 8);
}

const widest = (
  intervals: Array<[number, number]>,
): [number, number] | null =>
  intervals.reduce<[number, number] | null>(
    (best, i) => (best === null || i[1] - i[0] > best[1] - best[0] ? i : best),
    null,
  );

/* ---- the builder ------------------------------------------------------- */

/** EIA-310: three mounting holes per rack unit, per side. */
const HOLES_PER_U = 3;
const EAR_WIDTH_MM = 16;

export function buildChassisSpec(definition: DeviceDefinition): ChassisSpec {
  const kind = inferDeviceKind(definition);
  // A device may adopt another brand's finish (presentation.styleKey) to
  // colour-match the gear it lives with; otherwise its own manufacturer.
  const style = styleFor(
    definition.presentation.styleKey ?? definition.manufacturerName,
    definition.presentation.tone,
  );
  const w = definition.widthMm;
  const h = definition.heightMm;
  const d = definition.depthMm;
  const rackMounted = definition.mountingStandard === 'eia-310';
  const occupied = occupiedFrontRects(definition);

  const bodyStyle: ChassisSpec['bodyStyle'] = PANEL_KINDS.has(kind)
    ? 'panel'
    : BOX_KINDS.has(kind)
      ? 'box'
      : 'open';

  /* Ears + installed screw heads (top and bottom hole each side). */
  const ears = rackMounted
    ? { widthMm: EAR_WIDTH_MM, holeCount: HOLES_PER_U * definition.rackUnits }
    : null;
  const earScrewsMm: Array<[number, number]> = ears
    ? ([
        [-w / 2 + EAR_WIDTH_MM / 2, h / 2 - 8],
        [-w / 2 + EAR_WIDTH_MM / 2, -h / 2 + 8],
        [w / 2 - EAR_WIDTH_MM / 2, h / 2 - 8],
        [w / 2 - EAR_WIDTH_MM / 2, -h / 2 + 8],
      ] as Array<[number, number]>)
    : [];

  const usableHalf = w / 2 - (ears ? EAR_WIDTH_MM + 6 : 10);

  /* Badge + model label: prefer the top lane, tucked left. */
  const badgeLane = { yMm: h * 0.3, hMm: Math.min(9, h * 0.24) };
  const badgeSpots = freeIntervals(occupied, badgeLane, usableHalf);
  const badgeHome = badgeSpots.find(([a]) => a <= -usableHalf + 2) ?? widest(badgeSpots);
  const badgeH = Math.min(7, h * 0.2);
  // Blank panels stay clean; shelves have no front face to print on
  // (their front is the open deck edge).
  const badge =
    kind === 'blank-panel' || kind === 'shelf' || badgeHome === null
      ? null
      : { xMm: badgeHome[0] + 4, yMm: badgeLane.yMm, heightMm: badgeH };
  const label =
    badge === null
      ? null
      : {
          xMm: badge.xMm,
          yMm: badge.yMm - badgeH * 0.95,
          heightMm: badgeH * 0.62,
        };

  /* Vents. Active gear breathes; placement avoids ports and display. */
  const active = definition.maximumPowerWatts > 0 || (definition.cooling?.fanCount ?? 0) > 0;
  const vents: VentRegion[] = [];
  if (bodyStyle === 'box' && active) {
    // Side perforation on everything active with real depth.
    if (d >= 120) {
      const ventD = Math.min(d * 0.45, 160);
      const ventH = Math.max(h * 0.45, Math.min(h - 10, 14));
      for (const face of ['side-left', 'side-right'] as const) {
        vents.push({
          face,
          style: style.ventStyle,
          xMm: d * 0.12,
          yMm: 0,
          wMm: ventD,
          hMm: ventH,
        });
      }
    }
    // Front vent band where the faceplate has room (servers, UPS…).
    const frontLane = { yMm: -h * 0.22, hMm: Math.min(h * 0.34, 26) };
    const wantsFrontVents =
      kind === 'ups' ||
      kind === 'firewall' ||
      kind === 'gateway' ||
      kind === 'router' ||
      kind === 'media-converter' ||
      kind === 'modem' ||
      kind === 'generic';
    if (wantsFrontVents) {
      const spot = widest(freeIntervals(occupied, frontLane, usableHalf));
      if (spot && spot[1] - spot[0] >= 40) {
        vents.push({
          face: 'front',
          style: style.ventStyle,
          xMm: (spot[0] + spot[1]) / 2,
          yMm: frontLane.yMm,
          wMm: spot[1] - spot[0] - 8,
          hMm: frontLane.hMm,
        });
      }
    }
    // Rear exhaust grid (behind, above the PSU line).
    vents.push({
      face: 'rear',
      style: style.ventStyle,
      xMm: -w * 0.12,
      yMm: h * 0.12,
      wMm: w * 0.42,
      hMm: Math.min(h * 0.5, 30),
    });
  }

  /* Drive bays: servers/storage/NAS fill the free front with trays. */
  const driveBays: RectMm[] = [];
  if (kind === 'server' || kind === 'storage' || kind === 'nas') {
    const bayH = 27;
    const bayW = 102;
    const rows = Math.max(1, Math.floor((h - 8) / (bayH + 3)));
    const cols = Math.max(1, Math.floor((usableHalf * 2) / (bayW + 4)));
    const gridW = cols * (bayW + 4) - 4;
    const gridH = rows * (bayH + 3) - 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rect: RectMm = {
          xMm: -gridW / 2 + bayW / 2 + c * (bayW + 4),
          yMm: gridH / 2 - bayH / 2 - r * (bayH + 3),
          wMm: bayW,
          hMm: bayH,
        };
        if (!occupied.some((o) => overlaps(rect, o, 2))) driveBays.push(rect);
      }
    }
  }

  /* Buttons: a power button for compute-ish gear, reset for routing. */
  const buttons: ChassisSpec['buttons'] = [];
  if (bodyStyle === 'box' && kind !== 'pdu' && kind !== 'drawer') {
    const spot: RectMm = {
      xMm: usableHalf - 7,
      yMm: h * 0.28,
      wMm: 10,
      hMm: 10,
    };
    if (!occupied.some((o) => overlaps(spot, o, 2))) {
      buttons.push({ xMm: spot.xMm, yMm: spot.yMm, diameterMm: 6, kind: 'power' });
    }
    if (kind === 'router' || kind === 'gateway' || kind === 'firewall') {
      const reset: RectMm = { xMm: usableHalf - 7, yMm: -h * 0.28, wMm: 6, hMm: 6 };
      if (!occupied.some((o) => overlaps(reset, o, 2))) {
        buttons.push({ xMm: reset.xMm, yMm: reset.yMm, diameterMm: 2.6, kind: 'reset' });
      }
    }
  }

  /* Pull handles: deep compute chassis and UPS faces. */
  const handles: ChassisSpec['handles'] =
    ears &&
    (kind === 'server' || kind === 'storage' || kind === 'nas' || kind === 'ups') &&
    definition.rackUnits >= 2
      ? [
          { xMm: -w / 2 + EAR_WIDTH_MM / 2, heightMm: h * 0.7 },
          { xMm: w / 2 - EAR_WIDTH_MM / 2, heightMm: h * 0.7 },
        ]
      : [];

  /* Rear PSU module frames around resolved power inlets. */
  const psuFramesMm: RectMm[] = [];
  if (bodyStyle === 'box') {
    for (const inlet of resolvePowerConnectors(definition)) {
      if (inlet.location !== 'rear') continue;
      const size = CONNECTOR_SIZES[inlet.type];
      psuFramesMm.push({
        xMm: inlet.positionMm[0],
        yMm: inlet.positionMm[1],
        wMm: size.widthMm + 34,
        hMm: Math.min(size.heightMm + 18, h - 4),
      });
    }
  }

  /* PDU without authored outlets: a visual outlet strip. */
  const outletStrip =
    kind === 'pdu' && occupied.length === 0
      ? { xMm: 0, yMm: 0, wMm: usableHalf * 2 - 10, hMm: Math.min(h * 0.6, 30) }
      : null;

  /* Rubber feet for non-rack (desktop) devices. */
  const feetMm: Array<[number, number]> =
    !rackMounted && bodyStyle === 'box'
      ? [
          [-w / 2 + 14, d / 2 - 14],
          [w / 2 - 14, d / 2 - 14],
          [-w / 2 + 14, -d / 2 + 14],
          [w / 2 - 14, -d / 2 + 14],
        ]
      : [];

  /* A real keystone panel is a flat metal plate — the openings are
   * punched straight through it, with no dark recessed band behind them.
   * The openings carry their own shallow silver frame + shadowed hole
   * (see HardwareLayer), so the plate stays clean silver end to end. */
  const patchRows: RectMm[] = [];

  /* Rear cable-support bar: below the keystone terminations. */
  const rearBar: ChassisSpec['rearBar'] =
    (kind === 'patch-panel' || kind === 'fiber-panel') && occupied.length > 0
      ? { spanMm: w - 64, yMm: -h / 2 + 6, zMm: -d / 2 + 6 }
      : null;

  /* Cable management furniture from the authored management spec. */
  const cm = definition.cableManagement;
  let fingers: ChassisSpec['fingers'] = null;
  const rings: ChassisSpec['rings'] = [];
  let brush: ChassisSpec['brush'] = null;
  if (kind === 'brush-panel' || cm?.kind === 'brush-panel') {
    brush = { xMm: 0, yMm: 0, wMm: usableHalf * 2 - 4, hMm: Math.min(h * 0.62, 28) };
  } else if (cm) {
    switch (cm.kind) {
      case 'finger-duct':
      case 'horizontal-manager': {
        const slot = 14;
        fingers = {
          axis: 'x',
          count: Math.max(4, Math.floor((usableHalf * 2) / (slot * 2))),
          slotMm: slot,
          depthMm: Math.min(d * 0.7, 70),
          cover: cm.kind === 'finger-duct' || (cm.enclosed ?? false),
        };
        break;
      }
      case 'vertical-manager': {
        const slot = 14;
        fingers = {
          axis: 'y',
          count: Math.max(4, Math.floor(h / (slot * 2))),
          slotMm: slot,
          depthMm: Math.min(d * 0.7, 70),
          cover: cm.enclosed ?? false,
        };
        break;
      }
      case 'cable-ring': {
        for (const node of cm.nodes) {
          rings.push({ xMm: node.positionMm[0], wMm: 44, hMm: Math.min(h * 0.8, 62) });
        }
        break;
      }
      // 'cable-tray', 'raceway' and 'patch-guide' render as their body
      // shape alone (open channel / enclosed duct / bar) — no furniture.
    }
  }

  /* Shelves and drawers: a deck with a front lip. */
  let deck: ChassisSpec['deck'] = null;
  if (kind === 'shelf' || kind === 'drawer') {
    const drawer = kind === 'drawer';
    const slotsMm: RectMm[] = [];
    if (!drawer && d >= 160 && w >= 300) {
      // Four oblong cable slots near the deck corners.
      const slotX = w / 2 - 92;
      const slotY = d / 2 - 52;
      for (const [sx, sy] of [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ] as const) {
        slotsMm.push({ xMm: sx * slotX, yMm: sy * slotY, wMm: 64, hMm: 20 });
      }
    }
    deck = {
      lipMm: Math.min(h, 12),
      drawer,
      perforated: !drawer && d >= 120,
      slotsMm,
    };
  }

  const openBody: ChassisSpec['openBody'] =
    bodyStyle !== 'open'
      ? null
      : deck
        ? 'deck'
        : cm?.kind === 'cable-tray'
          ? 'tray'
          : cm?.kind === 'raceway'
            ? 'raceway'
            : cm?.kind === 'patch-guide'
              ? 'bar'
              : 'frame';

  return {
    kind,
    style,
    widthMm: w,
    heightMm: h,
    depthMm: d,
    bodyStyle,
    faceThicknessMm: bodyStyle === 'panel' ? 2.5 : 4,
    bodyInsetMm: bodyStyle === 'panel' ? 0 : 3,
    cornerRadiusMm: style.cornerRadiusMm,
    ears,
    earScrewsMm,
    vents,
    badge,
    label,
    buttons,
    handles,
    driveBays,
    psuFramesMm,
    outletStrip,
    feetMm,
    patchRows,
    fingers,
    rings,
    brush,
    deck,
    openBody,
    rearBar,
  };
}
