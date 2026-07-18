import { create } from 'zustand';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useDeviceInstancesStore } from './deviceInstancesStore';
import { useSelectionStore } from './selectionStore';
import { toast } from './toastStore';
import type { PlacementResult } from '@/features/rack/rackMath';
import type { RackOrientation } from '@/types';

/**
 * Drag-placement interaction state. Everything here is serializable —
 * definition/instance ids, U positions, validation results, client
 * pointer coordinates. Three.js objects, rays, and DOM nodes never
 * enter this store; transient render math lives in the placement layer.
 *
 * Moves are transactional: the original instance is untouched while
 * dragging and is only mutated by a successful drop. Cancel always
 * restores idle state with nothing changed.
 */

export type DragSource =
  | { kind: 'library'; definitionId: string }
  | {
      kind: 'instance';
      instanceId: string;
      definitionId: string;
      /** Alt/Option drag: place a copy, keep the original. */
      duplicate: boolean;
    };

export interface DragTarget {
  rackId: string;
  startU: number;
  facing: RackOrientation;
  /** Present when dropping onto a shelf deck instead of the rails. */
  surface?: { shelfId: string; xMm: number; zMm: number };
}

export interface DropOutcome {
  committed: boolean;
  instanceId?: string;
}

interface DragState {
  phase: 'idle' | 'dragging';
  source: DragSource | null;
  /** Client-space pointer, for the HTML drag chip. */
  pointer: { x: number; y: number };
  /** Shift held: snap to the pointer's exact slot, no valid-slot assist. */
  precise: boolean;
  target: DragTarget | null;
  validation: PlacementResult | null;
  /**
   * Orbit is paused for the current pointer gesture — set the moment a
   * press lands on a draggable device (before the drag threshold), so
   * camera-controls never captures the same gesture.
   */
  orbitSuspended: boolean;
  /** Clicks before this timestamp are the tail of a drag — ignore them. */
  suppressClickUntil: number;

  begin: (source: DragSource, pointer: { x: number; y: number }) => void;
  setOrbitSuspended: (suspended: boolean) => void;
  movePointer: (x: number, y: number) => void;
  setPrecise: (precise: boolean) => void;
  setTarget: (
    target: DragTarget | null,
    validation: PlacementResult | null,
  ) => void;
  cancel: () => void;
  drop: () => DropOutcome;
}

const IDLE = {
  phase: 'idle' as const,
  source: null,
  target: null,
  validation: null,
  precise: false,
  orbitSuspended: false,
};

export const useDragStore = create<DragState>()((set, get) => ({
  ...IDLE,
  pointer: { x: 0, y: 0 },
  suppressClickUntil: 0,

  begin: (source, pointer) =>
    set({
      phase: 'dragging',
      source,
      pointer,
      target: null,
      validation: null,
      precise: false,
    }),

  movePointer: (x, y) => set({ pointer: { x, y } }),

  setPrecise: (precise) => set({ precise }),

  setOrbitSuspended: (orbitSuspended) => set({ orbitSuspended }),

  setTarget: (target, validation) => set({ target, validation }),

  cancel: () => {
    set({ ...IDLE, suppressClickUntil: performance.now() + 250 });
    // Escape usually fires while the pointer is still held: the eventual
    // release of that same gesture must not read as a click either.
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'pointerup',
        () => set({ suppressClickUntil: performance.now() + 250 }),
        { once: true, capture: true },
      );
    }
  },

  drop: () => {
    const { phase, source, target, validation } = get();
    const finish = (outcome: DropOutcome): DropOutcome => {
      set({ ...IDLE, suppressClickUntil: performance.now() + 250 });
      return outcome;
    };

    if (phase !== 'dragging' || !source) return finish({ committed: false });

    // Dropped outside a rack, or on an invalid slot: change nothing.
    if (!target || !validation?.ok) {
      if (target && validation && !validation.ok) {
        toast({
          variant: 'warning',
          title: 'Can’t place device',
          description: validation.message,
        });
      }
      return finish({ committed: false });
    }

    const devices = useDeviceInstancesStore.getState();
    const definition = getDevice(source.definitionId);
    const name = definition?.productName ?? 'Device';
    const endU = target.startU + (definition?.rackUnits ?? 1) - 1;
    const range =
      target.startU === endU
        ? `U${target.startU}`
        : `U${target.startU}–U${endU}`;

    // Shelf drops: stand the device on the deck at the pointed spot.
    if (target.surface) {
      const { shelfId, xMm, zMm } = target.surface;
      const result =
        source.kind === 'instance' && !source.duplicate
          ? devices.moveToShelf(source.instanceId, shelfId, xMm, zMm)
          : devices.addDeviceToShelf(source.definitionId, shelfId, xMm, zMm);
      if (!result.ok) {
        toast({
          variant: 'warning',
          title: 'Can’t place on shelf',
          description: result.message,
        });
        return finish({ committed: false });
      }
      useSelectionStore.getState().selectDevice(result.instanceId);
      toast({
        variant: 'success',
        title:
          source.kind === 'instance' && !source.duplicate
            ? `${name} moved`
            : `${name} placed`,
        description: `Standing on the shelf at ${range}.`,
      });
      return finish({ committed: true, instanceId: result.instanceId });
    }

    if (source.kind === 'instance' && !source.duplicate) {
      const result = devices.moveDevice(source.instanceId, target.startU);
      if (!result.ok) {
        toast({
          variant: 'warning',
          title: 'Can’t move device',
          description: result.message,
        });
        return finish({ committed: false });
      }
      devices.setFacing(source.instanceId, target.facing);
      useSelectionStore.getState().selectDevice(source.instanceId);
      toast({
        variant: 'success',
        title: `${name} moved`,
        description: `Now installed at ${range}.`,
      });
      return finish({ committed: true, instanceId: source.instanceId });
    }

    const result = devices.addDevice(
      source.definitionId,
      target.startU,
      target.facing,
    );
    if (!result.ok) {
      toast({
        variant: 'warning',
        title: 'Can’t place device',
        description: result.message,
      });
      return finish({ committed: false });
    }
    const placedId = useSelectionStore.getState().selection;
    toast({
      variant: 'success',
      title:
        source.kind === 'instance'
          ? `${name} duplicated`
          : `${name} mounted`,
      description: `Installed at ${range}.`,
    });
    return finish({
      committed: true,
      instanceId:
        placedId?.kind === 'device' ? placedId.instanceId : undefined,
    });
  },
}));

/** True while a drag gesture owns the pointer. */
export const isDragging = (): boolean =>
  useDragStore.getState().phase === 'dragging';

/** Click handlers call this to swallow the click that ends a drag. */
export const shouldSuppressClick = (): boolean =>
  performance.now() < useDragStore.getState().suppressClickUntil;
