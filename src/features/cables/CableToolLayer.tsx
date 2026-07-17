import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Line as ThreeLine,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  Vector3,
} from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  allPhysicalPorts,
  portFace,
  resolveEndpoint,
  type Vec3,
} from './anchors';
import {
  calibratedPort,
  useCalibrationStore,
} from '@/features/devices/hardware/connectorCalibration';
import { CABLE_CATALOG } from './cableCatalog';
import { formatLength } from './compatibility';
import { computeRoute, recommendLengthMm } from './routing';
import { etherlightingColor } from '@/features/devices/hardware/physicalPorts';
import { focusPort } from '@/features/viewport/focusActions';
import { checkPair, useCableToolStore } from '@/stores/cableToolStore';
import { deviceModelUrl, getDevice } from '@/features/devices/deviceRegistry';
import { useAssetStore } from '@/stores/assetStore';
import { useCableStore, type CableEnd } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useUIStore } from '@/stores/uiStore';
import { MM_TO_M, type RackGeometry } from '@/features/rack/rackMath';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

/**
 * Cable Tool viewport layer. The connectors themselves are the
 * interaction surface: every physical port gets an invisible hit box
 * (slightly larger than the connector for forgiving picking, Figma
 * handle style) and its cavity softly illuminates from the inside —
 * one instanced additive volume seated in the real opening
 * (GLB-calibrated where the model carries connector geometry,
 * procedural inset elsewhere). No markers, sprites or outlines: the
 * housing and bezel stay untouched, only the interior glows.
 *
 * Interaction states are pure emissive intensity, eased over ~170ms —
 * a faint steady glow on connectable openings, brighter on compatible
 * destinations once a source is armed, strongest on hover and on the
 * armed source. Incompatible ports stay completely dark (hover still
 * explains why). All geometry and materials are module-shared; colors
 * animate per instance without allocating or re-rendering.
 */

const UNIT_BOX = new BoxGeometry(1, 1, 1);

const HIT_MATERIAL = new MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  side: 2,
});
/** Additive so the glow reads as light inside the cavity, not paint over
 *  it — pins and cage walls stay visible through the illumination. */
const GLOW_MATERIAL = new MeshBasicMaterial({
  color: '#ffffff',
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

/** Selection hue for ports without Etherlighting of their own. */
const SELECTION_COLOR = '#3f7bff';
/** How far the glow volume reaches into the connector cavity, meters. */
const GLOW_DEPTH = 0.01;
/** Emissive intensity per interaction state (relative to base color). */
const INTENSITY = { none: 0, idle: 0.2, valid: 0.42, hover: 0.85, source: 1 };
/** Time constant of the emissive ease — ~95% settled in about 170ms. */
const EASE_TAU = 0.055;
/** Hit boxes are ~20% larger than the visible opening (usability only). */
const HIT_SCALE = 1.2;

const TMP_COLOR = new Color();
const TMP_MATRIX = new Matrix4();
const BLACK = new Color(0, 0, 0);

interface PortTarget {
  end: CableEnd;
  port: PhysicalPort;
  /** `${instanceId}:${portRef}` — key into the compatibility map. */
  key: string;
  /** Connector face center, rack-local meters. */
  position: Vec3;
  /** Cable anchor, rack-local meters. */
  anchor: Vec3;
  /** Visible opening size, meters. */
  widthM: number;
  heightM: number;
  /** Glow volume footprint (the cavity, not the housing), meters. */
  glowW: number;
  glowH: number;
  /** Rack-local z of the visible opening face. */
  faceZ: number;
  /** Outward normal sign of the panel in rack-local space. */
  out: 1 | -1;
  /** Base glow color: the port's Etherlighting hue, else selection blue. */
  color: string;
  deviceName: string;
}

export function CableToolLayer({ geometry }: { geometry: RackGeometry }) {
  const active = useUIStore((s) => s.activeTool === 'cable');
  const reset = useCableToolStore((s) => s.reset);

  // Leaving the tool always clears pending state.
  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  if (!active) return null;
  return <PortTargets geometry={geometry} />;
}

function PortTargets({ geometry }: { geometry: RackGeometry }) {
  const instances = useDeviceInstancesStore((s) => s.instances);
  const cables = useCableStore((s) => s.cables);
  const calibrationVersion = useCalibrationStore((s) => s.version);
  const assetAvailability = useAssetStore((s) => s.availability);
  const sourceEnd = useCableToolStore((s) => s.sourceEnd);
  const setSource = useCableToolStore((s) => s.setSource);
  const setHover = useCableToolStore((s) => s.setHover);
  const completeTo = useCableToolStore((s) => s.completeTo);
  const [hovered, setHovered] = useState<PortTarget | null>(null);

  const targets = useMemo(() => {
    const list: PortTarget[] = [];
    for (const instance of instances) {
      if (!instance.visible) continue;
      const definition = getDevice(instance.definitionId);
      if (!definition) continue;
      // Procedural connectors (placeholder / chassis models) protrude
      // from the panel: their visible opening is the inset face, ~2.1mm
      // proud. Calibrated GLB positions already sit on the real face.
      const procedural =
        definition.modelDetail === 'chassis' ||
        assetAvailability[deviceModelUrl(definition)] !== 'available';
      for (const port of allPhysicalPorts(definition)) {
        if (!port.visible) continue;
        const resolved = resolveEndpoint(definition, instance, geometry, port.ref);
        if (!resolved) continue;
        const face = portFace(definition, port);
        const calibrated = calibratedPort(definition.id, port.ref) !== null;
        const outwardLocal = port.location === 'front' ? 1 : -1;
        const flip = instance.facing === 'front' ? 1 : -1;
        const out = (outwardLocal * flip) as 1 | -1;
        const widthM = face.widthMm * MM_TO_M;
        const heightM = face.heightMm * MM_TO_M;
        // Lift of the opening face above the resolved surface plane.
        const faceLift = calibrated ? 0.0002 : procedural ? 0.0022 : 0.0004;
        list.push({
          end: { deviceInstanceId: instance.id, portRef: port.ref },
          port,
          key: `${instance.id}:${port.ref}`,
          position: resolved.surface,
          anchor: resolved.anchor,
          widthM,
          heightM,
          // Procedural openings are the dark inset inside the bezel;
          // GLB cavities span (almost) the whole connector body.
          glowW: procedural ? widthM * 0.74 : widthM * 0.94,
          glowH: procedural ? heightM * 0.6 : heightM * 0.94,
          faceZ: resolved.surface[2] + out * faceLift,
          out,
          color: etherlightingColor(definition, port) ?? SELECTION_COLOR,
          deviceName: definition.productName,
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, geometry, calibrationVersion, assetAvailability]);

  // Compatibility of every port against the pending source (memoized —
  // recomputed only when the source or the cable set changes).
  const levels = useMemo(() => {
    const map = new Map<string, 'source' | 'valid' | 'invalid' | 'neutral'>();
    for (const target of targets) {
      if (!sourceEnd) {
        map.set(target.key, 'neutral');
        continue;
      }
      if (
        sourceEnd.deviceInstanceId === target.end.deviceInstanceId &&
        sourceEnd.portRef === target.end.portRef
      ) {
        map.set(target.key, 'source');
        continue;
      }
      const result = checkPair(sourceEnd, target.end);
      map.set(target.key, result && result.level !== 'invalid' ? 'valid' : 'invalid');
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, sourceEnd, cables]);

  /* ---- cavity glow: one instanced mesh, per-port eased intensity ---- */

  const glowRef = useRef<InstancedMesh>(null);
  const intensities = useRef(new Float32Array(0));

  // Instance transforms rebuild only when the target set changes. The
  // glow volume's front face sits on the visible opening; the body
  // reaches into the cavity, so the housing itself occludes whatever
  // the opening doesn't reveal.
  useEffect(() => {
    const mesh = glowRef.current;
    if (!mesh) return;
    mesh.raycast = () => {}; // hit boxes own picking
    targets.forEach((t, i) => {
      TMP_MATRIX.makeScale(t.glowW, t.glowH, GLOW_DEPTH);
      TMP_MATRIX.setPosition(
        t.position[0],
        t.position[1],
        t.faceZ - t.out * (GLOW_DEPTH / 2),
      );
      mesh.setMatrixAt(i, TMP_MATRIX);
      mesh.setColorAt(i, BLACK);
    });
    mesh.count = targets.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    intensities.current = new Float32Array(targets.length);
  }, [targets]);

  // Per-frame: ease every port's emissive intensity toward its state's
  // target. Settled ports cost one comparison; nothing allocates.
  useFrame((_, delta) => {
    const mesh = glowRef.current;
    if (!mesh || targets.length === 0) return;
    const k = 1 - Math.exp(-delta / EASE_TAU);
    let dirty = false;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const state = levels.get(target.key) ?? 'neutral';
      const goal =
        state === 'invalid'
          ? INTENSITY.none
          : state === 'source'
            ? INTENSITY.source
            : hovered === target
              ? INTENSITY.hover
              : state === 'valid'
                ? INTENSITY.valid
                : INTENSITY.idle;
      const current = intensities.current[i];
      if (current === goal) continue;
      const next =
        Math.abs(goal - current) < 0.004 ? goal : current + (goal - current) * k;
      intensities.current[i] = next;
      mesh.setColorAt(i, TMP_COLOR.set(target.color).multiplyScalar(next));
      dirty = true;
    }
    if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const onClick = (target: PortTarget) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Orbit gestures ending on a port, and the clicks inside a
    // double-click, must not arm or complete a connection.
    if (e.delta > 4 || e.nativeEvent.detail > 1) return;
    if (!sourceEnd) {
      setSource(target.end);
    } else {
      completeTo(target.end);
    }
  };

  const onDoubleClick = (target: PortTarget) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Focus the port without disturbing the pending cable state.
    focusPort(target.end);
  };

  const source = sourceEnd
    ? targets.find(
        (t) =>
          t.end.deviceInstanceId === sourceEnd.deviceInstanceId &&
          t.end.portRef === sourceEnd.portRef,
      )
    : null;

  const hoverInfo = hovered && {
    reason:
      sourceEnd &&
      !(
        sourceEnd.deviceInstanceId === hovered.end.deviceInstanceId &&
        sourceEnd.portRef === hovered.end.portRef
      )
        ? checkPair(sourceEnd, hovered.end)
        : null,
  };

  // Live length estimate for the pending connection: the auto route
  // between the armed source and the hovered port, plus the standard
  // length that would be picked for it.
  const estimate = useMemo(() => {
    if (!source || !hovered || hovered === source) return null;
    if (!hoverInfo?.reason || hoverInfo.reason.level === 'invalid') return null;
    const route = computeRoute({
      source: {
        surface: source.position,
        anchor: source.anchor,
        exitDir: [0, 0, source.out],
      },
      destination: {
        surface: hovered.position,
        anchor: hovered.anchor,
        exitDir: [0, 0, hovered.out],
      },
      mode: 'auto',
      slack: 'normal',
      nominalLengthMm: 0,
      minBendRadiusMm: 25,
      geometry,
    });
    const typeId = hoverInfo.reason.suggestedTypes[0];
    const spec = typeId ? CABLE_CATALOG[typeId] : undefined;
    const recommended = spec
      ? recommendLengthMm(route.minLengthMm, spec.standardLengthsMm)
      : null;
    return { minLengthMm: route.minLengthMm, recommended };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, hovered, hoverInfo?.reason, geometry]);

  return (
    <group>
      {/* The illumination: one draw call for every connector cavity */}
      <instancedMesh
        key={targets.length}
        ref={glowRef}
        args={[UNIT_BOX, GLOW_MATERIAL, Math.max(targets.length, 1)]}
        frustumCulled={false}
      />

      {/* Forgiving invisible hit boxes — the connector is the target */}
      {targets.map((target) => (
        <mesh
          key={target.key}
          geometry={UNIT_BOX}
          material={HIT_MATERIAL}
          position={[
            target.position[0],
            target.position[1],
            target.position[2] + target.out * 0.003,
          ]}
          scale={[
            target.widthM * HIT_SCALE,
            target.heightM * HIT_SCALE,
            0.008,
          ]}
          onClick={onClick(target)}
          onDoubleClick={onDoubleClick(target)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(target);
            setHover(target.end);
          }}
          onPointerOut={() => {
            setHovered((current) => (current === target ? null : current));
            setHover(null);
          }}
        />
      ))}

      {/* Hover card: device, port, type, speed, PoE + compatibility */}
      {hovered && (
        <Html
          position={[
            hovered.position[0],
            hovered.position[1] + hovered.heightM / 2 + 0.02,
            hovered.position[2] + hovered.out * 0.004,
          ]}
          center
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div
            style={{
              fontSize: 10,
              lineHeight: 1.5,
              fontFamily: 'ui-monospace, monospace',
              color: '#c9d2dc',
              background: 'rgba(10, 11, 13, 0.88)',
              padding: '4px 7px',
              borderRadius: 5,
              border: '1px solid #2a2f36',
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {hovered.deviceName} · {hovered.port.ref}
            </div>
            <div>
              {hovered.port.type.toUpperCase()}
              {hovered.port.speedGbps ? ` · ${hovered.port.speedGbps}G` : ''}
              {hovered.port.poe ? ' · PoE' : ''}
              {hovered.port.label ? ` · ${hovered.port.label}` : ''}
            </div>
            {hoverInfo?.reason && (
              <div
                style={{
                  color:
                    hoverInfo.reason.level === 'invalid' ? '#e5544b' : '#3fb970',
                }}
              >
                {hoverInfo.reason.level === 'invalid'
                  ? hoverInfo.reason.message
                  : 'Click to connect'}
              </div>
            )}
            {estimate && (
              <div style={{ color: '#8fa4bd' }}>
                ≈ {formatLength(estimate.minLengthMm)} route
                {estimate.recommended
                  ? ` · ${formatLength(estimate.recommended)} cable`
                  : ''}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Live preview from the pending source to the pointer */}
      {source && <PreviewCurve source={source} geometry={geometry} />}
    </group>
  );
}

/** 32-point preview curve updated in place — zero allocation per frame. */
const PREVIEW_POINTS = 32;

function PreviewCurve({
  source,
  geometry: rackGeometry,
}: {
  source: PortTarget;
  geometry: RackGeometry;
}) {
  const groupRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);
  // Private raycaster: the shared one belongs to the event system.
  const localRay = useMemo(() => new Raycaster(), []);

  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(PREVIEW_POINTS * 3), 3),
    );
    const material = new LineBasicMaterial({
      color: '#4c82f7',
      transparent: true,
      opacity: 0.85,
    });
    const preview = new ThreeLine(geometry, material);
    // Never raycast the preview: THREE.Line hits within a 1m threshold,
    // and the line chases the pointer — inside the rack group (which
    // owns hover handlers) it would out-prioritize every connector and
    // deadlock port hovering while a source is armed.
    preview.raycast = () => {};
    return preview;
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );

  const plane = useMemo(() => new Plane(), []);
  const worldTarget = useMemo(() => new Vector3(), [plane]);
  const localTarget = useMemo(() => new Vector3(), []);
  const anchorWorld = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const hover = useCableToolStore.getState().hoverEnd;
    const start = new Vector3(...source.anchor);

    let end: Vector3;
    if (hover) {
      // Snap to the hovered port's anchor (already rack-local).
      end = localTarget;
      const hoverTarget = hoverAnchor(hover, rackGeometry);
      if (hoverTarget) end.set(...hoverTarget);
      else end = start;
    } else {
      // Follow the pointer on a camera-facing plane through the anchor.
      group.updateWorldMatrix(true, false);
      anchorWorld.copy(start).applyMatrix4(group.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(worldTarget).negate(),
        anchorWorld,
      );
      localRay.setFromCamera(pointer, camera);
      if (localRay.ray.intersectPlane(plane, worldTarget)) {
        localTarget.copy(worldTarget);
        group.worldToLocal(localTarget);
        end = localTarget;
      } else {
        end = start;
      }
    }

    // Quadratic sag between start and end.
    const positions = line.geometry.getAttribute('position') as BufferAttribute;
    const sag = Math.min(start.distanceTo(end) * 0.25, 0.12);
    for (let i = 0; i < PREVIEW_POINTS; i++) {
      const t = i / (PREVIEW_POINTS - 1);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t - sag * 4 * t * (1 - t);
      const z = start.z + (end.z - start.z) * t;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <primitive object={line} />
    </group>
  );
}

/** Rack-local anchor of a hovered end (resolved fresh; hover is rare). */
function hoverAnchor(end: CableEnd, geometry: RackGeometry): Vec3 | null {
  const instance = useDeviceInstancesStore
    .getState()
    .instances.find((i) => i.id === end.deviceInstanceId);
  const definition = instance ? getDevice(instance.definitionId) : undefined;
  if (!instance || !definition) return null;
  return (
    resolveEndpoint(definition, instance, geometry, end.portRef)?.anchor ??
    null
  );
}
