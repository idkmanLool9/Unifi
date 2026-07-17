import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CABLE_CATALOG,
  type CableTypeId,
  type FiberConnector,
} from '@/features/cables/cableCatalog';
import type { RoutingMode, SlackMode } from '@/features/cables/routing';

/**
 * Cable instances — project state. Fully serializable: devices and
 * ports are referenced by stable ids only (device instance id + the
 * PhysicalPort ref). No three.js objects, meshes, world vectors, or
 * sampled curves ever enter this store; routes are derived at render
 * time from semantic data.
 */

export interface CableEnd {
  deviceInstanceId: string;
  portRef: string;
}

export type CableStatus = 'ok' | 'warning' | 'invalid';

export interface CableInstance {
  id: string;
  source: CableEnd;
  destination: CableEnd;
  type: CableTypeId;
  /** Sheath color, hex. */
  color: string;
  nominalLengthMm: number;
  /** Last calculated route length (derived; refreshed by the renderer). */
  calculatedRouteLengthMm: number;
  routingMode: RoutingMode;
  slackMode: SlackMode;
  bendRadiusMm: number;
  thicknessMm: number;
  status: CableStatus;
  /** Human-readable status detail (why warning/invalid). */
  statusMessage?: string;
  label?: string;
  /** Show the label chips at both ends in the viewport. */
  labelVisible?: boolean;
  notes?: string;
  /** Documentation metadata (cable library). */
  manufacturer?: string;
  partNumber?: string;
  /** Fiber termination variant (LC↔LC, LC↔SC…), fiber cables only. */
  fiberConnector?: FiberConnector;
  /** Manual-mode waypoints, rack-local meters. */
  waypointsMm?: [number, number, number][];
  /** Bundle membership. */
  bundleId?: string;
  /** Routing-node keys the current route passes through (derived). */
  routedNodeKeys?: string[];
  /** Force the route through one management asset. */
  viaInstanceId?: string;
  /** Skip management hardware entirely for this cable. */
  ignoreManagers?: boolean;
}

export interface CableBundle {
  id: string;
  name: string;
  /** Extra clearance between member sheaths, mm. */
  spacingMm: number;
  /** Optional sleeve/label color for the whole bundle. */
  color?: string;
  /** Render velcro straps along the loom (default true). */
  straps?: boolean;
}

/** Transient bundle highlight (never persisted). */
interface BundleHighlightState {
  highlightBundleId: string | null;
  setHighlight: (id: string | null) => void;
}
export const useBundleHighlightStore = create<BundleHighlightState>()((set) => ({
  highlightBundleId: null,
  setHighlight: (highlightBundleId) => set({ highlightBundleId }),
}));

export interface NewCable {
  source: CableEnd;
  destination: CableEnd;
  type: CableTypeId;
  nominalLengthMm: number;
  color?: string;
  label?: string;
}

/**
 * Cables created this session (for the insertion animation only —
 * never persisted, so reloading a project doesn't replay every plug).
 * The renderer consumes an id exactly once.
 */
const bornThisSession = new Set<string>();
export function consumeBornAnimation(id: string): boolean {
  return bornThisSession.delete(id);
}

interface CableState {
  cables: CableInstance[];
  bundles: CableBundle[];
  /** Monotonic label counter (Cable 1, Cable 2, …). */
  labelCounter: number;

  addCable: (input: NewCable) => CableInstance;
  updateCable: (
    id: string,
    patch: Partial<Omit<CableInstance, 'id' | 'source' | 'destination'>>,
  ) => void;
  removeCable: (id: string) => void;
  /** Removes every cable touching a device; returns the removed cables. */
  removeForDevice: (deviceInstanceId: string) => CableInstance[];
  clearAll: () => void;

  createBundle: (name?: string) => CableBundle;
  updateBundle: (id: string, patch: Partial<Omit<CableBundle, 'id'>>) => void;
  /** Dissolves the bundle; member cables stay, unassigned. */
  removeBundle: (id: string) => void;
  assignToBundle: (cableId: string, bundleId: string | undefined) => void;
  /** Moves every member of `fromId` into `intoId` and deletes `fromId`. */
  mergeBundles: (fromId: string, intoId: string) => void;
  /** Moves the given members into a fresh bundle; returns it. */
  splitBundle: (bundleId: string, cableIds: string[]) => CableBundle | null;
  /** Swaps a cable's ends (reverse direction). */
  reverseCable: (id: string) => void;
}

export const useCableStore = create<CableState>()(
  persist(
    (set, get) => ({
      cables: [],
      bundles: [],
      labelCounter: 0,

      addCable: (input) => {
        const spec = CABLE_CATALOG[input.type];
        const n = get().labelCounter + 1;
        const cable: CableInstance = {
          id: crypto.randomUUID(),
          source: input.source,
          destination: input.destination,
          type: input.type,
          color: input.color ?? spec.defaultColor,
          nominalLengthMm: input.nominalLengthMm,
          calculatedRouteLengthMm: 0,
          routingMode: 'auto',
          slackMode: 'normal',
          bendRadiusMm: spec.minBendRadiusMm,
          thicknessMm: spec.diameterMm,
          status: 'ok',
          label: input.label ?? `Cable ${n}`,
        };
        bornThisSession.add(cable.id);
        set((s) => ({
          cables: [...s.cables, cable],
          labelCounter: n,
        }));
        return cable;
      },

      updateCable: (id, patch) =>
        set((s) => ({
          cables: s.cables.map((cable) =>
            cable.id === id ? { ...cable, ...patch } : cable,
          ),
        })),

      removeCable: (id) =>
        set((s) => ({ cables: s.cables.filter((c) => c.id !== id) })),

      removeForDevice: (deviceInstanceId) => {
        const affected = get().cables.filter(
          (c) =>
            c.source.deviceInstanceId === deviceInstanceId ||
            c.destination.deviceInstanceId === deviceInstanceId,
        );
        if (affected.length > 0) {
          set((s) => ({
            cables: s.cables.filter((c) => !affected.includes(c)),
          }));
        }
        return affected;
      },

      clearAll: () => set({ cables: [], bundles: [] }),

      createBundle: (name) => {
        const bundle: CableBundle = {
          id: crypto.randomUUID(),
          name: name ?? `Bundle ${get().bundles.length + 1}`,
          spacingMm: 1,
        };
        set((s) => ({ bundles: [...s.bundles, bundle] }));
        return bundle;
      },

      updateBundle: (id, patch) =>
        set((s) => ({
          bundles: s.bundles.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),

      removeBundle: (id) =>
        set((s) => ({
          bundles: s.bundles.filter((b) => b.id !== id),
          cables: s.cables.map((c) =>
            c.bundleId === id ? { ...c, bundleId: undefined } : c,
          ),
        })),

      assignToBundle: (cableId, bundleId) =>
        set((s) => ({
          cables: s.cables.map((c) =>
            c.id === cableId ? { ...c, bundleId } : c,
          ),
        })),

      mergeBundles: (fromId, intoId) =>
        set((s) => ({
          cables: s.cables.map((c) =>
            c.bundleId === fromId ? { ...c, bundleId: intoId } : c,
          ),
          bundles: s.bundles.filter((b) => b.id !== fromId),
        })),

      splitBundle: (bundleId, cableIds) => {
        const source = get().bundles.find((b) => b.id === bundleId);
        if (!source || cableIds.length === 0) return null;
        const bundle: CableBundle = {
          id: crypto.randomUUID(),
          name: `${source.name} (split)`,
          spacingMm: source.spacingMm,
          straps: source.straps,
        };
        set((s) => ({
          bundles: [...s.bundles, bundle],
          cables: s.cables.map((c) =>
            c.bundleId === bundleId && cableIds.includes(c.id)
              ? { ...c, bundleId: bundle.id }
              : c,
          ),
        }));
        return bundle;
      },

      reverseCable: (id) =>
        set((s) => ({
          cables: s.cables.map((c) =>
            c.id === id
              ? { ...c, source: c.destination, destination: c.source }
              : c,
          ),
        })),
    }),
    { name: 'rackforge-cables' },
  ),
);

/** Cables attached to a device (either end). */
export const cablesForDevice = (
  cables: readonly CableInstance[],
  deviceInstanceId: string,
): CableInstance[] =>
  cables.filter(
    (c) =>
      c.source.deviceInstanceId === deviceInstanceId ||
      c.destination.deviceInstanceId === deviceInstanceId,
  );

/** The cable terminating on a specific port, if any. */
export const cableForPort = (
  cables: readonly CableInstance[],
  end: CableEnd,
): CableInstance | undefined =>
  cables.find(
    (c) =>
      (c.source.deviceInstanceId === end.deviceInstanceId &&
        c.source.portRef === end.portRef) ||
      (c.destination.deviceInstanceId === end.deviceInstanceId &&
        c.destination.portRef === end.portRef),
  );

/**
 * Bundle members in stable id order — index in this list drives the
 * member's deterministic offset inside the loom.
 */
export const bundleMembers = (
  cables: readonly CableInstance[],
  bundleId: string,
): CableInstance[] =>
  cables
    .filter((c) => c.bundleId === bundleId)
    .sort((a, b) => a.id.localeCompare(b.id));
