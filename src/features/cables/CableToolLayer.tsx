import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  Group,
  Line as ThreeLine,
  LineBasicMaterial,
  MeshBasicMaterial,
  Plane,
  PlaneGeometry,
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
import { useCalibrationStore } from '@/features/devices/hardware/connectorCalibration';
import { focusPort } from '@/features/viewport/focusActions';
import { checkPair, useCableToolStore } from '@/stores/cableToolStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useCableStore, type CableEnd } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useUIStore } from '@/stores/uiStore';
import { MM_TO_M, type RackGeometry } from '@/features/rack/rackMath';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

/**
 * Cable Tool viewport layer. The connectors themselves are the
 * interaction surface: every physical port gets an invisible hit box
 * (slightly larger than the connector for forgiving picking) and a
 * visible highlight that exactly covers the connector opening —
 * GLB-calibrated where the model carries real connector geometry,
 * catalog-sized on procedural hardware. No detached markers.
 *
 * Visual language: a faint breathing fill on connectable openings while
 * the tool idles, steady green fills on compatible destinations once a
 * source is armed, a solid fill + thin outline on the source and the
 * hovered port. Incompatible ports stay untouched (hover still explains
 * why). All geometry and materials are module-shared.
 */

const UNIT_PLANE = new PlaneGeometry(1, 1);
const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_EDGES = new EdgesGeometry(UNIT_PLANE);

const HIT_MATERIAL = new MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  side: 2,
});
const MAT_IDLE = new MeshBasicMaterial({
  color: '#4c82f7',
  transparent: true,
  opacity: 0.12,
  toneMapped: false,
  depthWrite: false,
  side: 2,
});
const MAT_COMPAT = new MeshBasicMaterial({
  color: '#3fb970',
  transparent: true,
  opacity: 0.26,
  toneMapped: false,
  depthWrite: false,
  side: 2,
});
const MAT_SOURCE = new MeshBasicMaterial({
  color: '#4c82f7',
  transparent: true,
  opacity: 0.5,
  toneMapped: false,
  depthWrite: false,
  side: 2,
});
const MAT_HOVER = new MeshBasicMaterial({
  color: '#7ea6ff',
  transparent: true,
  opacity: 0.5,
  toneMapped: false,
  depthWrite: false,
  side: 2,
});
const OUTLINE_MATERIAL = new LineBasicMaterial({
  color: '#9dbcff',
  transparent: true,
  opacity: 0.95,
});

interface PortTarget {
  end: CableEnd;
  port: PhysicalPort;
  /** Connector face center, rack-local meters. */
  position: Vec3;
  /** Cable anchor, rack-local meters. */
  anchor: Vec3;
  /** Visible opening size, meters. */
  widthM: number;
  heightM: number;
  /** Outward normal sign of the panel in rack-local space. */
  out: 1 | -1;
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
  const sourceEnd = useCableToolStore((s) => s.sourceEnd);
  const setSource = useCableToolStore((s) => s.setSource);
  const setHover = useCableToolStore((s) => s.setHover);
  const completeTo = useCableToolStore((s) => s.completeTo);
  const [hovered, setHovered] = useState<PortTarget | null>(null);

  // Breathe the idle fill: one shared material, one uniform per frame.
  useFrame(({ clock }) => {
    MAT_IDLE.opacity = 0.09 + 0.06 * Math.sin(clock.elapsedTime * 2.2) ** 2;
  });

  const targets = useMemo(() => {
    const list: PortTarget[] = [];
    for (const instance of instances) {
      if (!instance.visible) continue;
      const definition = getDevice(instance.definitionId);
      if (!definition) continue;
      for (const port of allPhysicalPorts(definition)) {
        if (!port.visible) continue;
        const resolved = resolveEndpoint(definition, instance, geometry, port.ref);
        if (!resolved) continue;
        const face = portFace(definition, port);
        const outwardLocal = port.location === 'front' ? 1 : -1;
        const flip = instance.facing === 'front' ? 1 : -1;
        list.push({
          end: { deviceInstanceId: instance.id, portRef: port.ref },
          port,
          position: resolved.surface,
          anchor: resolved.anchor,
          widthM: face.widthMm * MM_TO_M,
          heightM: face.heightMm * MM_TO_M,
          out: (outwardLocal * flip) as 1 | -1,
          deviceName: definition.productName,
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, geometry, calibrationVersion]);

  // Compatibility of every port against the pending source (memoized —
  // recomputed only when the source or the cable set changes).
  const levels = useMemo(() => {
    const map = new Map<string, 'source' | 'valid' | 'invalid' | 'neutral'>();
    for (const target of targets) {
      const key = `${target.end.deviceInstanceId}:${target.end.portRef}`;
      if (!sourceEnd) {
        map.set(key, 'neutral');
        continue;
      }
      if (
        sourceEnd.deviceInstanceId === target.end.deviceInstanceId &&
        sourceEnd.portRef === target.end.portRef
      ) {
        map.set(key, 'source');
        continue;
      }
      const result = checkPair(sourceEnd, target.end);
      map.set(key, result && result.level !== 'invalid' ? 'valid' : 'invalid');
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, sourceEnd, cables]);

  const stateOf = (target: PortTarget) =>
    levels.get(`${target.end.deviceInstanceId}:${target.end.portRef}`) ??
    'neutral';

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

  const source = sourceEnd
    ? targets.find(
        (t) =>
          t.end.deviceInstanceId === sourceEnd.deviceInstanceId &&
          t.end.portRef === sourceEnd.portRef,
      )
    : null;

  return (
    <group>
      {targets.map((target) => {
        const state = stateOf(target);
        const isHovered = hovered === target;
        const highlightMaterial =
          isHovered && state !== 'invalid'
            ? MAT_HOVER
            : state === 'source'
              ? MAT_SOURCE
              : state === 'valid'
                ? MAT_COMPAT
                : state === 'neutral'
                  ? MAT_IDLE
                  : null;
        const rotationY = target.out === 1 ? 0 : Math.PI;
        const surfaceZ = target.position[2] + target.out * 0.0012;
        const key = `${target.end.deviceInstanceId}:${target.end.portRef}`;

        return (
          <group key={key}>
            {/* Forgiving invisible hit box, sized just past the opening */}
            <mesh
              geometry={UNIT_BOX}
              material={HIT_MATERIAL}
              position={[
                target.position[0],
                target.position[1],
                target.position[2] + target.out * 0.003,
              ]}
              scale={[
                target.widthM + 0.004,
                target.heightM + 0.004,
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
            {/* Highlight exactly covering the connector opening */}
            {highlightMaterial && (
              <mesh
                geometry={UNIT_PLANE}
                material={highlightMaterial}
                position={[target.position[0], target.position[1], surfaceZ]}
                rotation={[0, rotationY, 0]}
                scale={[target.widthM, target.heightM, 1]}
              />
            )}
            {/* Thin outline on the armed source and the hovered opening */}
            {(state === 'source' || (isHovered && state !== 'invalid')) && (
              <lineSegments
                geometry={UNIT_EDGES}
                material={OUTLINE_MATERIAL}
                position={[
                  target.position[0],
                  target.position[1],
                  surfaceZ + target.out * 0.0006,
                ]}
                rotation={[0, rotationY, 0]}
                scale={[target.widthM + 0.0015, target.heightM + 0.0015, 1]}
              />
            )}
          </group>
        );
      })}

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
  const raycaster = useThree((s) => s.raycaster);
  const pointer = useThree((s) => s.pointer);

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
    return new ThreeLine(geometry, material);
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
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, worldTarget)) {
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
