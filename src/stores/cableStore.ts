import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CABLE_CATALOG, type CableTypeId } from '@/features/cables/cableCatalog';
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
  notes?: string;
  /** Manual-mode waypoints, rack-local meters. */
  waypointsMm?: [number, number, number][];
  /** Future: cable bundling. */
  bundleId?: string;
}

export interface NewCable {
  source: CableEnd;
  destination: CableEnd;
  type: CableTypeId;
  nominalLengthMm: number;
  color?: string;
  label?: string;
}

interface CableState {
  cables: CableInstance[];

  addCable: (input: NewCable) => CableInstance;
  updateCable: (
    id: string,
    patch: Partial<Omit<CableInstance, 'id' | 'source' | 'destination'>>,
  ) => void;
  removeCable: (id: string) => void;
  /** Removes every cable touching a device; returns the removed cables. */
  removeForDevice: (deviceInstanceId: string) => CableInstance[];
  clearAll: () => void;
}

export const useCableStore = create<CableState>()(
  persist(
    (set, get) => ({
      cables: [],

      addCable: (input) => {
        const spec = CABLE_CATALOG[input.type];
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
          label: input.label,
        };
        set((s) => ({ cables: [...s.cables, cable] }));
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

      clearAll: () => set({ cables: [] }),
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
