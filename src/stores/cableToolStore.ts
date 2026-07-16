import { create } from 'zustand';
import { defaultCableType } from '@/features/cables/cableCatalog';
import {
  checkPortPair,
  occupancyFrom,
  type CompatResult,
} from '@/features/cables/compatibility';
import { findPhysicalPort } from '@/features/cables/anchors';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useCableStore, type CableEnd } from './cableStore';
import { useDeviceInstancesStore } from './deviceInstancesStore';
import { useSelectionStore } from './selectionStore';
import { toast } from './toastStore';

/**
 * Cable-tool interaction state. Serializable ids only — the 3D layer
 * keeps its transient pointer/raycast math to itself. Cancel always
 * restores a clean state; completing a connection creates exactly one
 * validated cable through the cable store.
 */

interface CableToolState {
  /** The pending source port after the first click. */
  sourceEnd: CableEnd | null;
  /** Port currently hovered in the viewport (for preview snapping). */
  hoverEnd: CableEnd | null;

  setSource: (end: CableEnd | null) => void;
  setHover: (end: CableEnd | null) => void;
  /** Attempts to complete the connection; returns the result. */
  completeTo: (end: CableEnd) => CompatResult | null;
  reset: () => void;
}

/** Resolves a serialized end to its PhysicalPort (or null). */
export function resolveEndPort(end: CableEnd) {
  const instance = useDeviceInstancesStore
    .getState()
    .instances.find((i) => i.id === end.deviceInstanceId);
  const definition = instance ? getDevice(instance.definitionId) : undefined;
  if (!instance || !definition) return null;
  const port = findPhysicalPort(definition, end.portRef);
  return port ? { instance, definition, port } : null;
}

/** Pure pair check against current occupancy (shared with the 3D layer). */
export function checkPair(source: CableEnd, dest: CableEnd): CompatResult | null {
  const a = resolveEndPort(source);
  const b = resolveEndPort(dest);
  if (!a || !b) return null;
  const occupancy = occupancyFrom(useCableStore.getState().cables);
  return checkPortPair(source, a.port, dest, b.port, occupancy);
}

export const useCableToolStore = create<CableToolState>()((set, get) => ({
  sourceEnd: null,
  hoverEnd: null,

  setSource: (sourceEnd) => set({ sourceEnd }),
  setHover: (hoverEnd) => set({ hoverEnd }),

  completeTo: (end) => {
    const { sourceEnd } = get();
    if (!sourceEnd) return null;
    const result = checkPair(sourceEnd, end);
    if (!result) return null;

    if (result.level === 'invalid') {
      toast({
        variant: 'warning',
        title: 'Can’t connect these ports',
        description: result.message,
      });
      return result;
    }

    const a = resolveEndPort(sourceEnd)!;
    const b = resolveEndPort(end)!;
    const spec = defaultCableType(a.port, b.port);
    if (!spec) return result;

    // Length is refined by the renderer's first route computation; start
    // from the shortest standard so the recommendation pass can raise it.
    const cable = useCableStore.getState().addCable({
      source: sourceEnd,
      destination: end,
      type: spec.id,
      nominalLengthMm: spec.standardLengthsMm[0],
    });
    set({ sourceEnd: null, hoverEnd: null });
    useSelectionStore.getState().selectCable(cable.id);
    toast({
      variant: 'success',
      title: 'Cable connected',
      description: `${a.definition.productName} ${sourceEnd.portRef} → ${b.definition.productName} ${end.portRef}`,
    });
    return result;
  },

  reset: () => set({ sourceEnd: null, hoverEnd: null }),
}));
