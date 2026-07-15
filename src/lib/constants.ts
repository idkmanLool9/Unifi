import type { ViewPreset } from '@/types';

export const APP_NAME = 'RackForge';
export const APP_VERSION = '0.1.0';

/** localStorage key for the persisted UI store (also read by the
 *  pre-paint theme script in index.html — keep the two in sync). */
export const UI_STORE_KEY = 'rackforge-ui';

/** localStorage key for persisted viewport/view settings. */
export const VIEW_SETTINGS_STORE_KEY = 'rackforge-view';

/** localStorage key for the persisted rack document. */
export const RACK_STORE_KEY = 'rackforge-rack';

/** Camera defaults for the editor viewport. */
export const CAMERA = {
  position: [8, 6, 10] as const,
  target: [0, 1, 0] as const,
  fov: 45,
  minFov: 20,
  maxFov: 90,
  near: 0.1,
  far: 200,
  minDistance: 2,
  maxDistance: 60,
} as const;

/** Camera pose for each view preset: [position, target]. */
export const VIEW_POSES: Record<
  ViewPreset,
  { position: readonly [number, number, number]; target: readonly [number, number, number] }
> = {
  perspective: { position: CAMERA.position, target: CAMERA.target },
  top: { position: [0, 16, 0.001], target: [0, 0, 0] },
  front: { position: [0, 2, 13], target: [0, 1.5, 0] },
  back: { position: [0, 2, -13], target: [0, 1.5, 0] },
  left: { position: [-13, 2, 0], target: [0, 1.5, 0] },
  right: { position: [13, 2, 0], target: [0, 1.5, 0] },
};
