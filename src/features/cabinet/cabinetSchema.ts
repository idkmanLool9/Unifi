/**
 * Interactive Cabinet System — metadata schema.
 *
 * A rack enclosure is no longer a static mesh: it is a set of individually
 * addressable, movable parts described entirely by metadata. Every rack
 * cabinet — this one and every future one — is driven by a CabinetModelDef
 * that maps GLB nodes to parts and declares how each part behaves. There
 * is no cabinet-specific code anywhere in the renderer or the UI: adding a
 * new cabinet is authoring data, not writing code.
 */

/** How a part moves when actuated. New kinds slot in without renderer edits. */
export type CabinetInteraction =
  | 'hinge' // swings about a pivot axis (doors)
  | 'sliding' // slides along an axis and back (drawers, pull-out rails)
  | 'lift' // lifts straight off along an axis (top covers)
  | 'remove' // detaches and moves clear (side panels, back)
  | 'visibility' // no motion, just show/hide (frame, rails, fans)
  | 'fixed'; // never interactive (structural)

export type CabinetPartKind =
  | 'door'
  | 'side-panel'
  | 'top-cover'
  | 'bottom-cover'
  | 'rear-cover'
  | 'rails'
  | 'frame'
  | 'accessory';

/** Spatial group — drives quick actions ("open all front"), camera focus. */
export type CabinetGroup =
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'interior';

/** The state a single part can be in. Not every part offers every state. */
export type CabinetPartState =
  | 'closed'
  | 'open'
  | 'installed'
  | 'hidden'
  | 'removed';

export type Vec3 = [number, number, number];

/** Hinge geometry, in model-local millimetres (GLB centred at origin). */
export interface CabinetHinge {
  /** Pivot point on the hinge axis. */
  pivotMm: Vec3;
  /** Axis the door swings about. */
  axis: 'x' | 'y' | 'z';
  /** Angle (deg) used by the "open" state / default open. */
  openDeg: number;
  /** Maximum angle the slider allows. */
  maxDeg: number;
}

/** A straight translation (slide / lift / remove / explode). */
export interface CabinetMove {
  /** Direction the part travels, model-local (normalised on use). */
  dirMm: Vec3;
  /** Full travel distance, mm. */
  distanceMm: number;
}

export interface CabinetPartDef {
  id: string;
  name: string;
  kind: CabinetPartKind;
  interaction: CabinetInteraction;
  group: CabinetGroup;
  /**
   * GLB node-name patterns this part owns. A trailing `*` is a prefix
   * match (`INT_Rail_*`), otherwise it is an exact name. A node matched
   * by a more specific part wins, so order specific parts before broad
   * catch-alls.
   */
  nodes: string[];
  hinge?: CabinetHinge;
  move?: CabinetMove;
  explode?: CabinetMove;
  defaultState: CabinetPartState;
  /** States this part exposes in the UI (first is the "restored" state). */
  states: CabinetPartState[];
  /** Part can be dimmed by transparency / ghost / x-ray modes. */
  supportsTransparency?: boolean;
  /** Removed or opened automatically in Interior / Maintenance views. */
  obstructsInterior?: boolean;
  /** Per-part animation override, ms (else the model/global default). */
  animationMs?: number;
}

export interface CabinetModelDef {
  id: string;
  name: string;
  /** Base-path-relative GLB URL (resolved through assetUrl). */
  modelPath: string;
  rackUnits: number;
  /** Overall model size, mm — used for exploded spacing + camera framing. */
  sizeMm: Vec3;
  /** Default animation duration for parts without an override, ms. */
  animationMs: number;
  parts: CabinetPartDef[];
}

/** True when `nodeName` is claimed by `pattern` (exact, or `prefix*`). */
export function matchesNodePattern(nodeName: string, pattern: string): boolean {
  if (pattern.endsWith('*')) return nodeName.startsWith(pattern.slice(0, -1));
  return nodeName === pattern;
}

/** The part that owns a GLB node, or undefined. First match wins, so list
 *  specific parts before catch-alls in the model definition. */
export function partForNode(
  model: CabinetModelDef,
  nodeName: string,
): CabinetPartDef | undefined {
  return model.parts.find((part) =>
    part.nodes.some((p) => matchesNodePattern(nodeName, p)),
  );
}
