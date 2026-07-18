import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDevice } from '@/features/devices/deviceRegistry';
import {
  deepestDeviceDepthMm,
  findFirstFreeSlot,
  findFreeShelfSpot,
  isShelfDefinition,
  rackGeometryFor,
  validatePlacement,
  validateSurfacePlacement,
  type PlacedDevice,
  type PlacementContext,
  type PlacementResult,
  type SurfacePlacement,
} from '@/features/rack/rackMath';
import { useRackStore } from './rackStore';
import { useSelectionStore } from './selectionStore';
import type { RackOrientation } from '@/types';

export type ShelfResult =
  | { ok: true; instanceId: string }
  | { ok: false; message: string };

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
  /** Stands a new device on a shelf (auto-spot when x/z omitted). */
  addDeviceToShelf: (
    definitionId: string,
    shelfInstanceId: string,
    xMm?: number,
    zMm?: number,
  ) => ShelfResult;
  /** Moves a device onto (or across) a shelf at the given deck offset. */
  moveToShelf: (
    instanceId: string,
    shelfInstanceId: string,
    xMm: number,
    zMm: number,
  ) => ShelfResult;
  /** Repositions a device already standing on its shelf. */
  moveOnShelf: (instanceId: string, xMm: number, zMm: number) => ShelfResult;
  /** Rotates a device on its shelf (validated against the deck). */
  rotateOnShelf: (instanceId: string, rotationDeg: number) => ShelfResult;
  setFacing: (instanceId: string, facing: RackOrientation) => void;
  setVisible: (instanceId: string, visible: boolean) => void;
  removeDevice: (instanceId: string) => void;
  clearAll: () => void;
}

/** Devices standing on the given shelf, with their definitions. */
export function shelfChildren(
  instances: readonly PlacedDevice[],
  shelfInstanceId: string,
): Array<{ instance: PlacedDevice; definition: ReturnType<typeof getDevice> & object }> {
  const out: Array<{ instance: PlacedDevice; definition: NonNullable<ReturnType<typeof getDevice>> }> = [];
  for (const instance of instances) {
    if (instance.surface?.shelfId !== shelfInstanceId) continue;
    const definition = getDevice(instance.definitionId);
    if (definition) out.push({ instance, definition });
  }
  return out;
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
          instances: s.instances.map((i) => {
            if (i.id === instanceId) {
              // Moving to the rails detaches a device from its shelf.
              return { ...i, startU: result.startU, surface: undefined };
            }
            // A moving shelf carries the devices standing on it.
            if (i.surface?.shelfId === instanceId) {
              return { ...i, startU: result.startU };
            }
            return i;
          }),
        }));
        return result;
      },

      addDeviceToShelf: (definitionId, shelfInstanceId, xMm, zMm) => {
        const definition = getDevice(definitionId);
        if (!definition) {
          return { ok: false, message: 'This device is not in the catalog.' };
        }
        const shelfInstance = get().instances.find(
          (i) => i.id === shelfInstanceId,
        );
        const shelfDefinition =
          shelfInstance && getDevice(shelfInstance.definitionId);
        if (!shelfInstance || !shelfDefinition || !isShelfDefinition(shelfDefinition)) {
          return { ok: false, message: 'That is not a shelf.' };
        }
        const siblings = shelfChildren(get().instances, shelfInstanceId);
        let surface: SurfacePlacement | null;
        if (xMm !== undefined && zMm !== undefined) {
          surface = { shelfId: shelfInstanceId, xMm, zMm, rotationDeg: 0 };
          const check = validateSurfacePlacement(
            definition,
            surface,
            shelfDefinition,
            siblings,
          );
          if (!check.ok) return check;
        } else {
          surface = findFreeShelfSpot(
            definition,
            shelfDefinition,
            shelfInstanceId,
            siblings,
          );
          if (!surface) {
            return {
              ok: false,
              message: `No room left on this shelf for ${definition.productName}.`,
            };
          }
        }
        const instance: PlacedDevice = {
          id: crypto.randomUUID(),
          definitionId,
          startU: shelfInstance.startU,
          facing: shelfInstance.facing,
          visible: true,
          surface,
        };
        set((s) => ({ instances: [...s.instances, instance] }));
        useSelectionStore.getState().selectDevice(instance.id);
        return { ok: true, instanceId: instance.id };
      },

      moveToShelf: (instanceId, shelfInstanceId, xMm, zMm) => {
        const instance = get().instances.find((i) => i.id === instanceId);
        const definition = instance && getDevice(instance.definitionId);
        if (!instance || !definition) {
          return { ok: false, message: 'This device is no longer mounted.' };
        }
        const shelfInstance = get().instances.find(
          (i) => i.id === shelfInstanceId,
        );
        const shelfDefinition =
          shelfInstance && getDevice(shelfInstance.definitionId);
        if (!shelfInstance || !shelfDefinition || !isShelfDefinition(shelfDefinition)) {
          return { ok: false, message: 'That is not a shelf.' };
        }
        if (shelfInstanceId === instanceId) {
          return { ok: false, message: 'A shelf cannot stand on itself.' };
        }
        const surface: SurfacePlacement = {
          shelfId: shelfInstanceId,
          xMm,
          zMm,
          rotationDeg: instance.surface?.rotationDeg ?? 0,
        };
        const check = validateSurfacePlacement(
          definition,
          surface,
          shelfDefinition,
          shelfChildren(get().instances, shelfInstanceId),
          instanceId,
        );
        if (!check.ok) return check;
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId
              ? {
                  ...i,
                  startU: shelfInstance.startU,
                  facing: shelfInstance.facing,
                  surface,
                }
              : i,
          ),
        }));
        return { ok: true, instanceId };
      },

      moveOnShelf: (instanceId, xMm, zMm) => {
        const instance = get().instances.find((i) => i.id === instanceId);
        if (!instance?.surface) {
          return { ok: false, message: 'This device is not on a shelf.' };
        }
        return get().moveToShelf(instanceId, instance.surface.shelfId, xMm, zMm);
      },

      rotateOnShelf: (instanceId, rotationDeg) => {
        const instance = get().instances.find((i) => i.id === instanceId);
        const definition = instance && getDevice(instance.definitionId);
        if (!instance?.surface || !definition) {
          return { ok: false, message: 'This device is not on a shelf.' };
        }
        const shelfInstance = get().instances.find(
          (i) => i.id === instance.surface!.shelfId,
        );
        const shelfDefinition =
          shelfInstance && getDevice(shelfInstance.definitionId);
        if (!shelfInstance || !shelfDefinition) {
          return { ok: false, message: 'The shelf under this device is gone.' };
        }
        const normalized = ((rotationDeg % 360) + 360) % 360;
        const surface: SurfacePlacement = {
          ...instance.surface,
          rotationDeg: normalized,
        };
        const check = validateSurfacePlacement(
          definition,
          surface,
          shelfDefinition,
          shelfChildren(get().instances, surface.shelfId),
          instanceId,
        );
        if (!check.ok) return check;
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === instanceId ? { ...i, surface } : i,
          ),
        }));
        return { ok: true, instanceId };
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
        // Removing a shelf takes the devices standing on it along.
        const removed = new Set(
          get()
            .instances.filter(
              (i) => i.id === instanceId || i.surface?.shelfId === instanceId,
            )
            .map((i) => i.id),
        );
        set((s) => ({
          instances: s.instances.filter((i) => !removed.has(i.id)),
        }));
        const selection = useSelectionStore.getState();
        if (
          selection.selection?.kind === 'device' &&
          removed.has(selection.selection.instanceId)
        ) {
          selection.clear();
        }
      },

      clearAll: () => set({ instances: [] }),
    }),
    { name: 'rackforge-devices' },
  ),
);
