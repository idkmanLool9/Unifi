/** Theme preference as chosen by the user. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Theme actually applied to the document. */
export type ResolvedTheme = 'light' | 'dark';

/** Viewport interaction tools available in the top toolbar. */
export type EditorTool = 'select' | 'pan' | 'orbit';

/** Live rendering statistics reported by the 3D viewport. */
export interface ViewportStats {
  fps: number;
  triangles: number;
  drawCalls: number;
}

/** Standard camera view presets offered by the viewport nav widget. */
export type ViewPreset =
  | 'perspective'
  | 'top'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

/** Current camera state: a named preset, or free orbit after user input. */
export type CameraView = ViewPreset | 'custom';

/** Commands dispatched from UI chrome to the camera rig inside the canvas. */
export type CameraCommandInput =
  | { type: 'preset'; view: ViewPreset }
  | { type: 'fit' }
  | { type: 'reset' };

/** A dispatched command, stamped with a nonce so repeats re-trigger. */
export type CameraCommand = CameraCommandInput & { id: number };

/** A category shown in the device library sidebar. */
export interface LibraryCategory {
  id: string;
  label: string;
  description: string;
  /** Number of available devices (0 until the device library ships). */
  count: number;
}
