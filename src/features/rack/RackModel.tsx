import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, MathUtils } from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { ObstructionFader } from './ObstructionFader';
import { RackSelection } from './RackSelection';
import { RACK_DIMS, RACK_FINISHES, railHeight } from './rackConstants';
import { rackHeightFor } from './rackMath';
import { useRackGeometry } from './useRackGeometry';
import { DEBUG_DIMS_ENABLED, DebugDimensions } from './DebugDimensions';
import { createRackMaterials } from './rackMaterials';
import { createRailTexture, createTextTexture } from './rackTextures';
import { MountedDevices } from '@/features/devices/MountedDevices';
import { CableEditLayer } from '@/features/cables/CableEditLayer';
import { CableLayer } from '@/features/cables/CableLayer';
import { CableToolLayer } from '@/features/cables/CableToolLayer';
import { DragPlacementLayer } from '@/features/dragdrop/DragPlacementLayer';
import { GhostDevice } from '@/features/dragdrop/GhostDevice';
import { VIEWPORT_THEME } from '@/features/viewport/viewportTheme';
import { shouldSuppressClick } from '@/stores/dragStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useViewportStore } from '@/stores/viewportStore';
import type { RackConfig, ResolvedTheme } from '@/types';

const ENTRANCE_SECONDS = 0.85;
/** Small overlap so the L-profile web tucks behind the flange seamlessly. */
const WELD_OVERLAP = 0.002;

interface RackModelProps {
  rack: RackConfig;
  theme: ResolvedTheme;
}

/**
 * Parametric open-frame 19in rack built to EIA-310 proportions. Each
 * upright is a true L-profile (mounting flange + rearward web), joined by
 * a top frame with corner caps and fasteners over a base plinth with
 * leveling feet. Entrance and front/rear orientation are animated inside
 * the render loop with damped easing.
 */
export function RackModel({ rack, theme }: RackModelProps) {
  const groupRef = useRef<Group>(null);
  const bornAt = useRef<number>(-1);
  const [hovered, setHovered] = useState(false);

  const selected = useSelectionStore((s) => s.selection?.kind === 'rack');
  const selectRack = useSelectionStore((s) => s.selectRack);
  const dispatchCamera = useViewportStore((s) => s.dispatchCamera);

  const finish = RACK_FINISHES[rack.finish];
  const accent = VIEWPORT_THEME[theme].accent;

  const geometry = useRackGeometry(rack);

  const W = geometry.externalWidthM;
  const D = geometry.externalDepthM;
  const H = rackHeightFor(rack.units, geometry);
  const railH = railHeight(rack.units);
  const railY0 = geometry.railBaseYM;
  const { opening, uprightW, uprightD, flangeD, webT, webD, topH } = RACK_DIMS;

  const compact = geometry.profile.baseType === 'compact-feet';
  const feetH = compact ? 0.008 : RACK_DIMS.feetH;
  const baseH = railY0 - feetH;

  const uprightX = opening / 2 + uprightW / 2;
  const railCenterY = railY0 + railH / 2;
  const topY = railY0 + railH + topH / 2;
  const uprightH = railH + baseH;
  const uprightY = feetH + uprightH / 2;
  const labelW = uprightW * 0.94;

  const corners = useMemo(
    () =>
      ([1, -1] as const)
        .filter((sz) => sz === 1 || rack.showRearPosts)
        .flatMap((sz) => ([-1, 1] as const).map((sx) => ({ sx, sz }))),
    [rack.showRearPosts],
  );

  const materials = useMemo(() => createRackMaterials(finish), [finish]);
  useEffect(() => () => materials.dispose(), [materials]);

  // Rail label textures — regenerated once webfonts are ready so numbers
  // render in Inter rather than the fallback face.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const railTextures = useMemo(
    () => ({
      holesLeft: createRailTexture(rack.units, finish, false),
      holesRight: createRailTexture(rack.units, finish, true),
    }),
    // fontsReady is intentionally a dependency: it forces one regenerate
    // after Inter finishes loading.
    [rack.units, finish, fontsReady],
  );
  useEffect(() => {
    return () => {
      railTextures.holesLeft.dispose();
      railTextures.holesRight.dispose();
    };
  }, [railTextures]);

  const markerTexture = useMemo(
    () => createTextTexture('FRONT', VIEWPORT_THEME[theme].markerInk),
    [theme],
  );
  useEffect(() => () => markerTexture.dispose(), [markerTexture]);

  // Entrance + orientation animation
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (bornAt.current < 0) bornAt.current = state.clock.elapsedTime;
    const p = Math.min(
      (state.clock.elapsedTime - bornAt.current) / ENTRANCE_SECONDS,
      1,
    );
    const ease = 1 - Math.pow(1 - p, 3);
    group.scale.setScalar(0.94 + 0.06 * ease);
    group.position.y = 0.12 * (1 - ease);

    const target = rack.orientation === 'front' ? 0 : Math.PI;
    group.rotation.y = MathUtils.damp(group.rotation.y, target, 5, delta);
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // The click that ends a device drop must not re-select the rack.
    if (shouldSuppressClick()) return;
    selectRack();
  };
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    dispatchCamera({ type: 'fit' });
  };

  // Corner-post pieces, measured from the enclosure's outer faces (±D/2).
  const flangeZ = (sz: 1 | -1) => sz * (D / 2 - flangeD / 2);
  const webZ = (sz: 1 | -1) => sz * (D / 2 - flangeD - webD / 2 + WELD_OVERLAP);
  const postCenterZ = (sz: 1 | -1) => sz * (D / 2 - uprightD / 2);

  // Rail mounting planes. Open frames mount on the corner posts
  // themselves; cabinets have separate inner rails at these planes.
  const railLabelZ = (sz: 1 | -1) =>
    sz === 1 ? geometry.frontRailZ + 0.0012 : geometry.rearRailZ - 0.0012;
  const innerRailZ = (sz: 1 | -1) =>
    sz === 1
      ? geometry.frontRailZ - flangeD / 2
      : geometry.rearRailZ + flangeD / 2;

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Upright L-profiles: mounting flange + rearward web on the outer edge */}
      {corners.map(({ sx, sz }) => (
        <group key={`upright-${sx}-${sz}`}>
          <RoundedBox
            args={[uprightW, uprightH, flangeD]}
            radius={0.002}
            smoothness={4}
            position={[sx * uprightX, uprightY, flangeZ(sz)]}
            castShadow
            receiveShadow
            material={materials.upright}
          />
          <RoundedBox
            args={[webT, uprightH, webD]}
            radius={0.002}
            smoothness={4}
            position={[
              sx * (uprightX + uprightW / 2 - webT / 2),
              uprightY,
              webZ(sz),
            ]}
            castShadow
            receiveShadow
            material={materials.upright}
          />
        </group>
      ))}

      {/* Cabinet inner rails: separate uprights at the mounting planes */}
      {geometry.hasInnerRails &&
        corners.map(({ sx, sz }) => (
          <RoundedBox
            key={`rail-${sx}-${sz}`}
            args={[uprightW, railH, flangeD]}
            radius={0.002}
            smoothness={4}
            position={[sx * uprightX, railCenterY, innerRailZ(sz)]}
            castShadow
            receiveShadow
            material={materials.upright}
          />
        ))}

      {/* Cabinet interior floor: the enclosure physically contains gear */}
      {geometry.hasInnerRails && (
        <RoundedBox
          args={[W - 2 * uprightW, 0.008, D - 2 * uprightD]}
          radius={0.002}
          smoothness={2}
          position={[0, railY0 - 0.005, 0]}
          receiveShadow
          material={materials.plinth}
        />
      )}

      {/* Rail label strips: unit numbers + cage-nut holes at each plane */}
      {rack.showUnitNumbers &&
        corners.map(({ sx, sz }) => (
          <mesh
            key={`labels-${sx}-${sz}`}
            position={[sx * uprightX, railCenterY, railLabelZ(sz)]}
            rotation={[0, sz === 1 ? 0 : Math.PI, 0]}
          >
            <planeGeometry args={[labelW, railH]} />
            {/* Holes hug the inner edge: as seen from the viewer, the
                right-hand rail's inner edge is its left side. */}
            <meshBasicMaterial
              map={
                (sz === 1) === (sx === 1)
                  ? railTextures.holesLeft
                  : railTextures.holesRight
              }
              transparent
              toneMapped={false}
            />
          </mesh>
        ))}

      {/* Top frame beams */}
      {([1, -1] as const)
        .filter((sz) => sz === 1 || rack.showRearPosts)
        .map((sz) => (
          <RoundedBox
            key={`top-x-${sz}`}
            args={[W - uprightW, topH, uprightD]}
            radius={0.003}
            smoothness={4}
            position={[0, topY, postCenterZ(sz)]}
            castShadow
            receiveShadow
            material={materials.frame}
          />
        ))}
      {rack.showRearPosts &&
        [-1, 1].map((sx) => (
          <RoundedBox
            key={`top-z-${sx}`}
            args={[uprightW - 0.008, topH, D - 2 * uprightD]}
            radius={0.003}
            smoothness={4}
            position={[sx * uprightX, topY, 0]}
            castShadow
            receiveShadow
            material={materials.frame}
          />
        ))}

      {/* Corner caps + fasteners where the top frame meets the uprights */}
      {corners.map(({ sx, sz }) => (
        <group key={`cap-${sx}-${sz}`}>
          <RoundedBox
            args={[uprightW + 0.008, topH + 0.008, uprightD + 0.008]}
            radius={0.003}
            smoothness={4}
            position={[sx * uprightX, topY, postCenterZ(sz)]}
            castShadow
            receiveShadow
            material={materials.frame}
          />
          <mesh
            position={[
              sx * uprightX,
              topY + (topH + 0.008) / 2 + 0.0016,
              postCenterZ(sz),
            ]}
            castShadow
            material={materials.hardware}
          >
            <cylinderGeometry args={[0.0055, 0.0055, 0.0035, 20]} />
          </mesh>
        </group>
      ))}

      {/* Base plinth, corner bolts and leveling feet */}
      <RoundedBox
        args={[
          W + 0.016,
          baseH,
          rack.showRearPosts ? D + (compact ? 0 : 0.05) : uprightD + 0.12,
        ]}
        radius={0.006}
        smoothness={4}
        position={[
          0,
          feetH + baseH / 2,
          rack.showRearPosts ? 0 : D / 2 - uprightD / 2 - 0.02,
        ]}
        castShadow
        receiveShadow
        material={materials.plinth}
      />
      {rack.showRearPosts &&
        !compact &&
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`bolt-${sx}-${sz}`}
              position={[
                sx * (W / 2 - 0.045),
                feetH + baseH + 0.0016,
                sz * (D / 2 - 0.028),
              ]}
              material={materials.hardware}
            >
              <cylinderGeometry args={[0.005, 0.005, 0.0035, 20]} />
            </mesh>
          )),
        )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`foot-${sx}-${sz}`}
            position={[
              sx * (W / 2 - 0.03),
              feetH / 2,
              rack.showRearPosts
                ? sz * (D / 2 - 0.02)
                : D / 2 - uprightD / 2 - 0.02 + sz * 0.05,
            ]}
            castShadow
            material={materials.hardware}
          >
            <cylinderGeometry
              args={compact ? [0.01, 0.012, feetH, 16] : [0.018, 0.023, feetH, 20]}
            />
          </mesh>
        )),
      )}

      {/* FRONT floor marker */}
      {rack.showFloorMarker && (
        <mesh
          position={[0, 0.0025, D / 2 + 0.16]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.34, 0.085]} />
          <meshBasicMaterial
            map={markerTexture}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Mounted devices (inherit the rack's animation and orientation) */}
      <MountedDevices theme={theme} geometry={geometry} />

      {/* Drag placement: raycast surfaces + live ghost preview */}
      <DragPlacementLayer rack={rack} geometry={geometry} />
      <GhostDevice geometry={geometry} />

      {/* Cables + Cable Tool (inherit rack orientation and animation) */}
      <CableLayer rack={rack} geometry={geometry} />
      <CableToolLayer geometry={geometry} />
      <CableEditLayer geometry={geometry} />

      {/* Close-up visibility: fade structure blocking the focused view */}
      <ObstructionFader
        groupRef={groupRef}
        materials={[
          materials.upright,
          materials.frame,
          materials.plinth,
          materials.hardware,
        ]}
      />

      {DEBUG_DIMS_ENABLED && <DebugDimensions geometry={geometry} />}

      {/* Selection / hover feedback */}
      {(selected || hovered) && (
        <RackSelection
          width={W}
          height={H}
          depth={D}
          accent={accent}
          selected={selected}
        />
      )}
    </group>
  );
}
