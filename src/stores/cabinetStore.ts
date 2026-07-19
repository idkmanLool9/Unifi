import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CABINET_STORE_KEY } from '@/lib/constants';
import {
  closeAllDoors as closeAllDoorsFn,
  defaultInstance,
  hideAllPanels as hideAllPanelsFn,
  interiorParts,
  maintenanceParts,
  openAllDoors as openAllDoorsFn,
  restoreParts,
  type CabinetInstance,
  type CabinetMode,
  type PartRuntime,
  type TransparencyMode,
} from '@/features/cabinet/cabinetRuntime';
import type { CabinetModelDef, CabinetPartState } from '@/features/cabinet/cabinetSchema';

/**
 * Per-rack cabinet interaction state — which doors are open, which panels
 * are off, the active view mode and transparency. Keyed by rack id and
 * persisted, so a project reopens with the enclosure exactly as it was
 * left. All state changes go through here; the renderer and the Cabinet
 * menu are pure consumers.
 */
interface CabinetStoreState {
  instances: Record<string, CabinetInstance>;

  /** Read the instance for a rack, creating it from the model defaults. */
  ensure: (rackId: string, model: CabinetModelDef) => CabinetInstance;

  setPartState: (
    rackId: string,
    model: CabinetModelDef,
    partId: string,
    state: CabinetPartState,
  ) => void;
  setDoorAngle: (
    rackId: string,
    model: CabinetModelDef,
    partId: string,
    deg: number,
  ) => void;
  setPartOpacity: (
    rackId: string,
    model: CabinetModelDef,
    partId: string,
    pct: number | undefined,
  ) => void;

  openAllDoors: (rackId: string, model: CabinetModelDef) => void;
  closeAllDoors: (rackId: string, model: CabinetModelDef) => void;
  hideAllPanels: (rackId: string, model: CabinetModelDef) => void;
  restore: (rackId: string, model: CabinetModelDef) => void;

  setMode: (rackId: string, model: CabinetModelDef, mode: CabinetMode) => void;
  setTransparency: (
    rackId: string,
    model: CabinetModelDef,
    transparency: TransparencyMode,
  ) => void;
  setAnimationSpeed: (
    rackId: string,
    model: CabinetModelDef,
    speed: number,
  ) => void;
}

export const useCabinetStore = create<CabinetStoreState>()(
  persist(
    (set, get) => {
      /** Current instance (never mutates state) or a fresh default. */
      const read = (rackId: string, model: CabinetModelDef): CabinetInstance =>
        get().instances[rackId] ?? defaultInstance(model);

      const write = (rackId: string, next: CabinetInstance) =>
        set((s) => ({ instances: { ...s.instances, [rackId]: next } }));

      const patchParts = (
        rackId: string,
        model: CabinetModelDef,
        parts: Record<string, PartRuntime>,
      ) => write(rackId, { ...read(rackId, model), parts });

      return {
        instances: {},

        ensure: (rackId, model) => {
          const existing = get().instances[rackId];
          if (existing) return existing;
          const fresh = defaultInstance(model);
          write(rackId, fresh);
          return fresh;
        },

        setPartState: (rackId, model, partId, state) => {
          const inst = read(rackId, model);
          patchParts(rackId, model, {
            ...inst.parts,
            [partId]: { ...inst.parts[partId], state },
          });
        },

        setDoorAngle: (rackId, model, partId, deg) => {
          const inst = read(rackId, model);
          patchParts(rackId, model, {
            ...inst.parts,
            [partId]: {
              ...inst.parts[partId],
              angleDeg: deg,
              // Any non-zero angle implies the door is open.
              state: deg > 0.5 ? 'open' : 'closed',
            },
          });
        },

        setPartOpacity: (rackId, model, partId, pct) => {
          const inst = read(rackId, model);
          patchParts(rackId, model, {
            ...inst.parts,
            [partId]: { ...inst.parts[partId], opacityPct: pct },
          });
        },

        openAllDoors: (rackId, model) =>
          patchParts(rackId, model, openAllDoorsFn(model, read(rackId, model).parts)),
        closeAllDoors: (rackId, model) =>
          patchParts(rackId, model, closeAllDoorsFn(model, read(rackId, model).parts)),
        hideAllPanels: (rackId, model) =>
          patchParts(rackId, model, hideAllPanelsFn(model, read(rackId, model).parts)),

        restore: (rackId, model) =>
          write(rackId, {
            ...read(rackId, model),
            mode: 'normal',
            transparency: 'off',
            parts: restoreParts(model),
          }),

        setMode: (rackId, model, mode) => {
          const inst = read(rackId, model);
          // Interior/Maintenance also stage the parts; Normal/Exploded are
          // pure view modes that leave the saved part states untouched.
          const parts =
            mode === 'interior'
              ? interiorParts(model, inst.parts)
              : mode === 'maintenance'
                ? maintenanceParts(model, inst.parts)
                : inst.parts;
          write(rackId, { ...inst, mode, parts });
        },

        setTransparency: (rackId, model, transparency) =>
          write(rackId, { ...read(rackId, model), transparency }),

        setAnimationSpeed: (rackId, model, speed) =>
          write(rackId, {
            ...read(rackId, model),
            animationSpeed: Math.min(3, Math.max(0.25, speed)),
          }),
      };
    },
    { name: CABINET_STORE_KEY, version: 1 },
  ),
);
