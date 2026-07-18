import { useMemo } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { Instance, Instances } from '@react-three/drei';
import {
  resolveLeds,
  resolvePhysicalPorts,
  resolvePowerConnectors,
  rotatePortVector,
  CONNECTOR_SIZES,
  PORT_LED_DEFAULTS,
  type PhysicalConnectorType,
  type PhysicalPort,
} from './physicalPorts';
import { MM_TO_M } from '@/features/rack/rackMath';
import { EtherlightingLayer } from './etherlighting/EtherlightingLayer';
import { styleFor } from '../parametric/stylePresets';
import type { DeviceDefinition } from '../deviceSchema';

/**
 * Metadata-driven hardware rendering. Composes independent, optional
 * sub-renderers — ports, power, LEDs, Etherlighting, display, fans —
 * each of which renders nothing when its metadata is absent. There is
 * no device- or manufacturer-specific logic anywhere in this file.
 *
 * Performance: all connector bodies of a device render through two
 * instanced meshes (solid parts + emissive parts) sharing module-level
 * unit geometries and materials, with per-instance color and scale.
 * A 48-port panel costs the same draw calls as a 1-port box.
 */

/* ---- shared GPU resources (module singletons, never re-created) ----- */

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_DISC = new CylinderGeometry(0.5, 0.5, 1, 16);
UNIT_DISC.rotateX(Math.PI / 2); // axis toward +Z (panel normal)

const SOLID_MATERIAL = new MeshStandardMaterial({
  color: '#ffffff',
  metalness: 0.45,
  roughness: 0.5,
});
const EMISSIVE_MATERIAL = new MeshBasicMaterial({
  color: '#ffffff',
  toneMapped: false,
});

/* ---- connector part construction (pure) ----------------------------- */

interface Part {
  positionMm: [number, number, number];
  sizeMm: [number, number, number];
  rotationY: number;
  color: string;
}

const BEZEL_COLORS: Partial<Record<PhysicalConnectorType, string>> = {
  rj45: '#3b4148',
  keystone: '#2e3339',
  'poe-in': '#3b4148',
  console: '#2e6d75',
  sfp: '#6a727c',
  'sfp+': '#6a727c',
  sfp28: '#6a727c',
  'qsfp+': '#6a727c',
  qsfp28: '#6a727c',
  usb: '#868c95',
  'usb-a': '#868c95',
  'usb-c': '#868c95',
  hdmi: '#2c3138',
  displayport: '#2c3138',
  audio: '#23272d',
  'fiber-lc': '#2e6d75',
  phoenix: '#3f7d4a',
  serial: '#4a5058',
  power: '#1b1d21',
  dc: '#1b1d21',
  c14: '#1b1d21',
  c20: '#1b1d21',
  'iec-lock': '#1b1d21',
  nema: '#1b1d21',
  'external-adapter': '#1b1d21',
  other: '#3b4148',
};
const INSET_COLOR = '#0b0d10';

/** Shadowed interior of an empty keystone opening (a hole, not a jack). */
const KEYSTONE_HOLE_COLOR = '#1c2025';

/**
 * Bezel + inset boxes for one connector, in device-local mm. `frameColor`
 * is the host panel's own faceplate colour, used so keystone openings
 * read as punched holes in the plate rather than black jack heads.
 */
function connectorParts(port: PhysicalPort, frameColor: string): Part[] {
  const { widthMm: w, heightMm: h } = CONNECTOR_SIZES[port.type];
  const out = port.location === 'front' ? 1 : -1;
  const rotationY = port.location === 'front' ? 0 : Math.PI;
  const [x, y, z] = port.positionMm;

  // An empty keystone panel is a flat metal plate with rectangular
  // punch-outs — no protruding bezel, no inserted jack. Render the
  // opening as a shallow silver frame flush with the plate (matched to
  // the faceplate colour so it blends) around a dark recessed hole. The
  // same treatment on the rear face keeps it a clean feed-through panel.
  if (port.type === 'keystone') {
    return [
      {
        positionMm: [x, y, z + out * 0.25],
        sizeMm: [w, h, 1.3],
        rotationY,
        color: frameColor,
      },
      {
        positionMm: [x, y, z + out * 0.55],
        sizeMm: [w * 0.66, h * 0.82, 1.1],
        rotationY,
        color: KEYSTONE_HOLE_COLOR,
      },
    ];
  }

  const color = BEZEL_COLORS[port.type] ?? '#3b4148';
  return [
    {
      positionMm: [x, y, z + out * 0.6],
      sizeMm: [w, h, 2.6],
      rotationY,
      color,
    },
    {
      positionMm: [x, y, z + out * 1.4],
      sizeMm: [w * 0.72, h * 0.58, 1.4],
      rotationY,
      color: INSET_COLOR,
    },
  ];
}

const mm = (v: [number, number, number]): [number, number, number] => [
  v[0] * MM_TO_M,
  v[1] * MM_TO_M,
  v[2] * MM_TO_M,
];

/* ---- sub-renderers --------------------------------------------------- */

/** All connector bodies (ports + power inlets) as one instanced pair. */
function ConnectorsRenderer({ definition }: { definition: DeviceDefinition }) {
  const parts = useMemo(() => {
    // Keystone openings blend into the host plate: use its faceplate colour.
    const frameColor = styleFor(
      definition.presentation.styleKey ?? definition.manufacturerName,
      definition.presentation.tone,
    ).face;
    const all = [
      ...resolvePhysicalPorts(definition),
      ...resolvePowerConnectors(definition),
    ];
    return all.filter((p) => p.visible).flatMap((p) => connectorParts(p, frameColor));
  }, [definition]);

  if (parts.length === 0) return null;
  return (
    <Instances
      geometry={UNIT_BOX}
      material={SOLID_MATERIAL}
      limit={parts.length}
      castShadow
      frustumCulled={false}
    >
      {parts.map((part, i) => (
        <Instance
          key={i}
          position={mm(part.positionMm)}
          scale={mm(part.sizeMm)}
          rotation={[0, part.rotationY, 0]}
          color={part.color}
        />
      ))}
    </Instances>
  );
}

/**
 * Per-port link/activity LEDs: the small rectangular windows built into
 * real RJ45 bezels, rendered at the authored corner of each opening.
 */
function PortLedsRenderer({ definition }: { definition: DeviceDefinition }) {
  const leds = useMemo(
    () =>
      resolvePhysicalPorts(definition)
        .filter((p) => p.visible && p.led)
        .map((p) => {
          const led = p.led!;
          const [w, h] = p.sizeMm ?? [
            CONNECTOR_SIZES[p.type].widthMm,
            CONNECTOR_SIZES[p.type].heightMm,
          ];
          const lw = led.widthMm ?? PORT_LED_DEFAULTS.widthMm;
          const lh = led.heightMm ?? PORT_LED_DEFAULTS.heightMm;
          const corner = led.corner ?? PORT_LED_DEFAULTS.corner;
          const sx = corner.endsWith('right') ? 1 : -1;
          const sy = corner.startsWith('top') ? 1 : -1;
          const out = p.location === 'front' ? 1 : -1;
          // The window sits in the bezel band between the opening inset
          // and the bezel edge; the offset swings with the port roll.
          const local = rotatePortVector(
            [sx * (w / 2 - lw / 2 - 0.7), sy * (h / 2 - lh / 2 - 0.5), 0],
            p.rotationDeg,
          );
          return {
            ref: p.ref,
            positionMm: [
              p.positionMm[0] + local[0],
              p.positionMm[1] + local[1],
              p.positionMm[2] + local[2] + out * 2.1,
            ] as [number, number, number],
            sizeMm: [lw, lh, 0.9] as [number, number, number],
            rotationY: p.location === 'front' ? 0 : Math.PI,
            color: led.color ?? PORT_LED_DEFAULTS.color,
          };
        }),
    [definition],
  );

  if (leds.length === 0) return null;
  return (
    <Instances
      geometry={UNIT_BOX}
      material={EMISSIVE_MATERIAL}
      limit={leds.length}
      frustumCulled={false}
    >
      {leds.map((led) => (
        <Instance
          key={led.ref}
          position={mm(led.positionMm)}
          scale={mm(led.sizeMm)}
          rotation={[0, led.rotationY, 0]}
          color={led.color}
        />
      ))}
    </Instances>
  );
}

/** Indicator LEDs: instanced emissive discs, no real lights. */
function LedsRenderer({ definition }: { definition: DeviceDefinition }) {
  const leds = useMemo(
    () => resolveLeds(definition).filter((led) => led.on),
    [definition],
  );
  if (leds.length === 0) return null;
  return (
    <Instances
      geometry={UNIT_DISC}
      material={EMISSIVE_MATERIAL}
      limit={leds.length}
      frustumCulled={false}
    >
      {leds.map((led) => (
        <Instance
          key={led.id}
          position={mm([
            led.positionMm[0],
            led.positionMm[1],
            led.positionMm[2] + (led.positionMm[2] >= 0 ? 0.8 : -0.8),
          ])}
          scale={[led.diameterMm * MM_TO_M, led.diameterMm * MM_TO_M, 0.0012]}
          color={led.color}
        />
      ))}
    </Instances>
  );
}

/** Powered-off LCD glass with bezel; optional faint placeholder glow. */
function DisplayRenderer({ definition }: { definition: DeviceDefinition }) {
  const display = definition.display;
  if (!display?.lcd) return null;

  const w = (display.widthMm ?? 60) * MM_TO_M;
  const h = (display.heightMm ?? 25) * MM_TO_M;
  const bezel = (display.bezelMm ?? 2) * MM_TO_M;
  const pos = display.positionMm ?? [
    definition.widthMm / 2 - 60,
    0,
    definition.depthMm / 2,
  ];
  const powered = (display.state ?? 'off') === 'placeholder';

  return (
    <group position={mm(pos as [number, number, number])}>
      {/* Bezel frame */}
      <mesh position={[0, 0, 0.0006]}>
        <boxGeometry args={[w + 2 * bezel, h + 2 * bezel, 0.0018]} />
        <meshStandardMaterial color="#0d0f12" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Glass: dark, glossy, believable when powered off */}
      <mesh position={[0, 0, 0.0018]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          color={powered ? '#0e1624' : '#05070a'}
          metalness={0.1}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive={powered ? '#16325e' : '#000000'}
          emissiveIntensity={powered ? 0.55 : 0}
        />
      </mesh>
    </group>
  );
}

/** Fan grilles at authored positions: dark rotor disc + hub + ring. */
function FansRenderer({ definition }: { definition: DeviceDefinition }) {
  const cooling = definition.cooling;
  const positions = cooling?.fanPositionsMm;
  if (!positions || positions.length === 0) return null;
  const d = (cooling.fanDiameterMm ?? 40) * MM_TO_M;

  return (
    <>
      {positions.map((pos, i) => {
        const out = pos[2] >= 0 ? 1 : -1;
        return (
          <group key={i} position={mm(pos)}>
            {/* Rotor recess (cylinder axis rotated onto the panel normal) */}
            <mesh position={[0, 0, out * 0.0008]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[d / 2, d / 2, 0.0016, 24]} />
              <meshStandardMaterial color="#0b0d10" metalness={0.3} roughness={0.7} />
            </mesh>
            {/* Guard ring (torus already faces +Z) */}
            <mesh position={[0, 0, out * 0.0022]}>
              <torusGeometry args={[d / 2 - 0.0012, 0.0009, 8, 24]} />
              <meshStandardMaterial color="#2b3037" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Hub */}
            <mesh position={[0, 0, out * 0.0022]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[d / 8, d / 8, 0.0014, 12]} />
              <meshStandardMaterial color="#22262c" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/* ---- composition ------------------------------------------------------ */

export interface HardwareLayerProps {
  definition: DeviceDefinition;
  /**
   * 'full': render every hardware system (placeholder / bare-chassis
   * models). 'overlay': only additive overlays (Etherlighting) — used
   * over GLBs that already model their physical connectors.
   */
  mode: 'full' | 'overlay';
  /** Mounted instance id — lets Etherlighting react to the Cable Tool. */
  instanceId?: string;
}

/** The device's physical hardware, in device-local space. */
export function HardwareLayer({ definition, mode, instanceId }: HardwareLayerProps) {
  return (
    <group>
      {mode === 'full' && (
        <>
          <ConnectorsRenderer definition={definition} />
          <PortLedsRenderer definition={definition} />
          <LedsRenderer definition={definition} />
          <DisplayRenderer definition={definition} />
          <FansRenderer definition={definition} />
        </>
      )}
      <EtherlightingLayer definition={definition} instanceId={instanceId} />
    </group>
  );
}
