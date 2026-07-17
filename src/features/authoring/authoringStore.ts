import { create } from 'zustand';
import {
  arrayPorts,
  createLed,
  createPort,
  definitionWithPorts,
  DEFAULT_SNAP,
  ledsFromDefinition,
  metadataJson,
  nextPortId,
  portsFromDefinition,
  round2,
  suggestPorts,
  type ArrayDirection,
  type AuthoredLed,
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
  type CoolingCapabilities,
  type DeviceDefinition,
  type DisplayCapabilities,
  type PortType,
} from '@/features/devices/deviceSchema';
import { useAuthoredDevicesStore } from '@/stores/authoredDevicesStore';
import { toast } from '@/stores/toastStore';

/**
 * Device Authoring session state. Transient by design — the durable
 * output is the metadata JSON produced by save(), which registers the
 * authored definition in the live registry and downloads the file for
 * /public/devices. Nothing here ever touches the GLB.
 */

export type AuthoringTool = 'select' | 'move' | 'rotate' | 'scale';
export type AuthoringMode = 'view' | 'edit';

/** Workspace categories — each switches tools, inspector and context. */
export type AuthoringCategory =
  | 'mount'
  | 'ports'
  | 'anchors'
  | 'power'
  | 'leds'
  | 'displays'
  | 'cooling'
  | 'validation';

/** Port types considered power connectors (Power Connectors category). */
export const POWER_PORT_TYPES: readonly PortType[] = [
  'power',
  'dc',
  'c13',
  'c14',
  'c19',
  'c20',
  'phoenix',
];
export const isPowerType = (type: PortType): boolean =>
  POWER_PORT_TYPES.includes(type);

export interface AuthoringCameraCommand {
  id: number;
  type: 'frame-device' | 'frame-ports';
  face: 'front' | 'rear';
}

/** Undo/redo snapshot: everything an edit can touch. */
interface HistoryEntry {
  ports: AuthoredPort[];
  selection: string[];
  mountOffsetMm: Vec3;
  modelTransform: DeviceDefinition['modelTransform'];
  leds: AuthoredLed[];
  selectedLedId: string | null;
  display: DisplayCapabilities | undefined;
  cooling: CoolingCapabilities | undefined;
  selectedFan: number | null;
}

const HISTORY_LIMIT = 100;

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
  /**
   * The developer accepted or rejected the analysis for this session —
   * suggestions never reappear on their own after a decision.
   */
  suggestionsDecided: boolean;
  /** Active workspace category. */
  category: AuthoringCategory;
  /** Mount correction being authored, device-local mm. */
  mountOffsetMm: Vec3;
  /** Explicit model-transform correction (undefined = keep current). */
  modelTransform: DeviceDefinition['modelTransform'];
  /** Render the device mounted on real rails via the placement engine. */
  mountPreview: boolean;
  /** Authored indicator LEDs. */
  leds: AuthoredLed[];
  selectedLedId: string | null;
  /** Authored display capabilities. */
  display: DisplayCapabilities | undefined;
  /** Authored cooling capabilities. */
  cooling: CoolingCapabilities | undefined;
  /** Selected fan index in cooling.fanPositionsMm. */
  selectedFan: number | null;
  /** Undo/redo stacks. */
  past: HistoryEntry[];
  future: HistoryEntry[];
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
  rejectSuggestions: () => void;
  /** Explicitly re-runs the GLB analysis after a decision. */
  detectPorts: () => void;

  setCategory: (category: AuthoringCategory) => void;
  setMountOffset: (offset: Vec3) => void;
  setModelTransform: (transform: DeviceDefinition['modelTransform']) => void;
  toggleMountPreview: () => void;

  addLed: () => void;
  updateLed: (id: string, patch: Partial<AuthoredLed>) => void;
  /** Gizmo-drag mover — no history entry (beginTransform records it). */
  moveLed: (id: string, positionMm: Vec3) => void;
  renameLed: (id: string, nextId: string) => void;
  deleteLed: (id: string) => void;
  selectLed: (id: string | null) => void;

  updateDisplay: (patch: Partial<DisplayCapabilities> | undefined) => void;
  /** Gizmo-drag movers for the display — no history entry. */
  moveDisplay: (positionMm: Vec3) => void;
  resizeDisplay: (widthMm: number, heightMm: number) => void;
  /** Gizmo-drag mover for a port's cable anchor — no history entry. */
  moveAnchor: (id: string, anchorMm: Vec3) => void;

  updateCooling: (patch: Partial<CoolingCapabilities>) => void;
  addFan: () => void;
  moveFan: (index: number, positionMm: Vec3) => void;
  deleteFan: (index: number) => void;
  selectFan: (index: number | null) => void;

  /** Records the current state before a gizmo drag begins. */
  beginTransform: () => void;
  undo: () => void;
  redo: () => void;

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

export const useAuthoringStore = create<AuthoringState>()((set, get) => {
  /** Snapshot of everything undo must restore. */
  const snapshot = (): HistoryEntry => {
    const s = get();
    return {
      ports: s.ports,
      selection: s.selection,
      mountOffsetMm: s.mountOffsetMm,
      modelTransform: s.modelTransform,
      leds: s.leds,
      selectedLedId: s.selectedLedId,
      display: s.display,
      cooling: s.cooling,
      selectedFan: s.selectedFan,
    };
  };
  /** Push the current state onto the undo stack (clears redo). */
  const remember = () =>
    set((s) => ({
      past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
      future: [],
    }));

  return {
  deviceId: null,
  ports: [],
  selection: [],
  mode: 'edit',
  tool: 'move',
  snap: { ...DEFAULT_SNAP },
  dirty: false,
  suggestions: null,
  suggestionsDecided: false,
  category: 'ports',
  mountOffsetMm: [0, 0, 0],
  modelTransform: undefined,
  mountPreview: false,
  leds: [],
  selectedLedId: null,
  display: undefined,
  cooling: undefined,
  selectedFan: null,
  past: [],
  future: [],
  previewVisible: true,
  previewIntensity: 0.75,
  gridVisible: true,
  cameraCommand: null,

  setCategory: (category) =>
    set((s) => ({
      category,
      // Mount category works on the whole device; the mount preview is
      // its natural home. Leaving keeps whatever the user chose.
      mountPreview: category === 'mount' ? true : s.mountPreview,
    })),

  addLed: () => {
    const definition = get().deviceId ? getDevice(get().deviceId!) : undefined;
    if (!definition) return;
    remember();
    set((s) => {
      const led = createLed(s.leds, definition);
      return { leds: [...s.leds, led], selectedLedId: led.id, dirty: true };
    });
  },
  updateLed: (id, patch) => {
    remember();
    set((s) => ({
      leds: s.leds.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      dirty: true,
    }));
  },
  renameLed: (id, nextId) => {
    const clean = nextId.trim();
    if (!clean || clean === id || get().leds.some((l) => l.id === clean)) return;
    remember();
    set((s) => ({
      leds: s.leds.map((l) => (l.id === id ? { ...l, id: clean } : l)),
      selectedLedId: s.selectedLedId === id ? clean : s.selectedLedId,
      dirty: true,
    }));
  },
  deleteLed: (id) => {
    remember();
    set((s) => ({
      leds: s.leds.filter((l) => l.id !== id),
      selectedLedId: s.selectedLedId === id ? null : s.selectedLedId,
      dirty: true,
    }));
  },
  moveLed: (id, positionMm) =>
    set((s) => ({
      leds: s.leds.map((l) =>
        l.id === id
          ? {
              ...l,
              positionMm: [
                round2(positionMm[0]),
                round2(positionMm[1]),
                round2(positionMm[2]),
              ] as Vec3,
            }
          : l,
      ),
      dirty: true,
    })),
  selectLed: (selectedLedId) => set({ selectedLedId }),

  updateDisplay: (patch) => {
    remember();
    set((s) => ({
      display:
        patch === undefined
          ? undefined
          : { ...(s.display ?? { lcd: true }), ...patch },
      dirty: true,
    }));
  },
  moveDisplay: (positionMm) =>
    set((s) =>
      s.display
        ? {
            display: {
              ...s.display,
              positionMm: [
                round2(positionMm[0]),
                round2(positionMm[1]),
                round2(positionMm[2]),
              ],
            },
            dirty: true,
          }
        : s,
    ),
  resizeDisplay: (widthMm, heightMm) =>
    set((s) =>
      s.display
        ? {
            display: {
              ...s.display,
              widthMm: Math.max(4, round2(widthMm)),
              heightMm: Math.max(4, round2(heightMm)),
            },
            dirty: true,
          }
        : s,
    ),
  moveAnchor: (id, anchorMm) =>
    set((s) => ({
      ports: s.ports.map((p) =>
        p.id === id
          ? {
              ...p,
              anchorMm: [
                round2(anchorMm[0]),
                round2(anchorMm[1]),
                round2(anchorMm[2]),
              ] as Vec3,
            }
          : p,
      ),
      dirty: true,
    })),

  updateCooling: (patch) => {
    remember();
    set((s) => ({ cooling: { ...(s.cooling ?? {}), ...patch }, dirty: true }));
  },
  addFan: () => {
    const definition = get().deviceId ? getDevice(get().deviceId!) : undefined;
    if (!definition) return;
    remember();
    set((s) => {
      const fans = [...(s.cooling?.fanPositionsMm ?? [])];
      fans.push([
        fans.length * 50 - 50,
        0,
        -definition.depthMm / 2,
      ]);
      return {
        cooling: { ...(s.cooling ?? {}), fanPositionsMm: fans },
        selectedFan: fans.length - 1,
        dirty: true,
      };
    });
  },
  moveFan: (index, positionMm) =>
    set((s) => {
      const fans = [...(s.cooling?.fanPositionsMm ?? [])];
      if (!fans[index]) return s;
      fans[index] = [
        round2(positionMm[0]),
        round2(positionMm[1]),
        round2(positionMm[2]),
      ];
      return { cooling: { ...(s.cooling ?? {}), fanPositionsMm: fans }, dirty: true };
    }),
  deleteFan: (index) => {
    remember();
    set((s) => {
      const fans = (s.cooling?.fanPositionsMm ?? []).filter((_, i) => i !== index);
      return {
        cooling: { ...(s.cooling ?? {}), fanPositionsMm: fans },
        selectedFan: null,
        dirty: true,
      };
    });
  },
  selectFan: (selectedFan) => set({ selectedFan }),

  setPreviewVisible: (previewVisible) => set({ previewVisible }),
  setPreviewIntensity: (previewIntensity) => set({ previewIntensity }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleMountPreview: () => set((s) => ({ mountPreview: !s.mountPreview })),
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
      suggestionsDecided: false,
      mountOffsetMm: [...(definition.mountOffsetMm ?? [0, 0, 0])] as Vec3,
      modelTransform: definition.modelTransform,
      leds: ledsFromDefinition(definition),
      selectedLedId: null,
      display: definition.display ? { ...definition.display } : undefined,
      cooling: definition.cooling ? { ...definition.cooling } : undefined,
      selectedFan: null,
      past: [],
      future: [],
    });
    get().refreshSuggestions();
  },

  close: () =>
    set({
      deviceId: null,
      ports: [],
      selection: [],
      suggestions: null,
      suggestionsDecided: false,
      dirty: false,
      past: [],
      future: [],
    }),

  setMountOffset: (offset) => {
    remember();
    set({ mountOffsetMm: [...offset] as Vec3, dirty: true });
  },
  setModelTransform: (transform) => {
    remember();
    set({ modelTransform: transform, dirty: true });
  },

  beginTransform: () => remember(),
  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        past: s.past.slice(0, -1),
        future: [...s.future, snapshot()],
        ...previous,
        dirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1];
      if (!next) return s;
      return {
        future: s.future.slice(0, -1),
        past: [...s.past, snapshot()],
        ...next,
        dirty: true,
      };
    }),

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

  addPort: (type) => {
    remember();
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
    });
  },

  updatePort: (id, patch) => {
    remember();
    set((s) => ({
      ports: s.ports.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      dirty: true,
    }));
  },

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

  renamePort: (id, nextId) => {
    const clean = nextId.trim();
    const s0 = get();
    if (
      !clean ||
      clean === id ||
      s0.ports.some((p) => p.id === clean && p.id !== id)
    ) {
      return;
    }
    remember();
    set((s) => ({
      ports: s.ports.map((p) => (p.id === id ? { ...p, id: clean } : p)),
      selection: s.selection.map((x) => (x === id ? clean : x)),
      dirty: true,
    }));
  },

  duplicateSelection: () => {
    if (get().selection.length > 0) remember();
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
    });
  },

  deleteSelection: () => {
    if (get().selection.length > 0) remember();
    set((s) => ({
      ports: s.ports.filter((p) => !s.selection.includes(p.id)),
      selection: [],
      dirty: s.selection.length > 0 ? true : s.dirty,
    }));
  },

  mirrorSelection: () => {
    if (get().selection.length > 0) remember();
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
    });
  },

  applyArray: (count, spacingMm, direction) => {
    if (get().selection.length > 0 && count >= 1) remember();
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
    });
  },

  refreshSuggestions: () => {
    const { deviceId, ports, suggestionsDecided } = get();
    const definition = deviceId ? getDevice(deviceId) : undefined;
    if (!definition) return;
    // A decision is final for the session — never resurface on reloads
    // or calibration bumps. detectPorts() re-arms explicitly.
    if (suggestionsDecided) return;
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

  applySuggestions: () => {
    if (!get().suggestions) return;
    remember();
    set((s) => {
      if (!s.suggestions) return s;
      return {
        ports: s.suggestions,
        selection: [],
        suggestions: null,
        suggestionsDecided: true,
        dirty: true,
      };
    });
  },

  rejectSuggestions: () =>
    // Rejection is complete: nothing remains, nothing comes back.
    set({ suggestions: null, suggestionsDecided: true }),

  detectPorts: () => {
    set({ suggestionsDecided: false, suggestions: null });
    get().refreshSuggestions();
    if (!get().suggestions) {
      toast({
        variant: 'info',
        title: 'No connector candidates',
        description:
          'The GLB analysis found nothing new to suggest for this model.',
      });
    }
  },

  save: () => {
    const { deviceId, ports, mountOffsetMm, modelTransform, leds, display, cooling } =
      get();
    const base = deviceId ? getDevice(deviceId) : undefined;
    if (!base) return false;

    const authored = definitionWithPorts(base, ports, {
      mountOffsetMm,
      modelTransform,
      leds,
      display,
      cooling,
    });
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
    // Persist in this browser: the definition re-applies on every load.
    useAuthoredDevicesStore
      .getState()
      .saveDefinition(result.value.id, JSON.parse(metadataJson(result.value)));
    // Dev server: also write straight into public/devices in the repo.
    if (import.meta.env.DEV) void writeToDevServer(result.value);
    set({ dirty: false });
    toast({
      variant: 'success',
      title: 'Ports saved',
      description: `${result.value.productName} now loads with this layout everywhere in this browser.`,
    });
    return true;
  },
  };
});

/**
 * Writes the authored metadata into the repository via the dev-server
 * endpoint. Static deployments have no such endpoint — the SPA fallback
 * answers with HTML and this resolves silently; browser persistence
 * already covered the save.
 */
async function writeToDevServer(definition: DeviceDefinition): Promise<void> {
  try {
    const response = await fetch('/__rackforge/save-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: `${definition.manufacturer}/${definition.slug}`,
        metadata: JSON.parse(metadataJson(definition)),
      }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { ok?: boolean; file?: string };
    if (data.ok && data.file) {
      toast({
        variant: 'info',
        title: 'Written to repository',
        description: data.file,
      });
    }
  } catch {
    // No dev endpoint (static hosting) — nothing to do.
  }
}
