import { Html, Line } from '@react-three/drei';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import {
  devicePlacement,
  MM_TO_M,
  uSlotY,
  type RackGeometry,
} from './rackMath';
import { U_METERS } from './rackConstants';

/**
 * Development-only side-view dimension overlay, enabled with ?debugDims.
 * Draws measurement lines for the rack's external depth, rail spacing,
 * and — for the first mounted device — device depth and remaining rear
 * clearance. Ships inert (query-param gated).
 */
export const DEBUG_DIMS_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debugDims');

const LINE_X = 0.36; // beside the rack, visible from the side views

function Dim({
  z1,
  z2,
  y,
  label,
  color,
}: {
  z1: number;
  z2: number;
  y: number;
  label: string;
  color: string;
}) {
  const mm = Math.round(Math.abs(z2 - z1) * 1000);
  return (
    <group position={[LINE_X, y, 0]}>
      <Line
        points={[
          [0, 0, z1],
          [0, 0, z2],
        ]}
        color={color}
        lineWidth={1.5}
      />
      {[z1, z2].map((z) => (
        <Line
          key={z}
          points={[
            [0, -0.012, z],
            [0, 0.012, z],
          ]}
          color={color}
          lineWidth={1.5}
        />
      ))}
      <Html
        position={[0, 0.03, (z1 + z2) / 2]}
        center
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            color,
            background: 'rgba(10, 11, 13, 0.75)',
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {label} {mm} mm
        </span>
      </Html>
    </group>
  );
}

export function DebugDimensions({ geometry }: { geometry: RackGeometry }) {
  const instances = useDeviceInstancesStore((s) => s.instances);
  const first = instances[0];
  const definition = first ? getDevice(first.definitionId) : undefined;

  const halfD = geometry.externalDepthM / 2;

  return (
    <group>
      <Dim
        z1={halfD}
        z2={-halfD}
        y={0.04}
        label="external"
        color="#e8a33d"
      />
      <Dim
        z1={geometry.frontRailZ}
        z2={geometry.rearRailZ}
        y={geometry.railBaseYM + 0.02 + U_METERS * 0}
        label="rails"
        color="#4c82f7"
      />
      {first && definition && (
        <>
          {(() => {
            const { position } = devicePlacement(
              definition,
              first.startU,
              first.facing,
              geometry,
            );
            const y =
              uSlotY(first.startU, geometry.railBaseYM) +
              definition.rackUnits * U_METERS +
              0.03;
            const halfDev = (definition.depthMm * MM_TO_M) / 2;
            const devFront = position[2] + halfDev;
            const devRear = position[2] - halfDev;
            return (
              <>
                <Dim
                  z1={devFront}
                  z2={devRear}
                  y={y}
                  label="device"
                  color="#3fb970"
                />
                <Dim
                  z1={devRear}
                  z2={geometry.rearRailZ}
                  y={y + 0.05}
                  label="rear clearance"
                  color="#e5544b"
                />
              </>
            );
          })()}
        </>
      )}
    </group>
  );
}
