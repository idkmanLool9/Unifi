import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { ChassisFinish } from './stylePresets';

/**
 * Procedural material library for generated chassis. Materials are
 * module-cached by (color, finish, role) so every generated device on
 * screen shares GPU programs and uniforms; nothing is created per
 * frame and nothing needs disposal on unmount.
 */

const FINISH_PARAMS: Record<
  ChassisFinish,
  { metalness: number; roughness: number }
> = {
  brushed: { metalness: 0.85, roughness: 0.3 },
  powder: { metalness: 0.6, roughness: 0.5 },
  plastic: { metalness: 0.22, roughness: 0.62 },
};

type Role = 'body' | 'face' | 'detail';

const standardCache = new Map<string, MeshStandardMaterial>();

/** Chassis paint: the face reads slightly smoother than the body. */
export function chassisMaterial(
  color: string,
  finish: ChassisFinish,
  role: Role,
): MeshStandardMaterial {
  const key = `${color}|${finish}|${role}`;
  let material = standardCache.get(key);
  if (!material) {
    const base = FINISH_PARAMS[finish];
    material = new MeshStandardMaterial({
      color,
      metalness: role === 'detail' ? base.metalness * 0.7 : base.metalness,
      roughness:
        role === 'face'
          ? Math.max(0.16, base.roughness - 0.08)
          : role === 'detail'
            ? Math.min(0.9, base.roughness + 0.15)
            : base.roughness,
      envMapIntensity: role === 'face' ? 1.05 : 0.9,
    });
    standardCache.set(key, material);
  }
  return material;
}

/** Flat-tinted utility materials, cached by color. */
export function tintedMaterial(
  color: string,
  over: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const key = `tint|${color}|${over.metalness ?? ''}|${over.roughness ?? ''}`;
  let material = standardCache.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      metalness: over.metalness ?? 0.5,
      roughness: over.roughness ?? 0.5,
    });
    standardCache.set(key, material);
  }
  return material;
}

/* Fixed shared materials. */

export const SCREW_MATERIAL = new MeshStandardMaterial({
  color: '#8d939b',
  metalness: 0.92,
  roughness: 0.34,
});

export const RUBBER_MATERIAL = new MeshStandardMaterial({
  color: '#131417',
  metalness: 0.05,
  roughness: 0.92,
});

export const VENT_CAVITY_MATERIAL = new MeshStandardMaterial({
  color: '#07080a',
  metalness: 0.2,
  roughness: 0.85,
});

export const CONTACT_MATERIAL = new MeshStandardMaterial({
  color: '#c9a86a',
  metalness: 0.95,
  roughness: 0.28,
});

export const BRUSH_MATERIAL = new MeshStandardMaterial({
  color: '#131519',
  metalness: 0.02,
  roughness: 0.98,
});

/** Powered-off glass (drawer fronts, button caps). */
export const GLASS_MATERIAL = new MeshPhysicalMaterial({
  color: '#0a0d12',
  metalness: 0.1,
  roughness: 0.14,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
});
