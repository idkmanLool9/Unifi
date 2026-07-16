import { create } from 'zustand';

/** What is currently selected in the editor. */
export type Selection =
  | { kind: 'rack' }
  | { kind: 'device'; instanceId: string }
  | { kind: 'cable'; cableId: string }
  | null;

interface SelectionState {
  selection: Selection;
  selectRack: () => void;
  selectDevice: (instanceId: string) => void;
  selectCable: (cableId: string) => void;
  clear: () => void;
}

/**
 * Unified editor selection (rack, a mounted device, or a cable).
 * Transient — selection never persists across sessions.
 */
export const useSelectionStore = create<SelectionState>()((set) => ({
  selection: null,
  selectRack: () => set({ selection: { kind: 'rack' } }),
  selectDevice: (instanceId) =>
    set({ selection: { kind: 'device', instanceId } }),
  selectCable: (cableId) => set({ selection: { kind: 'cable', cableId } }),
  clear: () => set({ selection: null }),
}));

export const isRackSelected = (s: SelectionState): boolean =>
  s.selection?.kind === 'rack';

export const selectedDeviceInstanceId = (s: SelectionState): string | null =>
  s.selection?.kind === 'device' ? s.selection.instanceId : null;
