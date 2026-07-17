import { useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import type { Color, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import {
  calibratedPort,
  useCalibrationStore,
} from './connectorCalibration';
import {
  etherlightingColor,
  resolveLeds,
  resolvePhysicalPorts,
  resolvePowerConnectors,
  CONNECTOR_SIZES,
  type PhysicalConnectorType,
  type PhysicalPort,
} from './physicalPorts';
import { MM_TO_M } from '@/features/rack/rackMath';
import { useCableToolStore } from '@/stores/cableToolStore';
import { useUIStore } from '@/stores/uiStore';
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

/** Bezel + inset boxes for one connector, in device-local mm. */
function connectorParts(port: PhysicalPort): Part[] {
  const { widthMm: w, heightMm: h } = CONNECTOR_SIZES[port.type];
  const out = port.location === 'front' ? 1 : -1;
  const rotationY = port.location === 'front' ? 0 : Math.PI;
  const [x, y, z] = port.positionMm;
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
    const all = [
      ...resolvePhysicalPorts(definition),
      ...resolvePowerConnectors(definition),
    ];
    return all.filter((p) => p.visible).flatMap(connectorParts);
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

/** Selection boost applied to a strip's emissive color (hover/source). */
const STRIP_BOOST = 1.9;
/** Time constant of the boost ease — ~95% settled in about 170ms. */
const BOOST_TAU = 0.055;

/**
 * Etherlighting: an emissive strip beneath every flagged port, colored
 * by the port's speed class via lighting.speedColors. Data-driven —
 * defaultMode 'static' renders steady, 'pulse' breathes the whole
 * strip set (one material uniform, no per-port cost), 'off' hides.
 * Future link-state simulation swaps colors without renderer changes.
 *
 * While the Cable Tool is live, hovering or arming one of this device's
 * ports raises that strip's emissive intensity (smoothly eased) — the
 * selection system enhances the existing lighting rather than painting
 * a second effect over it.
 */
function EtherlightingRenderer({
  definition,
  instanceId,
}: {
  definition: DeviceDefinition;
  instanceId?: string;
}) {
  const groupRef = useRef<Group>(null);
  const lighting = definition.lighting;
  // Re-derive once the GLB's real connector geometry is calibrated.
  const calibrationVersion = useCalibrationStore((s) => s.version);

  const strips = useMemo(() => {
    if (!lighting?.etherlighting) return [];
    return resolvePhysicalPorts(definition)
      .filter((p) => p.visible)
      .map((p) => {
        const color = etherlightingColor(definition, p);
        if (!color) return null;
        const calibrated = calibratedPort(definition.id, p.ref);
        return {
          ref: p.ref,
          positionMm: calibrated?.positionMm ?? p.positionMm,
          widthMm: calibrated?.widthMm ?? CONNECTOR_SIZES.rj45.widthMm,
          heightMm: calibrated?.heightMm ?? CONNECTOR_SIZES.rj45.heightMm,
          location: p.location,
          color,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, lighting, calibrationVersion]);

  const mode = lighting?.defaultMode ?? 'static';
  const brightness = lighting?.brightness ?? 1;

  // Pulse breathes the whole overlay via group scale-invariant opacity —
  // one uniform write per frame, zero per-port cost.
  const materialRef = useRef(
    new MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
      transparent: true,
      opacity: brightness,
    }),
  );

  // Per-strip emissive boost while the Cable Tool interacts with a port.
  const stripRefs = useRef(new Map<string, { color: Color }>());
  const boosts = useRef(new Map<string, number>());
  useFrame(({ clock }, delta) => {
    if (mode === 'pulse') {
      materialRef.current.opacity =
        brightness * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 2.4) ** 2);
    }
    if (strips.length === 0) return;
    const cableActive = useUIStore.getState().activeTool === 'cable';
    const { hoverEnd, sourceEnd } = useCableToolStore.getState();
    const k = 1 - Math.exp(-delta / BOOST_TAU);
    for (const strip of strips) {
      const el = stripRefs.current.get(strip.ref);
      if (!el) continue;
      const engaged =
        cableActive &&
        instanceId !== undefined &&
        ((hoverEnd?.deviceInstanceId === instanceId &&
          hoverEnd.portRef === strip.ref) ||
          (sourceEnd?.deviceInstanceId === instanceId &&
            sourceEnd.portRef === strip.ref));
      const goal = engaged ? STRIP_BOOST : 1;
      const current = boosts.current.get(strip.ref) ?? 1;
      const next =
        Math.abs(goal - current) < 0.01 ? goal : current + (goal - current) * k;
      boosts.current.set(strip.ref, next);
      el.color.set(strip.color).multiplyScalar(next);
    }
  });

  if (strips.length === 0 || mode === 'off') return null;

  return (
    <group ref={groupRef}>
      <Instances
        geometry={UNIT_BOX}
        material={materialRef.current}
        limit={strips.length}
        frustumCulled={false}
      >
        {strips.map((strip) => (
          <Instance
            key={strip.ref}
            ref={(el: unknown) => {
              if (el) stripRefs.current.set(strip.ref, el as { color: Color });
              else stripRefs.current.delete(strip.ref);
            }}
            position={mm([
              strip.positionMm[0],
              strip.positionMm[1] - strip.heightMm / 2 - 1.6,
              strip.positionMm[2] +
                (strip.location === 'front' ? 1.2 : -1.2),
            ])}
            scale={[strip.widthMm * MM_TO_M, 0.0022, 0.0008]}
            color={strip.color}
          />
        ))}
      </Instances>
    </group>
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
          <LedsRenderer definition={definition} />
          <DisplayRenderer definition={definition} />
          <FansRenderer definition={definition} />
        </>
      )}
      <EtherlightingRenderer definition={definition} instanceId={instanceId} />
    </group>
  );
}
