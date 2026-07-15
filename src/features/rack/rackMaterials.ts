import { CanvasTexture, MeshPhysicalMaterial } from 'three';
import { createNoiseTexture } from './rackTextures';
import type { RackFinish } from './rackConstants';

export interface RackMaterialSet {
  /** Structural frame: beams, caps, base. */
  frame: MeshPhysicalMaterial;
  /** Upright columns and mounting flanges. */
  upright: MeshPhysicalMaterial;
  /** Base plinth (slightly duller than the frame). */
  plinth: MeshPhysicalMaterial;
  /** Fasteners and leveling feet — dark bare steel. */
  hardware: MeshPhysicalMaterial;
  dispose: () => void;
}

// One shared orange-peel noise map for every material instance.
let noise: CanvasTexture | null = null;
function getNoise(): CanvasTexture {
  noise ??= createNoiseTexture();
  return noise;
}

/**
 * Builds the physical material set for a rack finish. Painted finishes
 * get a powder-coat response: dielectric base, noise-modulated roughness,
 * faint orange-peel bump and a soft clearcoat. Bare-metal finishes skip
 * the coat and lean on metalness + environment reflections.
 */
export function createRackMaterials(finish: RackFinish): RackMaterialSet {
  const map = getNoise();

  const common = finish.painted
    ? {
        metalness: 0.42,
        roughness: 0.58,
        roughnessMap: map,
        bumpMap: map,
        bumpScale: 0.0012,
        clearcoat: 0.16,
        clearcoatRoughness: 0.42,
        envMapIntensity: 1.15,
      }
    : {
        metalness: 0.92,
        roughness: 0.34,
        roughnessMap: map,
        bumpMap: map,
        bumpScale: 0.0006,
        envMapIntensity: 1.05,
      };

  const frame = new MeshPhysicalMaterial({ color: finish.frame, ...common });
  const upright = new MeshPhysicalMaterial({
    color: finish.upright,
    ...common,
  });
  const plinth = new MeshPhysicalMaterial({
    color: finish.frame,
    ...common,
    roughness: Math.min(1, common.roughness + 0.14),
    envMapIntensity: common.envMapIntensity * 0.8,
  });
  const hardware = new MeshPhysicalMaterial({
    color: '#1d1f23',
    metalness: 0.85,
    roughness: 0.4,
    envMapIntensity: 0.9,
  });

  return {
    frame,
    upright,
    plinth,
    hardware,
    dispose: () => {
      frame.dispose();
      upright.dispose();
      plinth.dispose();
      hardware.dispose();
    },
  };
}
