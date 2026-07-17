import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  Camera,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
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
  isPowerType,
  primaryPort,
  selectedPorts,
  useAuthoringStore,
} from './authoringStore';
import { SceneLighting } from '@/features/viewport/SceneLighting';
import { LoadedModel } from '@/features/devices/DeviceModel';
import { DevicePlaceholder } from '@/features/devices/DevicePlaceholder';
import { HardwareLayer } from '@/features/devices/hardware/HardwareLayer';
import { MountingHardware } from '@/features/devices/MountingHardware';
import { deviceModelUrl, getDevice } from '@/features/devices/deviceRegistry';
import {
  DEFAULT_INSERTION_MM,
  GENERIC_INSERTION_MM,
  GenericPlug,
  plugQuaternion,
  Rj45Plug,
} from '@/features/cables/Rj45Plug';
import { useAssetAvailability } from '@/stores/assetStore';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { VIEWPORT_THEME } from '@/features/viewport/viewportTheme';
import { U_METERS } from '@/features/rack/rackConstants';
import {
  devicePlacement,
  rackGeometry,
  MM_TO_M,
} from '@/features/rack/rackMath';
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
const DIMMED_MATERIAL = new MeshBasicMaterial({
  color: '#5a6472',
  transparent: true,
  opacity: 0.1,
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

/** Device origin in stage space — read by box select and camera framing. */
const deviceOrigin = { current: [0, 0, 0] as Vec3 };

/** The rack geometry used by the Mount Preview (real placement engine). */
const PREVIEW_GEOMETRY = rackGeometry('open-frame-700');
const PREVIEW_START_U = 2;

export function AuthoringViewport() {
  const theme = useResolvedTheme();
  const colors = VIEWPORT_THEME[theme];
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const gridVisible = useAuthoringStore((s) => s.gridVisible);
  const clearSelection = useAuthoringStore((s) => s.clearSelection);
  const definition = deviceId ? getDevice(deviceId) : undefined;
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  if (!definition) return null;

  // Shift+drag box select: project every port into screen space and
  // select what falls inside the marquee.
  const finishMarquee = (box: NonNullable<typeof marquee>) => {
    const camera = cameraRef.current;
    const host = hostRef.current;
    if (!camera || !host) return;
    const rect = host.getBoundingClientRect();
    const [minX, maxX] = [Math.min(box.x1, box.x2), Math.max(box.x1, box.x2)];
    const [minY, maxY] = [Math.min(box.y1, box.y2), Math.max(box.y1, box.y2)];
    if (maxX - minX < 6 && maxY - minY < 6) return;
    const state = useAuthoringStore.getState();
    const origin = deviceOrigin.current;
    const hit = state.ports
      .filter((port) => {
        const world = new Vector3(
          origin[0] + port.positionMm[0] * MM_TO_M,
          origin[1] + port.positionMm[1] * MM_TO_M,
          origin[2] + port.positionMm[2] * MM_TO_M,
        ).project(camera);
        const sx = rect.left + ((world.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - world.y) / 2) * rect.height;
        return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
      })
      .map((port) => port.id);
    if (hit.length > 0) state.selectMany(hit);
  };

  return (
    <div
      ref={hostRef}
      className="viewport-backdrop relative h-full min-w-0 flex-1"
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        if (e.shiftKey && e.button === 0) {
          setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (marquee) setMarquee({ ...marquee, x2: e.clientX, y2: e.clientY });
      }}
      onPointerUp={() => {
        if (marquee) {
          finishMarquee(marquee);
          setMarquee(null);
        }
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
          if (!e.shiftKey) clearSelection();
        }}
      >
        <CameraCapture cameraRef={cameraRef} />
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
        <AuthoringCameraRig definition={definition} marqueeActive={marquee !== null} />
      </Canvas>
      {marquee && (
        <div
          className="pointer-events-none absolute border border-accent/70 bg-accent/10"
          style={{
            left: Math.min(marquee.x1, marquee.x2) - (hostRef.current?.getBoundingClientRect().left ?? 0),
            top: Math.min(marquee.y1, marquee.y2) - (hostRef.current?.getBoundingClientRect().top ?? 0),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}
      <div className="viewport-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}

/** Publishes the R3F camera to the DOM layer (box select projection). */
function CameraCapture({ cameraRef }: { cameraRef: { current: Camera | null } }) {
  const camera = useThree((s) => s.camera);
  cameraRef.current = camera;
  return null;
}

/**
 * Device + inserts. Free stage: floating above the floor grid. Mount
 * Preview: positioned by the REAL placement engine against a rail
 * gauge, so what you see here is exactly what the rack editor renders.
 */
function StageContent({ definition }: { definition: DeviceDefinition }) {
  const ports = useAuthoringStore((s) => s.ports);
  const mountOffsetMm = useAuthoringStore((s) => s.mountOffsetMm);
  const modelTransform = useAuthoringStore((s) => s.modelTransform);
  const mountPreview = useAuthoringStore((s) => s.mountPreview);

  // Live authored definition: hardware, placement and model transform
  // all follow every edit immediately.
  const live = useMemo(
    () => definitionWithPorts(definition, ports, { mountOffsetMm, modelTransform }),
    [definition, ports, mountOffsetMm, modelTransform],
  );

  const origin: Vec3 = mountPreview
    ? devicePlacement(live, PREVIEW_START_U, 'front', PREVIEW_GEOMETRY).position
    : [0, deviceLift(definition), 0];
  deviceOrigin.current = origin;

  return (
    <>
      {mountPreview && (
        <RailGauge
          geometry={PREVIEW_GEOMETRY}
          baseU={PREVIEW_START_U}
          units={live.rackUnits}
        />
      )}
      <group position={origin}>
        <AuthoredDevice definition={definition} live={live} />
        {mountPreview && (
          <MountingHardware definition={live} geometry={PREVIEW_GEOMETRY} />
        )}
        <PortInserts />
        <CategoryMarkers definition={definition} />
      </group>
      <SelectionGizmo origin={origin} definition={definition} />
    </>
  );
}

/**
 * The device body. GLBs load through the shared cache and universal
 * import pipeline; the live authored modelTransform is applied, so
 * model corrections update in place. Calibration/detection runs against
 * the ORIGINAL definition id (cached once). Placeholder devices render
 * the live authored definition, so procedural connectors follow edits.
 */
function AuthoredDevice({
  definition,
  live,
}: {
  definition: DeviceDefinition;
  live: DeviceDefinition;
}) {
  const url = deviceModelUrl(definition);
  const availability = useAssetAvailability(url);

  // The GLB gets the live model transform; everything else original.
  const modelDefinition = useMemo(
    () => ({ ...definition, modelTransform: live.modelTransform }),
    [definition, live.modelTransform],
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
      <LoadedModel url={url} definition={modelDefinition} />
    </Suspense>
  );
}

/* ---- mount preview rail gauge ---------------------------------------- */

const RAIL_MATERIAL = new MeshStandardMaterial({
  color: '#2a2e34',
  metalness: 0.7,
  roughness: 0.45,
});
const HOLE_MATERIAL = new MeshStandardMaterial({
  color: '#07080a',
  metalness: 0.2,
  roughness: 0.9,
});
const HOLE_GEOMETRY = new CylinderGeometry(0.0048, 0.0048, 0.0022, 12);
HOLE_GEOMETRY.rotateX(Math.PI / 2);

/** EIA-310 hole offsets inside one U, mm from the U boundary. */
const EIA_HOLES_MM = [6.35, 22.225, 38.1];
/** Lateral hole-column centerline, meters from the rack center (EIA). */
const EIA_HOLE_X = 0.23255;

/**
 * A minimal pair of front mounting rails with true EIA-310 hole
 * spacing, drawn at the real rail plane of the preview geometry. The
 * developer sees immediately whether ears and holes line up.
 */
function RailGauge({
  geometry,
  baseU,
  units,
}: {
  geometry: ReturnType<typeof rackGeometry>;
  baseU: number;
  units: number;
}) {
  const span = units + 2; // one spare U above and below
  const bottomU = Math.max(1, baseU - 1);
  const y0 = geometry.railBaseYM + (bottomU - 1) * U_METERS;
  const height = span * U_METERS;
  const railX = EIA_HOLE_X;
  const z = geometry.frontRailZ;

  const holes: Vec3[] = [];
  for (let u = 0; u < span; u++) {
    for (const offset of EIA_HOLES_MM) {
      holes.push([0, y0 + u * U_METERS + offset * MM_TO_M, 0]);
    }
  }

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * railX, 0, 0]}>
          {/* Rail flange behind the mounting plane */}
          <mesh
            material={RAIL_MATERIAL}
            position={[0, y0 + height / 2, z - 0.0016]}
          >
            <boxGeometry args={[0.018, height, 0.003]} />
          </mesh>
          {/* U boundary notches */}
          {Array.from({ length: span + 1 }, (_, u) => (
            <mesh
              key={`u-${u}`}
              material={HOLE_MATERIAL}
              position={[0.012, y0 + u * U_METERS, z - 0.0014]}
            >
              <boxGeometry args={[0.004, 0.0006, 0.0034]} />
            </mesh>
          ))}
          {/* EIA mounting holes on the flange face */}
          {holes.map((hole, i) => (
            <mesh
              key={i}
              geometry={HOLE_GEOMETRY}
              material={HOLE_MATERIAL}
              position={[0, hole[1], z - 0.0004]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

/** Translucent cavity inserts for every authored port + suggestions. */
function PortInserts() {
  const ports = useAuthoringStore((s) => s.ports);
  const suggestions = useAuthoringStore((s) => s.suggestions);
  const selection = useAuthoringStore((s) => s.selection);
  const select = useAuthoringStore((s) => s.select);
  const mode = useAuthoringStore((s) => s.mode);
  const category = useAuthoringStore((s) => s.category);
  const previewVisible = useAuthoringStore((s) => s.previewVisible);
  const previewIntensity = useAuthoringStore((s) => s.previewIntensity);

  // Preview intensity drives the shared materials — no per-port cost.
  useEffect(() => {
    INSERT_MATERIAL.opacity = 0.3 * previewIntensity + 0.06;
    SELECTED_MATERIAL.opacity = 0.45 * previewIntensity + 0.2;
  }, [previewIntensity]);

  const portCategory =
    category === 'ports' ||
    category === 'power' ||
    category === 'anchors' ||
    category === 'validation';
  if (mode !== 'edit' || !previewVisible || !portCategory) return null;

  return (
    <group>
      {ports.map((port) => {
        const selected = selection.includes(port.id);
        // Data ports dim in the Power category and vice versa, matching
        // the layout map below the viewport.
        const inFocus =
          category === 'power'
            ? isPowerType(port.type)
            : category === 'ports'
              ? !isPowerType(port.type)
              : true;
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
              material={
                selected
                  ? SELECTED_MATERIAL
                  : inFocus
                    ? INSERT_MATERIAL
                    : DIMMED_MATERIAL
              }
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
      <ConnectorPreviews />
    </group>
  );
}

/* ---- cable connection preview (selected ports) ------------------------ */

const EXIT_SHAFT = new CylinderGeometry(0.0008, 0.0008, 1, 8);
EXIT_SHAFT.rotateX(Math.PI / 2);
const EXIT_TIP = new CylinderGeometry(0, 0.0028, 0.008, 12);
EXIT_TIP.rotateX(Math.PI / 2);
const EXIT_MATERIAL = new MeshBasicMaterial({
  color: '#4c82f7',
  toneMapped: false,
});
const ANCHOR_MATERIAL = new MeshBasicMaterial({
  color: '#ffd166',
  toneMapped: false,
});
const ANCHOR_GEOMETRY = new CylinderGeometry(0.0022, 0.0022, 0.0012, 14);
ANCHOR_GEOMETRY.rotateX(Math.PI / 2);

/** Authored cable exit direction, normalized (device-local). */
function exitVector(port: AuthoredPort): Vec3 {
  const out = port.location === 'front' ? 1 : -1;
  const e = port.exitDirMm;
  if (e) {
    const length = Math.hypot(e[0], e[1], e[2]);
    if (length > 1e-6) return [e[0] / length, e[1] / length, e[2] / length];
  }
  return [0, 0, out];
}

/**
 * For every selected port: the real connector inserted exactly as a
 * cable will sit (RJ45 for copper, barrel plug otherwise), the authored
 * exit-direction arrow and the cable-anchor marker. Pure authoring
 * feedback — never rendered outside this mode.
 */
function ConnectorPreviews() {
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const category = useAuthoringStore((s) => s.category);
  const selected = selectedPorts({ ports, selection });

  // The validation category shows inserts for orientation, but keeps
  // the stage free of connector overlays.
  if (category === 'validation') return null;

  return (
    <>
      {selected.map((port) => {
        const exit = exitVector(port);
        const quaternion = plugQuaternion(exit);
        const copper = port.type in DEFAULT_INSERTION_MM;
        const insertionM =
          (port.insertionMm ??
            DEFAULT_INSERTION_MM[port.type] ??
            GENERIC_INSERTION_MM) * MM_TO_M;
        const surface = mm(port.positionMm);
        const plugPos: Vec3 = [
          surface[0] - exit[0] * insertionM,
          surface[1] - exit[1] * insertionM,
          surface[2] - exit[2] * insertionM,
        ];
        const anchor: Vec3 = [
          surface[0] + port.anchorMm[0] * MM_TO_M,
          surface[1] + port.anchorMm[1] * MM_TO_M,
          surface[2] + port.anchorMm[2] * MM_TO_M,
        ];
        const arrowLen =
          Math.max(Math.hypot(...port.anchorMm), 12) * MM_TO_M + 0.012;
        return (
          <group key={`preview-${port.id}`}>
            <group position={plugPos} quaternion={quaternion}>
              {copper ? (
                <Rj45Plug color="#3f66d0" cableRadiusM={0.00275} />
              ) : (
                <GenericPlug color="#3f66d0" cableRadiusM={0.00275} />
              )}
            </group>
            {/* Exit direction (authored exitDirMm, or the panel normal) */}
            <group position={surface} quaternion={quaternion}>
              <mesh
                geometry={EXIT_SHAFT}
                material={EXIT_MATERIAL}
                position={[0, 0, arrowLen / 2]}
                scale={[1, 1, arrowLen]}
              />
              <mesh
                geometry={EXIT_TIP}
                material={EXIT_MATERIAL}
                position={[0, 0, arrowLen]}
              />
            </group>
            {/* Cable anchor (plug body end / sheath start) */}
            <mesh
              geometry={ANCHOR_GEOMETRY}
              material={ANCHOR_MATERIAL}
              position={anchor}
            />
          </group>
        );
      })}
    </>
  );
}

/* ---- category markers: LEDs, display, cooling ------------------------- */

const DISC_GEOMETRY = new CylinderGeometry(1, 1, 1, 20);
DISC_GEOMETRY.rotateX(Math.PI / 2); // axis onto Z
const RING_GEOMETRY = new TorusGeometry(1, 0.08, 8, 28);
const RING_MATERIAL = new MeshBasicMaterial({
  color: '#9dbcff',
  toneMapped: false,
});
const HIT_MATERIAL = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const DISPLAY_GLASS = new MeshBasicMaterial({
  color: '#69d2ff',
  transparent: true,
  opacity: 0.22,
  toneMapped: false,
  depthWrite: false,
});
const FAN_MATERIAL = new MeshBasicMaterial({
  color: '#3fb970',
  transparent: true,
  opacity: 0.28,
  toneMapped: false,
  depthWrite: false,
});

/** Category-specific stage overlays (device-local space). */
function CategoryMarkers({ definition }: { definition: DeviceDefinition }) {
  const category = useAuthoringStore((s) => s.category);
  const mode = useAuthoringStore((s) => s.mode);
  if (mode !== 'edit') return null;
  return (
    <>
      {category === 'leds' && <LedMarkers />}
      {category === 'displays' && <DisplayMarker definition={definition} />}
      {category === 'cooling' && <FanMarkers />}
    </>
  );
}

/**
 * Authored LEDs as emissive discs at their true size, with an enlarged
 * invisible hit disc so a 2 mm LED is still clickable. Selection rings
 * the active LED for the gizmo.
 */
function LedMarkers() {
  const leds = useAuthoringStore((s) => s.leds);
  const selectedLedId = useAuthoringStore((s) => s.selectedLedId);
  const selectLed = useAuthoringStore((s) => s.selectLed);

  return (
    <group>
      {leds.map((led) => {
        const r = (Math.max(led.diameterMm, 1.2) / 2) * MM_TO_M;
        const hitR = Math.max(r * 2.5, 0.003);
        const selected = led.id === selectedLedId;
        const out = led.positionMm[2] >= 0 ? 1 : -1;
        return (
          <group key={led.id} position={mm(led.positionMm)}>
            <mesh geometry={DISC_GEOMETRY} scale={[r, r, 0.0012]}>
              <meshBasicMaterial
                color={led.on ? led.color : '#41474f'}
                toneMapped={false}
                transparent
                opacity={led.on ? Math.min(1, 0.4 + 0.6 * led.intensity) : 0.9}
                depthWrite={false}
              />
            </mesh>
            <mesh
              geometry={DISC_GEOMETRY}
              material={HIT_MATERIAL}
              scale={[hitR, hitR, 0.004]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                if (e.delta > 4) return;
                selectLed(led.id);
              }}
            />
            {selected && (
              <mesh
                geometry={RING_GEOMETRY}
                material={RING_MATERIAL}
                position={[0, 0, out * 0.0012]}
                scale={[hitR, hitR, hitR]}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** The display glass area + bezel outline at its authored position. */
function DisplayMarker({ definition }: { definition: DeviceDefinition }) {
  const display = useAuthoringStore((s) => s.display);
  if (!display?.lcd) return null;
  const w = (display.widthMm ?? 60) * MM_TO_M;
  const h = (display.heightMm ?? 25) * MM_TO_M;
  const bezel = (display.bezelMm ?? 2) * MM_TO_M;
  const pos = (display.positionMm ?? [0, 0, definition.depthMm / 2]) as Vec3;
  return (
    <group position={mm(pos)}>
      <mesh geometry={UNIT_BOX} material={DISPLAY_GLASS} scale={[w, h, 0.0008]} />
      <lineSegments
        geometry={UNIT_EDGES}
        material={EDGE_MATERIAL}
        scale={[w + bezel * 2, h + bezel * 2, 0.0014]}
      />
    </group>
  );
}

/** Fan rotors as translucent discs; click selects for the gizmo. */
function FanMarkers() {
  const cooling = useAuthoringStore((s) => s.cooling);
  const selectedFan = useAuthoringStore((s) => s.selectedFan);
  const selectFan = useAuthoringStore((s) => s.selectFan);
  const fans = cooling?.fanPositionsMm ?? [];
  const r = ((cooling?.fanDiameterMm ?? 40) / 2) * MM_TO_M;

  return (
    <group>
      {fans.map((fan, i) => (
        <group key={i} position={mm(fan as Vec3)}>
          <mesh
            geometry={DISC_GEOMETRY}
            material={FAN_MATERIAL}
            scale={[r, r, 0.002]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.delta > 4) return;
              selectFan(i);
            }}
          />
          <mesh
            geometry={RING_GEOMETRY}
            material={selectedFan === i ? RING_MATERIAL : FAN_MATERIAL}
            scale={[r, r, r]}
          />
        </group>
      ))}
    </group>
  );
}

/** What the transform gizmo is currently bound to. */
type GizmoKind = 'port' | 'anchor' | 'led' | 'display' | 'fan';

/**
 * CAD transform gizmo bound to the active category's selection: ports
 * (translate/rotate/scale + multi-move), a port's cable anchor, an LED,
 * the display (translate/scale) or a fan — all through one proxy
 * Object3D written back to the store in device mm. Grid snapping comes
 * from TransformControls' translationSnap; ports additionally get
 * magnetic alignment. Dragging pauses the camera controls (drei
 * wiring); beginTransform() records exactly one undo entry per drag.
 */
function SelectionGizmo({
  origin,
  definition,
}: {
  origin: Vec3;
  definition: DeviceDefinition;
}) {
  const tool = useAuthoringStore((s) => s.tool);
  const mode = useAuthoringStore((s) => s.mode);
  const category = useAuthoringStore((s) => s.category);
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const snap = useAuthoringStore((s) => s.snap);
  const leds = useAuthoringStore((s) => s.leds);
  const selectedLedId = useAuthoringStore((s) => s.selectedLedId);
  const display = useAuthoringStore((s) => s.display);
  const cooling = useAuthoringStore((s) => s.cooling);
  const selectedFan = useAuthoringStore((s) => s.selectedFan);

  const port = primaryPort({ ports, selection });
  const led = leds.find((l) => l.id === selectedLedId);
  const fan =
    selectedFan !== null
      ? (cooling?.fanPositionsMm?.[selectedFan] as Vec3 | undefined)
      : undefined;

  // Resolve the gizmo binding for the active category.
  let kind: GizmoKind | null = null;
  let targetPosMm: Vec3 | null = null;
  let targetRotDeg: Vec3 = [0, 0, 0];
  if (category === 'anchors') {
    if (port) {
      kind = 'anchor';
      targetPosMm = [
        port.positionMm[0] + port.anchorMm[0],
        port.positionMm[1] + port.anchorMm[1],
        port.positionMm[2] + port.anchorMm[2],
      ];
    }
  } else if (category === 'leds') {
    if (led) {
      kind = 'led';
      targetPosMm = led.positionMm;
    }
  } else if (category === 'displays') {
    if (display?.lcd) {
      kind = 'display';
      targetPosMm = (display.positionMm ?? [
        0,
        0,
        definition.depthMm / 2,
      ]) as Vec3;
    }
  } else if (category === 'cooling') {
    if (fan) {
      kind = 'fan';
      targetPosMm = fan;
    }
  } else if (category !== 'mount' && port) {
    kind = 'port';
    targetPosMm = port.positionMm;
    targetRotDeg = port.rotationDeg;
  }

  const proxy = useMemo(() => new Object3D(), []);
  // Target state at the start of a drag, so deltas stay absolute.
  const dragBase = useRef<AuthoredPort | null>(null);
  const dragOrigins = useRef(new Map<string, AuthoredPort>());
  const dragDisplayBase = useRef<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep the proxy in sync with the bound target between drags.
  const posKey = targetPosMm ? targetPosMm.join(',') : '';
  const rotKey = targetRotDeg.join(',');
  useEffect(() => {
    if (!targetPosMm || dragging) return;
    const [x, y, z] = mm(targetPosMm);
    proxy.position.set(x + origin[0], y + origin[1], z + origin[2]);
    proxy.rotation.set(...degToRad(targetRotDeg));
    proxy.scale.set(1, 1, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, posKey, rotKey, proxy, dragging, origin[0], origin[1], origin[2]]);

  if (mode !== 'edit' || !kind || !targetPosMm || tool === 'select') return null;

  // Ports keep the full toolset; the display supports translate/scale;
  // anchors, LEDs and fans are position-only.
  const gizmoMode =
    kind === 'port'
      ? tool === 'move'
        ? 'translate'
        : tool === 'rotate'
          ? 'rotate'
          : 'scale'
      : kind === 'display' && tool === 'scale'
        ? 'scale'
        : 'translate';

  const applyChange = () => {
    const state = useAuthoringStore.getState();
    const raw: Vec3 = [
      (proxy.position.x - origin[0]) / MM_TO_M,
      (proxy.position.y - origin[1]) / MM_TO_M,
      (proxy.position.z - origin[2]) / MM_TO_M,
    ];

    if (kind === 'port') {
      const current = primaryPort(state);
      const base = dragBase.current;
      if (!current || !base) return;
      if (gizmoMode === 'translate') {
        const snapped = snapPosition(current, raw, state.ports, state.snap);
        // Multi-selection moves rigidly with the primary port.
        const delta: Vec3 = [
          snapped[0] - base.positionMm[0],
          snapped[1] - base.positionMm[1],
          snapped[2] - base.positionMm[2],
        ];
        for (const id of state.selection) {
          const start =
            id === current.id ? base : dragOrigins.current.get(id);
          if (!start) continue;
          state.movePort(id, [
            start.positionMm[0] + delta[0],
            start.positionMm[1] + delta[1],
            start.positionMm[2] + delta[2],
          ]);
        }
      } else if (gizmoMode === 'rotate') {
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
      return;
    }

    if (kind === 'anchor') {
      const current = primaryPort(state);
      if (!current) return;
      state.moveAnchor(current.id, [
        raw[0] - current.positionMm[0],
        raw[1] - current.positionMm[1],
        raw[2] - current.positionMm[2],
      ]);
    } else if (kind === 'led' && selectedLedId) {
      state.moveLed(selectedLedId, raw);
    } else if (kind === 'fan' && selectedFan !== null) {
      state.moveFan(selectedFan, raw);
    } else if (kind === 'display') {
      if (gizmoMode === 'scale') {
        const base = dragDisplayBase.current;
        if (!base) return;
        state.resizeDisplay(base.w * proxy.scale.x, base.h * proxy.scale.y);
      } else {
        state.moveDisplay(raw);
      }
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
        state.beginTransform();
        dragBase.current = primaryPort(state);
        dragOrigins.current = new Map(
          state.selection.map((id) => [
            id,
            state.ports.find((p) => p.id === id)!,
          ]),
        );
        dragDisplayBase.current = state.display
          ? {
              w: state.display.widthMm ?? 60,
              h: state.display.heightMm ?? 25,
            }
          : null;
        setDragging(true);
      }}
      onMouseUp={() => {
        setDragging(false);
        dragBase.current = null;
        dragDisplayBase.current = null;
        // Re-sync happens via the effect on next render.
      }}
      />
    </>
  );
}

/** Camera: initial framing + one-shot frame commands from the chrome. */
function AuthoringCameraRig({
  definition,
  marqueeActive,
}: {
  definition: DeviceDefinition;
  marqueeActive: boolean;
}) {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const command = useAuthoringStore((s) => s.cameraCommand);
  const mountPreview = useAuthoringStore((s) => s.mountPreview);
  const invalidate = useThree((s) => s.invalidate);

  // A marquee drag owns the pointer.
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) controls.enabled = !marqueeActive;
  }, [marqueeActive]);

  const frame = (face: 'front' | 'rear', portsOnly: boolean) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const [ox, oy, oz] = deviceOrigin.current;
    const out = face === 'front' ? 1 : -1;
    const halfDepth = (definition.depthMm / 2) * MM_TO_M;

    let cx = ox;
    let cy = oy;
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
        cx = ox + (((min + max) / 2) * MM_TO_M || 0);
        cy = oy + ((Math.min(...ys) + Math.max(...ys)) / 2) * MM_TO_M;
        span = Math.max(0.08, (max - min + 60) * MM_TO_M);
      }
    }
    const distance = Math.max(0.18, (span / 2) / Math.tan(MathUtils.degToRad(22.5)) * 1.15);
    void controls.setLookAt(
      cx,
      cy + distance * 0.18,
      oz + out * (halfDepth + distance),
      cx,
      cy,
      oz + out * halfDepth,
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

  // Toggling the Mount Preview moves the device — follow it.
  const firstMountRender = useRef(true);
  useEffect(() => {
    if (firstMountRender.current) {
      firstMountRender.current = false;
      return;
    }
    frame('front', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountPreview]);

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
