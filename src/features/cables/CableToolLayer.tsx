import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line as ThreeLine,
  LineBasicMaterial,
  Plane,
  SphereGeometry,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { allPhysicalPorts, resolveEndpoint, type Vec3 } from './anchors';
import { focusPort } from '@/features/viewport/focusActions';
import { checkPair, useCableToolStore } from '@/stores/cableToolStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useCableStore, type CableEnd } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useUIStore } from '@/stores/uiStore';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';
import type { RackGeometry } from '@/features/rack/rackMath';

/**
 * Cable Tool viewport layer, inside the rack group. Active only while
 * the tool is selected; renders one small hit target per physical port
 * (shared geometry, four shared materials), a hover card, and a live
 * preview curve from the pending source to the pointer. All
 * compatibility answers come from the pure engine — this layer never
 * decides validity itself.
 */

const HIT_GEOMETRY = new SphereGeometry(0.006, 12, 10);
const MAT_NEUTRAL = new MeshBasicMaterial({ color: '#7f8ea8', toneMapped: false });
const MAT_SOURCE = new MeshBasicMaterial({ color: '#4c82f7', toneMapped: false });
const MAT_COMPATIBLE = new MeshBasicMaterial({ color: '#3fb970', toneMapped: false });
const MAT_MUTED = new MeshBasicMaterial({
  color: '#3a3f46',
  transparent: true,
  opacity: 0.5,
  toneMapped: false,
});

interface PortTarget {
  end: CableEnd;
  port: PhysicalPort;
  position: Vec3;
  anchor: Vec3;
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
      for (const port of allPhysicalPorts(definition)) {
        if (!port.visible) continue;
        const resolved = resolveEndpoint(definition, instance, geometry, port.ref);
        if (!resolved) continue;
        list.push({
          end: { deviceInstanceId: instance.id, portRef: port.ref },
          port,
          position: resolved.surface,
          anchor: resolved.anchor,
          deviceName: definition.productName,
        });
      }
    }
    return list;
  }, [instances, geometry]);

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

  const materialFor = (target: PortTarget) => {
    switch (levels.get(`${target.end.deviceInstanceId}:${target.end.portRef}`)) {
      case 'source':
        return MAT_SOURCE;
      case 'valid':
        return MAT_COMPATIBLE;
      case 'invalid':
        return MAT_MUTED;
      default:
        return MAT_NEUTRAL;
    }
  };

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
      {targets.map((target) => (
        <mesh
          key={`${target.end.deviceInstanceId}:${target.end.portRef}`}
          geometry={HIT_GEOMETRY}
          material={materialFor(target)}
          position={target.anchor}
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
            hovered.anchor[0],
            hovered.anchor[1] + 0.03,
            hovered.anchor[2],
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
      const y =
        start.y + (end.y - start.y) * t - sag * 4 * t * (1 - t);
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
