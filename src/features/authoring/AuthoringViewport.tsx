import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  ContactShadows,
  Grid,
  TransformControls,
} from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import {
  definitionWithPorts,
  snapPosition,
  round2,
  type AuthoredPort,
  type Vec3,
} from './authoringModel';
import {
  primaryPort,
  useAuthoringStore,
} from './authoringStore';
import { SceneLighting } from '@/features/viewport/SceneLighting';
import { LoadedModel } from '@/features/devices/DeviceModel';
import { DevicePlaceholder } from '@/features/devices/DevicePlaceholder';
import { HardwareLayer } from '@/features/devices/hardware/HardwareLayer';
import { deviceModelUrl, getDevice } from '@/features/devices/deviceRegistry';
import { useAssetAvailability } from '@/stores/assetStore';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { VIEWPORT_THEME } from '@/features/viewport/viewportTheme';
import { MM_TO_M } from '@/features/rack/rackMath';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * The Device Authoring 3D stage: the imported GLB (never modified, fully
 * cached) on a studio floor, every authored port rendered as a
 * translucent cavity insert — the same visual language as Etherlighting
 * and the Cable Tool — plus a CAD transform gizmo on the primary
 * selection. All geometry/materials are module-shared; idle frames do
 * zero work.
 */

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_EDGES = new EdgesGeometry(UNIT_BOX);

const INSERT_MATERIAL = new MeshBasicMaterial({
  color: '#3f7bff',
  transparent: true,
  opacity: 0.3,
  toneMapped: false,
  depthWrite: false,
});
const SELECTED_MATERIAL = new MeshBasicMaterial({
  color: '#78a5ff',
  transparent: true,
  opacity: 0.55,
  toneMapped: false,
  depthWrite: false,
});
const SUGGESTION_MATERIAL = new MeshBasicMaterial({
  color: '#3fb970',
  transparent: true,
  opacity: 0.22,
  toneMapped: false,
  depthWrite: false,
});
const EDGE_MATERIAL = new LineBasicMaterial({
  color: '#9dbcff',
  transparent: true,
  opacity: 0.9,
});

/** Cavity depth of the insert volume, meters. */
const INSERT_DEPTH = 0.014;

const mm = (v: Vec3): Vec3 => [v[0] * MM_TO_M, v[1] * MM_TO_M, v[2] * MM_TO_M];
const degToRad = (v: Vec3): Vec3 => [
  MathUtils.degToRad(v[0]),
  MathUtils.degToRad(v[1]),
  MathUtils.degToRad(v[2]),
];

/** Device center height above the stage floor, meters. */
const deviceLift = (definition: DeviceDefinition): number =>
  (definition.heightMm / 2) * MM_TO_M + 0.04;

export function AuthoringViewport() {
  const theme = useResolvedTheme();
  const colors = VIEWPORT_THEME[theme];
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const gridVisible = useAuthoringStore((s) => s.gridVisible);
  const clearSelection = useAuthoringStore((s) => s.clearSelection);
  const definition = deviceId ? getDevice(deviceId) : undefined;
  const downAt = useRef<{ x: number; y: number } | null>(null);

  if (!definition) return null;

  return (
    <div
      className="viewport-backdrop relative h-full min-w-0 flex-1"
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0.6, 0.45, 0.85], fov: 45, near: 0.005, far: 60 }}
        className="!absolute inset-0"
        onPointerMissed={(e) => {
          const down = downAt.current;
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
            return; // orbit gesture, not a deselect click
          }
          clearSelection();
        }}
      >
        <SceneLighting />
        {gridVisible && (
          <Grid
            position={[0, 0, 0]}
            args={[10, 10]}
            cellSize={0.1}
            cellThickness={0.5}
            cellColor={colors.gridCell}
            sectionSize={0.5}
            sectionThickness={1.1}
            sectionColor={colors.gridSection}
            fadeDistance={12}
            fadeStrength={1.4}
            infiniteGrid
          />
        )}
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.42}
          scale={2.4}
          blur={2.2}
          far={0.9}
          resolution={512}
        />
        <StageContent definition={definition} />
        <AuthoringCameraRig definition={definition} />
      </Canvas>
      <div className="viewport-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}

/** Device + inserts, lifted so the chassis rests just above the floor. */
function StageContent({ definition }: { definition: DeviceDefinition }) {
  const lift = deviceLift(definition);
  return (
    <>
      <group position={[0, lift, 0]}>
        <AuthoredDevice definition={definition} />
        <PortInserts />
      </group>
      {/* World space: the gizmo bakes the stage lift itself. */}
      <SelectionGizmo lift={lift} />
    </>
  );
}

/**
 * The device body. GLBs load through the shared cache and universal
 * import pipeline (calibration/detection runs against the ORIGINAL
 * definition so analysis reflects the real model). Placeholder devices
 * render the live authored definition, so procedural connectors follow
 * every edit in real time.
 */
function AuthoredDevice({ definition }: { definition: DeviceDefinition }) {
  const url = deviceModelUrl(definition);
  const availability = useAssetAvailability(url);
  const ports = useAuthoringStore((s) => s.ports);

  // Live definition: placeholder hardware tracks the authored ports.
  const live = useMemo(
    () => definitionWithPorts(definition, ports),
    [definition, ports],
  );

  if (availability !== 'available') {
    return (
      <>
        <DevicePlaceholder definition={live} />
        <HardwareLayer definition={live} mode="full" />
      </>
    );
  }
  return (
    <Suspense fallback={<DevicePlaceholder definition={live} />}>
      <LoadedModel url={url} definition={definition} />
    </Suspense>
  );
}

/** Translucent cavity inserts for every authored port + suggestions. */
function PortInserts() {
  const ports = useAuthoringStore((s) => s.ports);
  const suggestions = useAuthoringStore((s) => s.suggestions);
  const selection = useAuthoringStore((s) => s.selection);
  const select = useAuthoringStore((s) => s.select);
  const mode = useAuthoringStore((s) => s.mode);
  const previewVisible = useAuthoringStore((s) => s.previewVisible);
  const previewIntensity = useAuthoringStore((s) => s.previewIntensity);

  // Preview intensity drives the shared materials — no per-port cost.
  useEffect(() => {
    INSERT_MATERIAL.opacity = 0.3 * previewIntensity + 0.06;
    SELECTED_MATERIAL.opacity = 0.45 * previewIntensity + 0.2;
  }, [previewIntensity]);

  if (mode !== 'edit' || !previewVisible) return null;

  return (
    <group>
      {ports.map((port) => {
        const selected = selection.includes(port.id);
        const out = port.location === 'front' ? 1 : -1;
        const size: Vec3 = [
          port.sizeMm[0] * MM_TO_M,
          port.sizeMm[1] * MM_TO_M,
          INSERT_DEPTH,
        ];
        return (
          <group
            key={port.id}
            position={mm(port.positionMm)}
            rotation={degToRad(port.rotationDeg)}
          >
            <mesh
              geometry={UNIT_BOX}
              material={selected ? SELECTED_MATERIAL : INSERT_MATERIAL}
              position={[0, 0, out * (0.0006 - INSERT_DEPTH / 2)]}
              scale={size}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                if (e.delta > 4) return;
                select(port.id, e.nativeEvent.shiftKey);
              }}
            />
            {selected && (
              <lineSegments
                geometry={UNIT_EDGES}
                material={EDGE_MATERIAL}
                position={[0, 0, out * (0.0006 - INSERT_DEPTH / 2)]}
                scale={size}
              />
            )}
          </group>
        );
      })}
      {suggestions?.map((port) => (
        <mesh
          key={`suggestion-${port.id}`}
          geometry={UNIT_BOX}
          material={SUGGESTION_MATERIAL}
          position={mm(port.positionMm)}
          scale={[
            port.sizeMm[0] * MM_TO_M,
            port.sizeMm[1] * MM_TO_M,
            0.004,
          ]}
        />
      ))}
    </group>
  );
}

/**
 * CAD transform gizmo bound to the primary selection. The gizmo drives a
 * proxy Object3D; every change is written back to the store in device
 * mm, with magnetic + grid snapping applied to translations. Dragging
 * automatically pauses the camera controls (drei wiring).
 */
function SelectionGizmo({ lift }: { lift: number }) {
  const tool = useAuthoringStore((s) => s.tool);
  const mode = useAuthoringStore((s) => s.mode);
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const snap = useAuthoringStore((s) => s.snap);
  const port = primaryPort({ ports, selection });

  const proxy = useMemo(() => new Object3D(), []);
  // Port state at the start of a drag, so deltas stay absolute.
  const dragBase = useRef<AuthoredPort | null>(null);
  const dragOrigins = useRef(new Map<string, AuthoredPort>());
  const [dragging, setDragging] = useState(false);

  // Keep the proxy in sync with the primary port between drags.
  useEffect(() => {
    if (!port || dragging) return;
    const [x, y, z] = mm(port.positionMm);
    proxy.position.set(x, y + lift, z);
    proxy.rotation.set(...degToRad(port.rotationDeg));
    proxy.scale.set(1, 1, 1);
  }, [port, proxy, dragging, lift]);

  if (mode !== 'edit' || !port || tool === 'select') return null;

  const gizmoMode =
    tool === 'move' ? 'translate' : tool === 'rotate' ? 'rotate' : 'scale';

  const applyChange = () => {
    const state = useAuthoringStore.getState();
    const current = primaryPort(state);
    const base = dragBase.current;
    if (!current || !base) return;
    if (tool === 'move') {
      const raw: Vec3 = [
        proxy.position.x / MM_TO_M,
        (proxy.position.y - lift) / MM_TO_M,
        proxy.position.z / MM_TO_M,
      ];
      const snapped = snapPosition(current, raw, state.ports, state.snap);
      // Multi-selection moves rigidly with the primary port.
      const delta: Vec3 = [
        snapped[0] - base.positionMm[0],
        snapped[1] - base.positionMm[1],
        snapped[2] - base.positionMm[2],
      ];
      for (const id of state.selection) {
        const origin =
          id === current.id
            ? base
            : dragOrigins.current.get(id);
        if (!origin) continue;
        state.movePort(id, [
          origin.positionMm[0] + delta[0],
          origin.positionMm[1] + delta[1],
          origin.positionMm[2] + delta[2],
        ]);
      }
    } else if (tool === 'rotate') {
      state.updatePort(current.id, {
        rotationDeg: [
          round2(MathUtils.radToDeg(proxy.rotation.x)),
          round2(MathUtils.radToDeg(proxy.rotation.y)),
          round2(MathUtils.radToDeg(proxy.rotation.z)),
        ],
      });
    } else {
      state.updatePort(current.id, {
        sizeMm: [
          Math.max(2, round2(base.sizeMm[0] * proxy.scale.x)),
          Math.max(2, round2(base.sizeMm[1] * proxy.scale.y)),
        ],
      });
    }
  };

  return (
    <>
      {/* The gizmo's target must live in the scene graph. */}
      <primitive object={proxy} />
      <TransformControls
      object={proxy}
      mode={gizmoMode}
      size={0.55}
      translationSnap={snap.enabled && snap.grid ? snap.gridMm * MM_TO_M : null}
      rotationSnap={snap.enabled ? MathUtils.degToRad(15) : null}
      scaleSnap={snap.enabled ? 0.05 : null}
      onObjectChange={applyChange}
      onMouseDown={() => {
        const state = useAuthoringStore.getState();
        dragBase.current = primaryPort(state);
        dragOrigins.current = new Map(
          state.selection.map((id) => [
            id,
            state.ports.find((p) => p.id === id)!,
          ]),
        );
        setDragging(true);
      }}
      onMouseUp={() => {
        setDragging(false);
        dragBase.current = null;
        // Re-sync happens via the effect on next render.
      }}
      />
    </>
  );
}

/** Camera: initial framing + one-shot frame commands from the chrome. */
function AuthoringCameraRig({ definition }: { definition: DeviceDefinition }) {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const command = useAuthoringStore((s) => s.cameraCommand);
  const invalidate = useThree((s) => s.invalidate);

  const frame = (face: 'front' | 'rear', portsOnly: boolean) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const lift = deviceLift(definition);
    const out = face === 'front' ? 1 : -1;
    const halfDepth = (definition.depthMm / 2) * MM_TO_M;

    let cx = 0;
    let cy = lift;
    let span = definition.widthMm * MM_TO_M;
    if (portsOnly) {
      const ports = useAuthoringStore
        .getState()
        .ports.filter((p) => p.location === face);
      if (ports.length > 0) {
        const xs = ports.map((p) => p.positionMm[0]);
        const ys = ports.map((p) => p.positionMm[1]);
        const min = Math.min(...xs);
        const max = Math.max(...xs);
        cx = (((min + max) / 2) * MM_TO_M) || 0;
        cy = lift + ((Math.min(...ys) + Math.max(...ys)) / 2) * MM_TO_M;
        span = Math.max(0.08, (max - min + 60) * MM_TO_M);
      }
    }
    const distance = Math.max(0.18, (span / 2) / Math.tan(MathUtils.degToRad(22.5)) * 1.15);
    void controls.setLookAt(
      cx,
      cy + distance * 0.18,
      out * (halfDepth + distance),
      cx,
      cy,
      out * halfDepth,
      true,
    );
    invalidate();
  };

  // Initial framing once the controls mount.
  const framedOnce = useRef(false);
  useEffect(() => {
    if (framedOnce.current) return;
    framedOnce.current = true;
    // Three-quarter product view first, so the device reads as an object.
    const controls = controlsRef.current;
    const lift = deviceLift(definition);
    const w = definition.widthMm * MM_TO_M;
    void controls?.setLookAt(w * 1.1, lift + w * 0.45, w * 1.5, 0, lift, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!command) return;
    frame(command.face, command.type === 'frame-ports');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={0.015}
      maxDistance={8}
      maxPolarAngle={Math.PI / 2 + 0.35}
      smoothTime={0.22}
      draggingSmoothTime={0.06}
    />
  );
}
