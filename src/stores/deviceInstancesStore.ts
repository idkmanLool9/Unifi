import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDevice } from '@/features/devices/deviceRegistry';
import {
  deepestDeviceDepthMm,
  findFirstFreeSlot,
  rackGeometryFor,
  validatePlacement,
  type PlacedDevice,
  type PlacementContext,
  type PlacementResult,
} from '@/features/rack/rackMath';
import { useRackStore } from './rackStore';
import { useSelectionStore } from './selectionStore';
import type { RackOrientation } from '@/types';

interface DeviceInstancesState {
  instances: PlacedDevice[];

  /** Places a device; picks the lowest free slot when startU is omitted. */
  addDevice: (
    definitionId: string,
    startU?: number,
    facing?: RackOrientation,
  ) => PlacementResult;
  /** Moves an existing device to a new start unit. */
  moveDevice: (instanceId: string, startU: number) => PlacementResult;
  setFacing: (instanceId: string, facing: RackOrientation) => void;
  setVisible: (instanceId: string, visible: boolean) => void;
  removeDevice: (instanceId: string) => void;
  clearAll: () => void;
}

/** Builds the placement context from current rack + instances state. */
export function placementContext(
  instances: readonly PlacedDevice[],
): PlacementContext | null {
  const rack = useRackStore.getState().rack;
  if (!rack) return null;
  const geometry = rackGeometryFor(
    rack,
    deepestDeviceDepthMm(instances, getDevice),
  );
  return {
    rackUnits: rack.units,
    usableDepthMm: geometry.usableDepthM / 0.001,
    shelfAvailable: geometry.profile.shelfCompatible,
    instances,
    getDefinition: getDevice,
  };
}

export const useDeviceInstancesStore = create<DeviceInstancesState>()(
  persist(
    (set, get) => ({
      instances: [],

      addDevice: (definitionId, startU, facing) => {
        const definition = getDevice(definitionId);
        if (!definition) {
          return {
            ok: false,
            reason: 'unknown-device',
            message: 'This device is not in the catalog.',
          };
        }
        const ctx = placementContext(get().instances);
        if (!ctx) {
          return {
            ok: false,
            reason: 'no-rack',
            message: 'Create a rack before mounting devices.',
          };
        }

        const target =
          startU ?? findFirstFreeSlot(ctx, definition.rackUnits);
        if (target === null) {
          return {
            ok: false,
            reason: 'occupied',
            message: `No free ${definition.rackUnits}U slot left in this rack.`,
          };
        }

        const result = validatePlacement(definition, target, ctx);
        if (!result.ok) return result;

        const instance: PlacedDevice = {
          id: crypto.randomUUID(),
          definitionId,
          startU: result.startU,
          facing: facing ?? definition.defaultFacing,
          visible: true,
        };
        set((s) => ({ instances: [...s.instances, instance] }));
        useSelectionStore.getState().selectDevice(instance.id);
        return result;
      },

      moveDevice: (instanceId, startU) => {
        const instance = get().instances.find((i) => i.id === instanceId);
        const definition = instance && getDevice(instance.definitionId);
        if (!instance || !definition) {
          return {
            ok: false,
            reason: 'unknown-device',
            message: 'This device is no longer mounted.',
          };
        }
        const ctx = placementContext(get().instances);
        if (!ctx) {
          return {
            ok: false,
            reason: 'no-rack',
            message: 'There is no rack to move within.',
          };
        }

        const result = validatePlacement(definition, startU, ctx, instanceId);
        if (!result.ok) return result;

        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId ? { ...i, startU: result.startU } : i,
          ),
        }));
        return result;
      },

      setFacing: (instanceId, facing) =>
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId ? { ...i, facing } : i,
          ),
        })),

      setVisible: (instanceId, visible) =>
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId ? { ...i, visible } : i,
          ),
        })),

      removeDevice: (instanceId) => {
        set((s) => ({
          instances: s.instances.filter((i) => i.id !== instanceId),
        }));
        const selection = useSelectionStore.getState();
        if (
          selection.selection?.kind === 'device' &&
          selection.selection.instanceId === instanceId
        ) {
          selection.clear();
        }
      },

      clearAll: () => set({ instances: [] }),
    }),
    { name: 'rackforge-devices' },
  ),
);
