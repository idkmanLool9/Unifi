import { create } from 'zustand';
import type {
  CameraCommand,
  CameraCommandInput,
  CameraView,
  ViewportStats,
} from '@/types';

interface ViewportState extends ViewportStats {
  /** Last camera command dispatched from the UI; consumed by CameraRig. */
  command: CameraCommand | null;
  /** The view the camera is currently in (for status display). */
  activeView: CameraView;

  setStats: (stats: ViewportStats) => void;
  setActiveView: (view: CameraView) => void;
  dispatchCamera: (command: CameraCommandInput) => void;
}

let commandId = 0;

/**
 * Transient, non-persisted viewport state: render statistics written by the
 * stats probe (throttled), and one-shot camera commands flowing from UI
 * chrome (nav widget, inspector quick actions) into the R3F scene. Kept
 * separate from persisted stores so high-frequency updates stay cheap.
 */
export const useViewportStore = create<ViewportState>()((set) => ({
  fps: 0,
  triangles: 0,
  drawCalls: 0,
  command: null,
  activeView: 'perspective',

  setStats: (stats) => set(stats),
  setActiveView: (activeView) => set({ activeView }),
  dispatchCamera: (command) => {
    const stamped: CameraCommand = { ...command, id: ++commandId };
    set({ command: stamped });
  },
}));
