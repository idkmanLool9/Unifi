import { useMemo } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { MM_TO_M } from '@/features/rack/rackMath';
import type { Vec3 } from './anchors';
import type { PhysicalConnectorType } from '@/features/devices/hardware/physicalPorts';

/**
 * Procedural cable connectors. The RJ45 plug is a real 8P8C body:
 * translucent polycarbonate housing with visible gold contacts, the
 * sprung latch on top, a metal shield collar and a colored strain-relief
 * boot — proportioned from a genuine plug (11.7 × 8.3 mm body). Built
 * once from shared unit geometries and materials; each cable end is a
 * transformed instance group.
 *
 * Plug-local space: -Z is the insertion direction (the nose points
 * toward -Z), the origin sits at the nose tip, the latch is on +Y.
 * Placement inserts the nose `insertionMm` beyond the port surface, so
 * connectors visually slide INTO the jack exactly like real hardware.
 */

/* ---- real-world dimensions (mm) -------------------------------------- */

export const RJ45_BODY = { w: 11.7, h: 8.3, len: 21 };
/** Default nose insertion depth into the jack, mm, per connector class. */
export const DEFAULT_INSERTION_MM: Partial<
  Record<PhysicalConnectorType, number>
> = {
  rj45: 13,
  keystone: 13,
  'poe-in': 13,
  console: 13,
};
export const GENERIC_INSERTION_MM = 8;
/** Boot length past the plug body, mm. */
export const BOOT_LEN = 16;

/** Distance from the port surface to where the cable sheath begins. */
export function cableStartOffsetMm(
  type: PhysicalConnectorType,
  insertionMm: number | undefined,
): number {
  const insertion =
    insertionMm ?? DEFAULT_INSERTION_MM[type] ?? GENERIC_INSERTION_MM;
  return RJ45_BODY.len - insertion + BOOT_LEN * 0.85;
}

/* ---- shared GPU resources -------------------------------------------- */

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const BOOT_GEOMETRY = new CylinderGeometry(0.62, 1, 1, 12);
BOOT_GEOMETRY.rotateX(Math.PI / 2); // axis onto Z
const COLLAR_GEOMETRY = new CylinderGeometry(1, 1, 1, 12);
COLLAR_GEOMETRY.rotateX(Math.PI / 2);

const HOUSING_MATERIAL = new MeshPhysicalMaterial({
  color: '#c8cdd4',
  transparent: true,
  opacity: 0.45,
  roughness: 0.18,
  metalness: 0.05,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2,
  depthWrite: false,
});
const CONTACT_MATERIAL = new MeshStandardMaterial({
  color: '#d8a944',
  metalness: 0.95,
  roughness: 0.3,
});
const SHIELD_MATERIAL = new MeshStandardMaterial({
  color: '#9aa2ab',
  metalness: 0.9,
  roughness: 0.35,
});

const bootMaterials = new Map<string, MeshStandardMaterial>();
export function bootMaterial(color: string): MeshStandardMaterial {
  let material = bootMaterials.get(color);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.05,
    });
    bootMaterials.set(color, material);
  }
  return material;
}

const mm = (v: number) => v * MM_TO_M;
const Z_AXIS = new Vector3(0, 0, 1);

/** Quaternion turning plug-local +Z onto the port's exit direction. */
export function plugQuaternion(exitDir: Vec3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    Z_AXIS,
    new Vector3(...exitDir).normalize(),
  );
}

/**
 * Like plugQuaternion, but with plug-local +Y following the port's own
 * (rotated) up vector — rolling a port in Device Authoring rolls the
 * seated plug and connector with it.
 */
export function plugQuaternionOriented(exitDir: Vec3, upHint: Vec3): Quaternion {
  const z = new Vector3(...exitDir).normalize();
  const y = new Vector3(...upHint);
  // Orthonormalize the hint against the exit axis.
  y.addScaledVector(z, -y.dot(z));
  if (y.lengthSq() < 1e-10) y.set(0, 1, 0).addScaledVector(z, -z.y);
  y.normalize();
  const x = new Vector3().crossVectors(y, z);
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, z),
  );
}

interface Rj45PlugProps {
  /** Boot / cable color. */
  color: string;
  /** Cable sheath radius, meters (boot tapers down to meet it). */
  cableRadiusM: number;
}

/**
 * The plug body, nose at the local origin, boot toward +Z. Wrap in a
 * group positioned at (surface - exit * insertion) and rotated with
 * plugQuaternion(exitDir).
 */
export function Rj45Plug({ color, cableRadiusM }: Rj45PlugProps) {
  const { w, h, len } = RJ45_BODY;
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.45, mm(3.4));

  return (
    <group>
      {/* Translucent housing (nose 0 → body length toward +Z) */}
      <mesh
        geometry={UNIT_BOX}
        material={HOUSING_MATERIAL}
        position={[0, 0, mm(len / 2)]}
        scale={[mm(w), mm(h), mm(len)]}
      />
      {/* Gold contact comb just behind the nose face, on the -Y side */}
      <mesh
        geometry={UNIT_BOX}
        material={CONTACT_MATERIAL}
        position={[0, mm(-h / 2 + 1.4), mm(3.4)]}
        scale={[mm(w * 0.74), mm(1.7), mm(5.6)]}
      />
      {/* Conductor block visible through the housing */}
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(len * 0.62)]}
        scale={[mm(w * 0.62), mm(h * 0.5), mm(len * 0.5)]}
      />
      {/* Sprung latch on top, rising toward the rear */}
      <mesh
        geometry={UNIT_BOX}
        material={HOUSING_MATERIAL}
        position={[0, mm(h / 2 + 1.1), mm(len * 0.58)]}
        rotation={[-0.16, 0, 0]}
        scale={[mm(4.6), mm(1.1), mm(len * 0.72)]}
      />
      {/* Metal shield collar at the cable end of the body */}
      <mesh
        geometry={UNIT_BOX}
        material={SHIELD_MATERIAL}
        position={[0, 0, mm(len - 1.4)]}
        scale={[mm(w + 0.6), mm(h + 0.6), mm(2.8)]}
      />
      {/* Strain-relief boot tapering onto the cable sheath */}
      <mesh
        geometry={COLLAR_GEOMETRY}
        material={boot}
        position={[0, 0, mm(len + 1.6)]}
        scale={[bootR * 1.12, bootR * 1.12, mm(3.2)]}
      />
      <mesh
        geometry={BOOT_GEOMETRY}
        material={boot}
        position={[0, 0, mm(len + 3.2 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/**
 * Generic barrel plug for non-copper connector types (SFP/DAC, power,
 * USB…) until each gets its own dedicated geometry: metal ferrule +
 * colored boot, no naked boxes anywhere.
 */
export function GenericPlug({ color, cableRadiusM }: Rj45PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const r = Math.max(cableRadiusM * 1.5, mm(3.4));
  return (
    <group>
      <mesh
        geometry={COLLAR_GEOMETRY}
        material={SHIELD_MATERIAL}
        position={[0, 0, mm(7)]}
        scale={[r, r, mm(14)]}
      />
      <mesh
        geometry={BOOT_GEOMETRY}
        material={boot}
        position={[0, 0, mm(14 + BOOT_LEN / 2)]}
        scale={[r * 0.96, r * 0.96, mm(BOOT_LEN)]}
      />
    </group>
  );
}
