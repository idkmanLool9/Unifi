import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CAMERA, VIEW_SETTINGS_STORE_KEY } from '@/lib/constants';

export type MeasurementUnits = 'metric' | 'imperial';

interface ViewSettingsState {
  gridVisible: boolean;
  snapEnabled: boolean;
  shadowsEnabled: boolean;
  /** Screen-space ambient occlusion (N8AO post pass). */
  aoEnabled: boolean;
  hintsVisible: boolean;
  units: MeasurementUnits;
  fov: number;
  /** Key light intensity multiplier (0–2, 1 = default rig). */
  keyLightIntensity: number;
  /** Ambient/fill intensity multiplier (0–2, 1 = default rig). */
  ambientIntensity: number;
  /** Camera feel: speed multipliers (0.25–3, 1 = default). */
  zoomSpeed: number;
  orbitSpeed: number;
  panSpeed: number;
  /** Reverse the dolly direction of wheel/pinch. */
  invertZoom: boolean;
  /** Dolly toward the pointer instead of the orbit center (CAD-style). */
  zoomToPointer: boolean;
  /** Fade rack structure that blocks the view during close-ups. */
  fadeObstructions: boolean;

  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleShadows: () => void;
  toggleAO: () => void;
  toggleHints: () => void;
  setUnits: (units: MeasurementUnits) => void;
  setFov: (fov: number) => void;
  setKeyLightIntensity: (value: number) => void;
  setAmbientIntensity: (value: number) => void;
  setZoomSpeed: (value: number) => void;
  setOrbitSpeed: (value: number) => void;
  setPanSpeed: (value: number) => void;
  toggleInvertZoom: () => void;
  toggleZoomToPointer: () => void;
  toggleFadeObstructions: () => void;
}

/**
 * User-tunable presentation settings for the 3D viewport. Written from the
 * inspector and status bar, consumed by the scene. Persisted so the
 * workspace feels stable across sessions.
 */
export const useViewSettingsStore = create<ViewSettingsState>()(
  persist(
    (set) => ({
      gridVisible: true,
      snapEnabled: true,
      shadowsEnabled: true,
      aoEnabled: true,
      hintsVisible: true,
      units: 'metric',
      fov: CAMERA.fov,
      keyLightIntensity: 1,
      ambientIntensity: 1,
      zoomSpeed: 1,
      orbitSpeed: 1,
      panSpeed: 1,
      invertZoom: false,
      zoomToPointer: true,
      fadeObstructions: true,

      toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
      toggleShadows: () => set((s) => ({ shadowsEnabled: !s.shadowsEnabled })),
      toggleAO: () => set((s) => ({ aoEnabled: !s.aoEnabled })),
      toggleHints: () => set((s) => ({ hintsVisible: !s.hintsVisible })),
      setUnits: (units) => set({ units }),
      setFov: (fov) => set({ fov }),
      setKeyLightIntensity: (keyLightIntensity) => set({ keyLightIntensity }),
      setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
      setZoomSpeed: (zoomSpeed) => set({ zoomSpeed }),
      setOrbitSpeed: (orbitSpeed) => set({ orbitSpeed }),
      setPanSpeed: (panSpeed) => set({ panSpeed }),
      toggleInvertZoom: () => set((s) => ({ invertZoom: !s.invertZoom })),
      toggleZoomToPointer: () =>
        set((s) => ({ zoomToPointer: !s.zoomToPointer })),
      toggleFadeObstructions: () =>
        set((s) => ({ fadeObstructions: !s.fadeObstructions })),
    }),
    { name: VIEW_SETTINGS_STORE_KEY },
  ),
);
