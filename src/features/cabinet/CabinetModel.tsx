import { Suspense, useEffect, useMemo, useRef } from 'react';
import {
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  computePartTarget,
  DEFAULT_CABINET_LIGHTS,
  defaultInstance,
  type CabinetInstance,
} from './cabinetRuntime';
import { matchesNodePattern, type CabinetModelDef, type CabinetPartDef } from './cabinetSchema';
import { ModelErrorBoundary } from '@/features/devices/DeviceModel';
import { useCabinetStore } from '@/stores/cabinetStore';
import { useAssetAvailability } from '@/stores/assetStore';
import { assetUrl } from '@/lib/assetUrl';
import { type RackGeometry } from '@/features/rack/rackMath';
import { U_METERS } from '@/features/rack/rackConstants';

const DRACO_DECODER_PATH = assetUrl('draco/');
const MM = 0.001;

/**
 * Grade a cloned cabinet material toward a realistic light-grey enclosure
 * instead of the blown-out near-white the raw asset reads as under the
 * studio rig. The steel is pulled to a light grey with calmer reflections;
 * the glass door gets a subtle smoky tint so — closed, as it usually is —
 * you see the gear through it slightly dimmed, like the real product.
 */
function gradeCabinetMaterial(m: Material): void {
  const std = m as MeshStandardMaterial;
  const name = m.name.toLowerCase();
  const isGlass = name.includes('glass') || m.transparent;

  if (isGlass) {
    std.color?.set('#525a63'); // cool smoky grey tint
    std.opacity = 0.5;
    std.transparent = true;
    std.metalness = 0;
    std.roughness = 0.06;
    std.envMapIntensity = 0.9;
    const phys = m as MeshPhysicalMaterial;
    if (typeof phys.transmission === 'number' && phys.transmission > 0) {
      phys.transmission = 0.55; // tinted, not perfectly clear
      phys.ior = 1.5;
    }
    return;
  }

  // Painted steel / aluminium: tame environment reflections and pull the
  // near-white down to a light grey (RAL 7035-ish) so it stops glowing.
  std.envMapIntensity = 0.55;
  if (std.color) {
    const hsl = { h: 0, s: 0, l: 0 };
    std.color.getHSL(hsl);
    if (hsl.l > 0.72) std.color.setHSL(hsl.h, hsl.s, hsl.l * 0.8);
  }
}

/** A part's actuation group: its pivot/anchor + the nodes attached under it. */
interface PartGroup {
  def: CabinetPartDef;
  group: Group;
  /** Rest position of the group (pivot for hinges, origin otherwise), m. */
  base: [number, number, number];
  /** Cloned materials owned by this part (for independent transparency). */
  materials: Material[];
  /** Eased opacity, so we only touch materials when it actually changes. */
  opacity: number;
}

/**
 * Groups the GLB's flat named nodes into per-part actuation groups.
 * `attach` re-parents while preserving world transform, so a door's nodes
 * end up as children of a group sitting on the hinge pivot — rotating the
 * group then swings the door correctly. Materials are cloned per part so
 * transparency on one part never bleeds into another that shares a base
 * material.
 */
function buildPartGroups(root: Object3D, model: CabinetModelDef): PartGroup[] {
  const named = root.children.filter((c) => c.name);
  const claimed = new Set<Object3D>();
  const out: PartGroup[] = [];

  for (const def of model.parts) {
    const nodes = named.filter(
      (n) => !claimed.has(n) && def.nodes.some((p) => matchesNodePattern(n.name, p)),
    );
    if (nodes.length === 0) continue;

    const group = new Group();
    group.name = `part:${def.id}`;
    const base: [number, number, number] = def.hinge
      ? [def.hinge.pivotMm[0] * MM, def.hinge.pivotMm[1] * MM, def.hinge.pivotMm[2] * MM]
      : [0, 0, 0];
    group.position.set(...base);
    root.add(group);
    for (const n of nodes) {
      claimed.add(n);
      group.attach(n); // preserves world transform
    }

    // Clone materials once per part (deduped) so opacity is isolated.
    const map = new Map<Material, Material>();
    group.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const swap = (m: Material) => {
        let c = map.get(m);
        if (!c) {
          c = m.clone();
          gradeCabinetMaterial(c);
          // Capture opacity AFTER grading so the transparency system eases
          // toward the graded (tinted) value, not the raw asset opacity.
          c.userData.baseOpacity = c.opacity;
          map.set(m, c);
        }
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    out.push({ def, group, base, materials: [...map.values()], opacity: 1 });
  }
  return out;
}

/** Where to seat the cabinet so its interior rails line up with the rack's
 *  device-mounting region (rails span railBaseYM … +units·U, front plane at
 *  frontRailZ). The GLB is authored centred at the origin with its rail band
 *  at local y=0 and front rail at z≈0.267m. */
function cabinetPlacement(
  model: CabinetModelDef,
  geometry: RackGeometry,
): [number, number, number] {
  const railCenterY = geometry.railBaseYM + (model.rackUnits * U_METERS) / 2;
  const GLB_FRONT_RAIL_Z = 0.267;
  return [0, railCenterY, geometry.frontRailZ - GLB_FRONT_RAIL_Z];
}

function LoadedCabinet({
  model,
  geometry,
  rackId,
}: {
  model: CabinetModelDef;
  geometry: RackGeometry;
  rackId: string;
}) {
  const url = assetUrl(model.modelPath);
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const partGroups = useMemo(() => buildPartGroups(cloned, model), [cloned, model]);

  // Seed a persisted instance the first time this rack shows the cabinet.
  const ensure = useCabinetStore((s) => s.ensure);
  useEffect(() => {
    ensure(rackId, model);
  }, [ensure, rackId, model]);

  const instance =
    useCabinetStore((s) => s.instances[rackId]) ?? defaultInstance(model);
  const instRef = useRef<CabinetInstance>(instance);
  instRef.current = instance;

  useFrame((_, deltaRaw) => {
    const inst = instRef.current;
    const delta = Math.min(deltaRaw, 0.05);
    const k = 1 - Math.exp(-delta * 7 * inst.animationSpeed);

    for (const pg of partGroups) {
      const target = computePartTarget(pg.def, inst.parts[pg.def.id], inst);

      // Hinge (rotate about the pivot axis).
      if (pg.def.hinge) {
        const axis = pg.def.hinge.axis;
        pg.group.rotation[axis] +=
          (target.hingeRad - pg.group.rotation[axis]) * k;
      }

      // Translation from rest (slide/lift/remove/explode).
      pg.group.position.x += (pg.base[0] + target.offset[0] - pg.group.position.x) * k;
      pg.group.position.y += (pg.base[1] + target.offset[1] - pg.group.position.y) * k;
      pg.group.position.z += (pg.base[2] + target.offset[2] - pg.group.position.z) * k;

      pg.group.visible = target.visible;

      // Opacity — only rewrite materials when it moves.
      const nextOpacity = pg.opacity + (target.opacity - pg.opacity) * k;
      if (Math.abs(nextOpacity - pg.opacity) > 0.004) {
        pg.opacity = nextOpacity;
        for (const m of pg.materials) {
          const base = (m.userData.baseOpacity as number) ?? 1;
          m.opacity = base * nextOpacity;
          m.transparent = m.opacity < 0.985;
          m.depthWrite = m.opacity > 0.6;
          m.needsUpdate = false;
        }
      }
    }
  });

  const placement = useMemo(
    () => cabinetPlacement(model, geometry),
    [model, geometry],
  );

  const lights = instance.lights ?? DEFAULT_CABINET_LIGHTS;

  return (
    <group position={placement}>
      <primitive object={cloned} />
      {lights.on && lights.brightness > 0.001 && (
        <CabinetInteriorLights model={model} lights={lights} />
      )}
    </group>
  );
}

/**
 * Interior LED strips on both sides of the bay: a visible emissive bar plus
 * fill lights so mounted gear is actually lit. Position/height scale with
 * the enclosure; brightness and color come from the per-cabinet state.
 */
function CabinetInteriorLights({
  model,
  lights,
}: {
  model: CabinetModelDef;
  lights: { brightness: number; color: string };
}) {
  const halfH = (model.rackUnits * U_METERS) / 2;
  const xWall = (model.sizeMm[0] * MM) / 2 - 0.04; // just inside the side panels
  const z = 0.22; // interior, toward the front of the bay
  const emissive = lights.brightness * 3;

  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Visible LED strip */}
          <mesh position={[s * xWall, 0, z]}>
            <boxGeometry args={[0.01, 2 * halfH, 0.02]} />
            <meshStandardMaterial
              color="#0a0a0a"
              emissive={lights.color}
              emissiveIntensity={emissive}
              toneMapped={false}
            />
          </mesh>
          {/* Fill lights along the strip */}
          {[halfH * 0.55, -halfH * 0.55].map((y, i) => (
            <pointLight
              key={i}
              position={[s * (xWall - 0.02), y, z]}
              intensity={lights.brightness * 2}
              distance={1.3}
              decay={2}
              color={lights.color}
            />
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * Interactive cabinet enclosure. Renders the GLB shell whose parts open,
 * slide, hide and fade under the metadata-driven interaction system. Falls
 * back to nothing (the caller keeps the parametric frame) if the GLB is not
 * available, so a missing asset never blanks the rack.
 */
export function CabinetModel({
  model,
  geometry,
  rackId,
}: {
  model: CabinetModelDef;
  geometry: RackGeometry;
  rackId: string;
}) {
  const url = assetUrl(model.modelPath);
  const availability = useAssetAvailability(url);
  // Start decoding the GLB in parallel with the availability probe, so the
  // handoff from the parametric fallback frame to the shell has no blank gap.
  useEffect(() => {
    useGLTF.preload(url, DRACO_DECODER_PATH);
  }, [url]);
  if (availability !== 'available') return null;

  return (
    <ModelErrorBoundary key={url} label={`cabinet ${url}`} fallback={null}>
      <Suspense fallback={null}>
        <LoadedCabinet model={model} geometry={geometry} rackId={rackId} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

export function preloadCabinet(model: CabinetModelDef): void {
  useGLTF.preload(assetUrl(model.modelPath), DRACO_DECODER_PATH);
}
