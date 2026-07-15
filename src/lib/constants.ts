export const APP_NAME = 'RackForge';
export const APP_VERSION = '0.1.0';

/** localStorage key for the persisted UI store (also read by the
 *  pre-paint theme script in index.html — keep the two in sync). */
export const UI_STORE_KEY = 'rackforge-ui';

/** Camera defaults for the editor viewport. */
export const CAMERA = {
  position: [8, 6, 10] as [number, number, number],
  fov: 45,
  near: 0.1,
  far: 200,
  minDistance: 2,
  maxDistance: 60,
} as const;
