import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { solveMounting, type MountingSolution } from '@/features/rack/mechanics';
import { MM_TO_M, SHELF_THICKNESS_M, type RackGeometry } from '@/features/rack/rackMath';
import { RACK_DIMS, U_METERS } from '@/features/rack/rackConstants';
import type { DeviceDefinition } from './deviceSchema';

/**
 * Parametric mounting hardware, in device-local space (chassis center at
 * the origin, faceplate toward +Z). Everything derives from the device's
 * mechanical metadata and the rack geometry — no device-specific code:
 *
 * - front mounting ears bolt to the front rail plane
 * - rear brackets carry the tail when it reaches the rear rails
 * - full-length side support rails carry it when the profile has them
 * - shelf-mounted devices rest on a cantilever shelf surface
 *
 * A handful of boxes and bolt heads per device — cheap to render.
 */

/** Ear flange width past the chassis side (overlaps the rail face). */
const EAR_WING_M = 0.016;
/** Return web depth along the chassis side. */
const EAR_WEB_M = 0.016;
/** Vertical clearance between ear plate and the U boundaries. */
const EAR_TRIM_M = 0.004;
const BOLT_RADIUS_M = 0.0045;
const BOLT_HEIGHT_M = 0.0028;
/** Support-rail angle: seat width and lip height. */
const RAIL_SEAT_M = 0.016;
const RAIL_LIP_M = 0.012;
const RAIL_GAUGE_M = 0.0022;
/** Shelf lip past the device footprint. */
const SHELF_LIP_M = 0.02;

interface MountingHardwareProps {
  definition: DeviceDefinition;
  geometry: RackGeometry;
}

/** One mounting ear: flange + return web + per-U bolts. */
function Ear({
  side,
  z,
  halfW,
  units,
  thicknessM,
  material,
  bolts,
}: {
  side: 1 | -1;
  /** Z of the rail plane the flange sits against (device-local). */
  z: number;
  halfW: number;
  units: number;
  thicknessM: number;
  material: MeshStandardMaterial;
  bolts: boolean;
}) {
  const earH = units * U_METERS - 2 * EAR_TRIM_M;
  const flangeX = side * (halfW + EAR_WING_M / 2);
  const boltX = side * (halfW + EAR_WING_M * 0.58);
  const boltYs = Array.from({ length: units }, (_, u) => {
    const base = (u - (units - 1) / 2) * U_METERS;
    return [base - U_METERS * 0.3, base + U_METERS * 0.3];
  }).flat();

  return (
    <group>
      {/* Flange against the rail face */}
      <mesh
        position={[flangeX, 0, z + (thicknessM / 2) * Math.sign(z)]}
        castShadow
        material={material}
      >
        <boxGeometry args={[EAR_WING_M, earH, thicknessM]} />
      </mesh>
      {/* Return web hugging the chassis side */}
      <mesh
        position={[
          side * (halfW + thicknessM / 2),
          0,
          z - (EAR_WEB_M / 2) * Math.sign(z),
        ]}
        castShadow
        material={material}
      >
        <boxGeometry args={[thicknessM, earH, EAR_WEB_M]} />
      </mesh>
      {/* Cage-nut bolts, two per U */}
      {bolts &&
        boltYs.map((y, i) => (
          <mesh
            key={i}
            position={[boltX, y, z + (thicknessM + BOLT_HEIGHT_M / 2) * Math.sign(z)]}
            rotation={[Math.PI / 2, 0, 0]}
            material={material}
          >
            <cylinderGeometry args={[BOLT_RADIUS_M, BOLT_RADIUS_M, BOLT_HEIGHT_M, 12]} />
          </mesh>
        ))}
    </group>
  );
}

export function MountingHardware({ definition, geometry }: MountingHardwareProps) {
  const solution: MountingSolution = useMemo(
    () => solveMounting(definition, geometry),
    [definition, geometry],
  );

  const materials = useMemo(
    () => ({
      // Mounting ears/flanges/bolts that hold the device to the rails.
      // Brushed silver matched to the rack frame, kept only mildly
      // metallic so the light colour shows from any angle instead of
      // reflecting the dark surroundings and reading black.
      steel: new MeshStandardMaterial({
        color: '#c6cbd1',
        metalness: 0.45,
        roughness: 0.48,
      }),
      zinc: new MeshStandardMaterial({
        color: '#b3b9c0',
        metalness: 0.5,
        roughness: 0.4,
      }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.steel.dispose();
      materials.zinc.dispose();
    },
    [materials],
  );

  const halfW = (definition.widthMm * MM_TO_M) / 2;
  const halfH = (definition.heightMm * MM_TO_M) / 2;
  const halfD = (definition.depthMm * MM_TO_M) / 2;
  const units = Math.max(1, Math.round(definition.rackUnits));
  const thicknessM = solution.mechanical.earThicknessMm * MM_TO_M;
  const earZ =
    halfD +
    (solution.mechanical.earOffsetMm - solution.mechanical.frontMountPlaneMm) *
      MM_TO_M;
  const spacingM = geometry.railSpacingM;

  // Device is deeper than the rails can carry — nothing sane to render.
  if (solution.exceedsRailSpacing) return null;

  return (
    <group>
      {/* Front mounting ears on the front rail plane */}
      {solution.frontEars &&
        ([1, -1] as const).map((side) => (
          <Ear
            key={`front-${side}`}
            side={side}
            z={earZ}
            halfW={halfW}
            units={units}
            thicknessM={thicknessM}
            material={materials.steel}
            bolts
          />
        ))}

      {/* Rear brackets when the tail reaches the rear rails */}
      {solution.rearSupport === 'rear-ears' &&
        ([1, -1] as const).map((side) => (
          <Ear
            key={`rear-${side}`}
            side={side}
            z={-halfD - solution.rearGapMm * MM_TO_M}
            halfW={halfW}
            units={units}
            thicknessM={thicknessM}
            material={materials.steel}
            bolts
          />
        ))}

      {/* Telescoping rear brackets: L-angles bridging the tail of a
          shallow chassis to the rear rail plane, with a bolted rear
          flange — adjustable rear rails, exactly as installed in a
          real rack. */}
      {solution.rearSupport === 'telescoping' &&
        ([1, -1] as const).map((side) => {
          const gapM = solution.rearGapMm * MM_TO_M;
          const overlapM = Math.min(0.05, halfD); // grip under the chassis
          const barLen = gapM + overlapM;
          const barMidZ = -halfD + overlapM / 2 - gapM / 2;
          return (
            <group key={`telescope-${side}`}>
              {/* Horizontal seat carrying the chassis side */}
              <mesh
                position={[
                  side * (halfW - RAIL_SEAT_M / 2 + RAIL_GAUGE_M),
                  -halfH - RAIL_GAUGE_M / 2,
                  barMidZ,
                ]}
                castShadow
                receiveShadow
                material={materials.zinc}
              >
                <boxGeometry args={[RAIL_SEAT_M, RAIL_GAUGE_M, barLen]} />
              </mesh>
              {/* Vertical lip along the chassis side */}
              <mesh
                position={[
                  side * (halfW + RAIL_GAUGE_M / 2),
                  -halfH + RAIL_LIP_M / 2 - RAIL_GAUGE_M,
                  barMidZ,
                ]}
                castShadow
                material={materials.zinc}
              >
                <boxGeometry args={[RAIL_GAUGE_M, RAIL_LIP_M, barLen]} />
              </mesh>
              {/* Rear flange bolted to the rear rails */}
              <Ear
                side={side}
                z={-halfD - gapM}
                halfW={halfW}
                units={units}
                thicknessM={thicknessM}
                material={materials.steel}
                bolts
              />
            </group>
          );
        })}

      {/* Full-length side support rails from front to rear rail plane */}
      {solution.rearSupport === 'support-rails' &&
        ([1, -1] as const).map((side) => (
          <group key={`rail-${side}`} position={[0, 0, halfD - spacingM / 2]}>
            {/* Horizontal seat the chassis rests on */}
            <mesh
              position={[side * (halfW - RAIL_SEAT_M / 2 + RAIL_GAUGE_M), -halfH - RAIL_GAUGE_M / 2, 0]}
              castShadow
              receiveShadow
              material={materials.zinc}
            >
              <boxGeometry args={[RAIL_SEAT_M, RAIL_GAUGE_M, spacingM]} />
            </mesh>
            {/* Vertical lip along the chassis side */}
            <mesh
              position={[side * (halfW + RAIL_GAUGE_M / 2), -halfH + RAIL_LIP_M / 2 - RAIL_GAUGE_M, 0]}
              castShadow
              material={materials.zinc}
            >
              <boxGeometry args={[RAIL_GAUGE_M, RAIL_LIP_M, spacingM]} />
            </mesh>
          </group>
        ))}

      {/* Cantilever shelf under shelf-mounted devices */}
      {solution.onShelf && (
        <group>
          <mesh
            position={[0, -halfH - SHELF_THICKNESS_M / 2, -SHELF_LIP_M / 2]}
            castShadow
            receiveShadow
            material={materials.steel}
          >
            <boxGeometry
              args={[
                RACK_DIMS.opening - 0.006,
                SHELF_THICKNESS_M,
                halfD * 2 + SHELF_LIP_M,
              ]}
            />
          </mesh>
          {/* Front flange bolting the shelf to the rails */}
          {([1, -1] as const).map((side) => (
            <mesh
              key={`shelf-ear-${side}`}
              position={[
                side * (RACK_DIMS.opening / 2 + EAR_WING_M / 2 - 0.003),
                -halfH + U_METERS / 2 - SHELF_THICKNESS_M,
                halfD + thicknessM / 2,
              ]}
              castShadow
              material={materials.steel}
            >
              <boxGeometry args={[EAR_WING_M, U_METERS - 2 * EAR_TRIM_M, thicknessM]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
