/** Theme preference as chosen by the user. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Theme actually applied to the document. */
export type ResolvedTheme = 'light' | 'dark';

/** Viewport interaction tools available in the top toolbar. */
export type EditorTool = 'select' | 'pan' | 'orbit' | 'cable';

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

/** Rack heights offered when creating a rack, in rack units. */
export type RackSize = 6 | 9 | 12 | 18 | 24 | 42;

/** Available rack finishes (material presets). */
export type RackFinishId = 'graphite' | 'steel' | 'sand' | 'midnight';

/** Which face of the rack points toward the default camera. */
export type RackOrientation = 'front' | 'rear';

/** A rack document — the single design object in Milestone 3. */
export interface RackConfig {
  id: string;
  name: string;
  /** Physical rack profile (see features/rack/rackProfiles). */
  profileId: import('@/features/rack/rackProfiles').RackProfileId;
  /**
   * Rail behavior: 'auto' positions the rear rails against the deepest
   * installed device (like a real rack build); 'manual' uses
   * railSpacingMm directly.
   */
  railMode: 'auto' | 'manual';
  /** Manual rail-to-rail spacing; clamped to the profile's range. */
  railSpacingMm: number;
  units: RackSize;
  finish: RackFinishId;
  orientation: RackOrientation;
  showUnitNumbers: boolean;
  showRearPosts: boolean;
  showFloorMarker: boolean;
  createdAt: string;
}

/** A category shown in the device library sidebar. */
export interface LibraryCategory {
  id: string;
  label: string;
  description: string;
  /** Number of available devices (0 until the device library ships). */
  count: number;
}
