import { create } from 'zustand';
import {
  arrayPorts,
  createPort,
  definitionWithPorts,
  DEFAULT_SNAP,
  metadataJson,
  nextPortId,
  portsFromDefinition,
  round2,
  suggestPorts,
  type ArrayDirection,
  type AuthoredPort,
  type SnapSettings,
  type Vec3,
} from './authoringModel';
import {
  detectedConnectors,
  primeCalibration,
  useCalibrationStore,
} from '@/features/devices/hardware/connectorCalibration';
import { getDevice, registerDevice } from '@/features/devices/deviceRegistry';
import {
  validateDeviceDefinition,
  type PortType,
} from '@/features/devices/deviceSchema';
import { toast } from '@/stores/toastStore';

/**
 * Device Authoring session state. Transient by design — the durable
 * output is the metadata JSON produced by save(), which registers the
 * authored definition in the live registry and downloads the file for
 * /public/devices. Nothing here ever touches the GLB.
 */

export type AuthoringTool = 'select' | 'move' | 'rotate' | 'scale';
export type AuthoringMode = 'view' | 'edit';

export interface AuthoringCameraCommand {
  id: number;
  type: 'frame-device' | 'frame-ports';
  face: 'front' | 'rear';
}

interface AuthoringState {
  /** Definition id being authored, or null when the mode is closed. */
  deviceId: string | null;
  ports: AuthoredPort[];
  /** Selected port ids; the last entry is the primary (gizmo) target. */
  selection: string[];
  mode: AuthoringMode;
  tool: AuthoringTool;
  snap: SnapSettings;
  /** Unsaved changes exist. */
  dirty: boolean;
  /** GLB-analysis suggestions awaiting an explicit user decision. */
  suggestions: AuthoredPort[] | null;
  /** Show the translucent cavity previews in the viewport. */
  previewVisible: boolean;
  /** Cavity preview strength, 0..1. */
  previewIntensity: number;
  /** Floor grid visibility in the authoring viewport. */
  gridVisible: boolean;
  /** One-shot camera command consumed by the viewport. */
  cameraCommand: AuthoringCameraCommand | null;

  open: (deviceId: string) => void;
  close: () => void;
  /** Re-derives ports from the definition (e.g. after calibration). */
  reload: () => void;
  setPreviewVisible: (visible: boolean) => void;
  setPreviewIntensity: (intensity: number) => void;
  toggleGrid: () => void;
  dispatchCamera: (command: Omit<AuthoringCameraCommand, 'id'>) => void;
  setMode: (mode: AuthoringMode) => void;
  setTool: (tool: AuthoringTool) => void;
  setSnap: (patch: Partial<SnapSettings>) => void;

  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  addPort: (type: PortType) => void;
  updatePort: (id: string, patch: Partial<AuthoredPort>) => void;
  movePort: (id: string, positionMm: Vec3) => void;
  renamePort: (id: string, nextId: string) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  /** Adds mirrored copies of the selection across the faceplate center. */
  mirrorSelection: () => void;
  applyArray: (count: number, spacingMm: number, direction: ArrayDirection) => void;

  refreshSuggestions: () => void;
  applySuggestions: () => void;
  dismissSuggestions: () => void;

  save: () => boolean;
}

/** Selected ports in selection order (last = primary). */
export const selectedPorts = (s: {
  ports: AuthoredPort[];
  selection: string[];
}): AuthoredPort[] =>
  s.selection
    .map((id) => s.ports.find((p) => p.id === id))
    .filter((p): p is AuthoredPort => p !== undefined);

export const primaryPort = (s: {
  ports: AuthoredPort[];
  selection: string[];
}): AuthoredPort | null => {
  const id = s.selection[s.selection.length - 1];
  return s.ports.find((p) => p.id === id) ?? null;
};

export const useAuthoringStore = create<AuthoringState>()((set, get) => ({
  deviceId: null,
  ports: [],
  selection: [],
  mode: 'edit',
  tool: 'move',
  snap: { ...DEFAULT_SNAP },
  dirty: false,
  suggestions: null,
  previewVisible: true,
  previewIntensity: 0.75,
  gridVisible: true,
  cameraCommand: null,

  setPreviewVisible: (previewVisible) => set({ previewVisible }),
  setPreviewIntensity: (previewIntensity) => set({ previewIntensity }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  dispatchCamera: (command) =>
    set((s) => ({
      cameraCommand: { ...command, id: (s.cameraCommand?.id ?? 0) + 1 },
    })),

  reload: () => {
    const { deviceId } = get();
    if (deviceId) get().open(deviceId);
  },

  open: (deviceId) => {
    const definition = getDevice(deviceId);
    if (!definition) return;
    set({
      deviceId,
      ports: portsFromDefinition(definition),
      selection: [],
      mode: 'edit',
      tool: 'move',
      dirty: false,
      suggestions: null,
    });
    get().refreshSuggestions();
  },

  close: () =>
    set({ deviceId: null, ports: [], selection: [], suggestions: null, dirty: false }),

  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),

  select: (id, additive = false) =>
    set((s) => {
      if (!additive) return { selection: [id] };
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] };
    }),
  selectMany: (ids) => set({ selection: ids }),
  clearSelection: () => set({ selection: [] }),

  addPort: (type) =>
    set((s) => {
      const definition = s.deviceId ? getDevice(s.deviceId) : undefined;
      if (!definition) return s;
      const port = createPort(s.ports, type, definition);
      return {
        ports: [...s.ports, port],
        selection: [port.id],
        dirty: true,
        mode: 'edit' as const,
      };
    }),

  updatePort: (id, patch) =>
    set((s) => ({
      ports: s.ports.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      dirty: true,
    })),

  movePort: (id, positionMm) =>
    set((s) => ({
      ports: s.ports.map((p) =>
        p.id === id
          ? {
              ...p,
              positionMm: [
                round2(positionMm[0]),
                round2(positionMm[1]),
                round2(positionMm[2]),
              ] as Vec3,
            }
          : p,
      ),
      dirty: true,
    })),

  renamePort: (id, nextId) =>
    set((s) => {
      const clean = nextId.trim();
      if (!clean || s.ports.some((p) => p.id === clean && p.id !== id)) return s;
      return {
        ports: s.ports.map((p) => (p.id === id ? { ...p, id: clean } : p)),
        selection: s.selection.map((x) => (x === id ? clean : x)),
        dirty: true,
      };
    }),

  duplicateSelection: () =>
    set((s) => {
      const selected = selectedPorts(s);
      if (selected.length === 0) return s;
      const pool = [...s.ports];
      const clones = selected.map((port) => {
        const clone: AuthoredPort = {
          ...port,
          id: nextPortId(pool, port.type),
          label: undefined,
          positionMm: [
            round2(port.positionMm[0] + port.sizeMm[0] * 1.2),
            port.positionMm[1],
            port.positionMm[2],
          ] as Vec3,
          rotationDeg: [...port.rotationDeg] as Vec3,
          sizeMm: [...port.sizeMm] as [number, number],
          anchorMm: [...port.anchorMm] as Vec3,
        };
        pool.push(clone);
        return clone;
      });
      return {
        ports: pool,
        selection: clones.map((c) => c.id),
        dirty: true,
      };
    }),

  deleteSelection: () =>
    set((s) => ({
      ports: s.ports.filter((p) => !s.selection.includes(p.id)),
      selection: [],
      dirty: s.selection.length > 0 ? true : s.dirty,
    })),

  mirrorSelection: () =>
    set((s) => {
      const selected = selectedPorts(s);
      if (selected.length === 0) return s;
      const pool = [...s.ports];
      const created: string[] = [];
      for (const port of selected) {
        const clone: AuthoredPort = {
          ...port,
          id: nextPortId(pool, port.type),
          label: undefined,
          positionMm: [
            -port.positionMm[0],
            port.positionMm[1],
            port.positionMm[2],
          ],
          rotationDeg: [...port.rotationDeg],
          sizeMm: [...port.sizeMm],
          anchorMm: [-port.anchorMm[0], port.anchorMm[1], port.anchorMm[2]],
        };
        pool.push(clone);
        created.push(clone.id);
      }
      return { ports: pool, selection: created, dirty: true };
    }),

  applyArray: (count, spacingMm, direction) =>
    set((s) => {
      const selected = selectedPorts(s);
      if (selected.length === 0 || count < 1) return s;
      let pool = [...s.ports];
      const created: string[] = [];
      for (const port of selected) {
        const copies = arrayPorts(pool, port, count, spacingMm, direction);
        pool = [...pool, ...copies];
        created.push(...copies.map((c) => c.id));
      }
      return { ports: pool, selection: created, dirty: true };
    }),

  refreshSuggestions: () => {
    const { deviceId, ports } = get();
    const definition = deviceId ? getDevice(deviceId) : undefined;
    if (!definition) return;
    const detected = detectedConnectors(definition.id);
    if (detected.length === 0) {
      set({ suggestions: null });
      return;
    }
    const suggested = suggestPorts(detected);
    // Only offer when the analysis would actually add information — a
    // port set that already matches the detected count (calibration
    // baked it in, or the developer authored it) needs no suggestion.
    set({
      suggestions:
        suggested.length > 0 && suggested.length !== ports.length
          ? suggested
          : null,
    });
  },

  applySuggestions: () =>
    set((s) => {
      if (!s.suggestions) return s;
      return {
        ports: s.suggestions,
        selection: [],
        suggestions: null,
        dirty: true,
      };
    }),

  dismissSuggestions: () => set({ suggestions: null }),

  save: () => {
    const { deviceId, ports } = get();
    const base = deviceId ? getDevice(deviceId) : undefined;
    if (!base) return false;

    const authored = definitionWithPorts(base, ports);
    // Round-trip through the validator: what we register is exactly what
    // a metadata.json drop-in would produce.
    const result = validateDeviceDefinition(
      JSON.parse(metadataJson(authored)),
    );
    if (!result.ok) {
      toast({
        variant: 'warning',
        title: 'Metadata failed validation',
        description: result.issues[0]
          ? `${result.issues[0].path}: ${result.issues[0].message}`
          : 'Unknown validation issue',
      });
      return false;
    }

    registerDevice(result.value);
    // Authored positions are ground truth from now on.
    primeCalibration(base.id, new Map());
    useCalibrationStore.getState().bump();
    set({ dirty: false });
    return true;
  },
}));
