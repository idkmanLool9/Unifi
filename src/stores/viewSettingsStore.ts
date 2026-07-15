import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CAMERA, VIEW_SETTINGS_STORE_KEY } from '@/lib/constants';

interface ViewSettingsState {
  gridVisible: boolean;
  snapEnabled: boolean;
  shadowsEnabled: boolean;
  /** Screen-space ambient occlusion (N8AO post pass). */
  aoEnabled: boolean;
  hintsVisible: boolean;
  fov: number;
  /** Key light intensity multiplier (0–2, 1 = default rig). */
  keyLightIntensity: number;
  /** Ambient/fill intensity multiplier (0–2, 1 = default rig). */
  ambientIntensity: number;

  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleShadows: () => void;
  toggleAO: () => void;
  toggleHints: () => void;
  setFov: (fov: number) => void;
  setKeyLightIntensity: (value: number) => void;
  setAmbientIntensity: (value: number) => void;
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
      fov: CAMERA.fov,
      keyLightIntensity: 1,
      ambientIntensity: 1,

      toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
      toggleShadows: () => set((s) => ({ shadowsEnabled: !s.shadowsEnabled })),
      toggleAO: () => set((s) => ({ aoEnabled: !s.aoEnabled })),
      toggleHints: () => set((s) => ({ hintsVisible: !s.hintsVisible })),
      setFov: (fov) => set({ fov }),
      setKeyLightIntensity: (keyLightIntensity) => set({ keyLightIntensity }),
      setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
    }),
    { name: VIEW_SETTINGS_STORE_KEY },
  ),
);
