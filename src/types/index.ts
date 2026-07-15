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

/** A category shown in the device library sidebar. */
export interface LibraryCategory {
  id: string;
  label: string;
  /** Number of available devices (0 until the device library ships). */
  count: number;
}
