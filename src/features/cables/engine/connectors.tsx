import { useMemo, type ReactNode } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import { MM_TO_M } from '@/features/rack/rackMath';
import {
  bootMaterial,
  Rj45Plug,
  RJ45_BODY,
  BOOT_LEN,
} from '../Rj45Plug';
import type { CableCategory } from '../cableCatalog';
import type { PhysicalConnectorType } from '@/features/devices/hardware/physicalPorts';

/**
 * Cable Engine — connector stage. Every terminating connector RackForge
 * renders is a procedural 3D body built from real datasheet
 * proportions, sharing the plug-local convention established by the
 * RJ45: nose tip at the origin, -Z is the insertion direction, the
 * strain-relief boot tapers toward +Z onto the cable sheath.
 *
 * The factory picks the connector from the PORT type and the CABLE
 * category — an SFP+ cage receives an integrated DAC plug for twinax
 * but a transceiver + LC ferrule pair for fiber — so metadata, not
 * device code, decides what appears. All geometries and materials are
 * module-shared; a connector instance is a handful of transformed
 * boxes.
 */

/* ---- shared GPU resources -------------------------------------------- */

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_CYL = new CylinderGeometry(1, 1, 1, 16);
UNIT_CYL.rotateX(Math.PI / 2); // axis onto Z
const BOOT_CONE = new CylinderGeometry(0.62, 1, 1, 12);
BOOT_CONE.rotateX(Math.PI / 2);

const METAL = new MeshStandardMaterial({
  color: '#aeb6bf',
  metalness: 0.92,
  roughness: 0.32,
});
const DARK_METAL = new MeshStandardMaterial({
  color: '#6a7078',
  metalness: 0.85,
  roughness: 0.42,
});
const GOLD = new MeshStandardMaterial({
  color: '#d8a944',
  metalness: 0.95,
  roughness: 0.3,
});
const BLACK_MOLD = new MeshStandardMaterial({
  color: '#22252a',
  roughness: 0.6,
  metalness: 0.05,
});
const WHITE_CERAMIC = new MeshPhysicalMaterial({
  color: '#e8e6df',
  roughness: 0.35,
  clearcoat: 0.4,
});
const LATCH_PLASTIC = new MeshPhysicalMaterial({
  color: '#c8cdd4',
  transparent: true,
  opacity: 0.5,
  roughness: 0.2,
  clearcoat: 0.5,
  depthWrite: false,
});

const mm = (v: number) => v * MM_TO_M;

export interface PlugProps {
  /** Boot / molded body accent color (usually the sheath color). */
  color: string;
  /** Cable sheath radius, meters. */
  cableRadiusM: number;
}

/* ---- connector bodies ------------------------------------------------- */

/** SFP/SFP+/SFP28 DAC or AOC plug: metal module + pull-tab loop. */
function SfpPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const w = 13.6;
  const h = 8.5;
  const len = 38; // module body; most sits inside the cage
  const bootR = Math.max(cableRadiusM * 1.4, mm(3));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, 0, mm(len / 2)]}
        scale={[mm(w), mm(h), mm(len)]}
      />
      {/* Gold edge contacts at the nose */}
      <mesh
        geometry={UNIT_BOX}
        material={GOLD}
        position={[0, 0, mm(1.4)]}
        scale={[mm(w * 0.7), mm(h * 0.4), mm(2.6)]}
      />
      {/* Cage latch bail across the top rear */}
      <mesh
        geometry={UNIT_BOX}
        material={DARK_METAL}
        position={[0, mm(h / 2 + 0.7), mm(len - 6)]}
        scale={[mm(w * 0.8), mm(1.2), mm(3)]}
      />
      {/* Pull tab loop */}
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, mm(1.5), mm(len + 5)]}
        rotation={[0.5, 0, 0]}
        scale={[mm(6), mm(1.1), mm(11)]}
      />
      {/* Boot onto the sheath */}
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(len + 2 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** QSFP+/QSFP28: the same module language, wider body. */
function QsfpPlug(props: PlugProps) {
  return (
    <group scale={[1.32, 1.05, 1.06]}>
      <SfpPlug {...props} />
    </group>
  );
}

/**
 * Fiber into an SFP cage: the transceiver module with a duplex LC pair
 * seated in its rear receptacle — ferrule boots side by side.
 */
function SfpFiberPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const w = 13.6;
  const h = 8.5;
  const len = 30;
  const ferruleR = mm(1.6);
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, 0, mm(len / 2)]}
        scale={[mm(w), mm(h), mm(len)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={GOLD}
        position={[0, 0, mm(1.4)]}
        scale={[mm(w * 0.7), mm(h * 0.4), mm(2.6)]}
      />
      {/* Duplex LC bodies in the receptacle */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * mm(3.35), 0, mm(len)]}>
          <mesh
            geometry={UNIT_BOX}
            material={WHITE_CERAMIC}
            position={[0, 0, mm(4.5)]}
            scale={[mm(5.6), mm(6.4), mm(9)]}
          />
          <mesh
            geometry={UNIT_BOX}
            material={LATCH_PLASTIC}
            position={[0, mm(3.6), mm(5)]}
            rotation={[-0.22, 0, 0]}
            scale={[mm(3.4), mm(0.9), mm(7)]}
          />
          <mesh
            geometry={BOOT_CONE}
            material={boot}
            position={[0, 0, mm(9 + BOOT_LEN * 0.45)]}
            scale={[ferruleR * 1.5, ferruleR * 1.5, mm(BOOT_LEN * 0.9)]}
          />
        </group>
      ))}
      {/* The two ferrule boots merge into one sheath */}
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(len + 22)]}
        scale={[
          Math.max(cableRadiusM * 1.35, mm(2.4)),
          Math.max(cableRadiusM * 1.35, mm(2.4)),
          mm(10),
        ]}
      />
    </group>
  );
}

/** Standalone LC duplex plug (patch-panel side of fiber runs). */
function LcPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * mm(3.35), 0, 0]}>
          {/* Ceramic ferrule nose */}
          <mesh
            geometry={UNIT_CYL}
            material={WHITE_CERAMIC}
            position={[0, 0, mm(2)]}
            scale={[mm(0.65), mm(0.65), mm(4)]}
          />
          {/* Connector body */}
          <mesh
            geometry={UNIT_BOX}
            material={WHITE_CERAMIC}
            position={[0, 0, mm(4 + 4.5)]}
            scale={[mm(5.6), mm(6.4), mm(9)]}
          />
          {/* Latch */}
          <mesh
            geometry={UNIT_BOX}
            material={LATCH_PLASTIC}
            position={[0, mm(3.7), mm(8.5)]}
            rotation={[-0.22, 0, 0]}
            scale={[mm(3.4), mm(0.9), mm(7)]}
          />
          <mesh
            geometry={BOOT_CONE}
            material={boot}
            position={[0, 0, mm(13 + 6)]}
            scale={[mm(2.2), mm(2.2), mm(12)]}
          />
        </group>
      ))}
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(34)]}
        scale={[
          Math.max(cableRadiusM * 1.35, mm(2.4)),
          Math.max(cableRadiusM * 1.35, mm(2.4)),
          mm(10),
        ]}
      />
    </group>
  );
}

/** SC fiber plug: the square push-pull body. */
export function ScPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  return (
    <group>
      <mesh
        geometry={UNIT_CYL}
        material={WHITE_CERAMIC}
        position={[0, 0, mm(2.2)]}
        scale={[mm(1.2), mm(1.2), mm(4.4)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(4.4 + 5.5)]}
        scale={[mm(9), mm(9), mm(11)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={WHITE_CERAMIC}
        position={[0, 0, mm(4.4 + 12.5)]}
        scale={[mm(7.4), mm(7.4), mm(4)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(22 + BOOT_LEN / 2)]}
        scale={[
          Math.max(cableRadiusM * 1.4, mm(2.4)),
          Math.max(cableRadiusM * 1.4, mm(2.4)),
          mm(BOOT_LEN),
        ]}
      />
    </group>
  );
}

/** USB-A plug: shield shell + molded overmold. */
function UsbAPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(2.8));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, 0, mm(6)]}
        scale={[mm(12), mm(4.5), mm(12)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(12 + 8)]}
        scale={[mm(15), mm(7.2), mm(16)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(28 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** USB-C plug: rounded oval shell + slim overmold. */
function UsbCPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(2.6));
  return (
    <group>
      <mesh
        geometry={UNIT_CYL}
        material={METAL}
        position={[mm(-2.85), 0, mm(3.3)]}
        scale={[mm(1.3), mm(1.3), mm(6.6)]}
      />
      <mesh
        geometry={UNIT_CYL}
        material={METAL}
        position={[mm(2.85), 0, mm(3.3)]}
        scale={[mm(1.3), mm(1.3), mm(6.6)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, 0, mm(3.3)]}
        scale={[mm(5.7), mm(2.6), mm(6.6)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(6.6 + 6.5)]}
        scale={[mm(11.5), mm(5.4), mm(13)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(19.6 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** HDMI plug: the trapezoid shell reads through a stepped shield. */
function HdmiPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(3));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, mm(0.6), mm(5)]}
        scale={[mm(14), mm(4.5), mm(10)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, mm(-1.2), mm(5)]}
        scale={[mm(10.5), mm(1.8), mm(10)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(10 + 9)]}
        scale={[mm(19), mm(9.5), mm(18)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(28 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** DisplayPort plug: rectangular shell with one chamfered corner. */
function DisplayPortPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(3));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[mm(-1), 0, mm(5)]}
        scale={[mm(14.2), mm(4.5), mm(10)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[mm(6.4), mm(-0.8), mm(5)]}
        rotation={[0, 0, 0.6]}
        scale={[mm(3.4), mm(3.4), mm(10)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(10 + 9)]}
        scale={[mm(20), mm(9.5), mm(18)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(28 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** IEC C13 appliance plug (into a C14 inlet). */
function C13Plug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.35, mm(4.2));
  return (
    <group>
      {/* Inserted contact block */}
      <mesh
        geometry={UNIT_BOX}
        material={BLACK_MOLD}
        position={[0, 0, mm(5)]}
        scale={[mm(22), mm(15), mm(10)]}
      />
      {/* Molded grip body */}
      <mesh
        geometry={UNIT_BOX}
        material={BLACK_MOLD}
        position={[0, 0, mm(10 + 13)]}
        scale={[mm(27), mm(19), mm(26)]}
      />
      {/* Grip ribs */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={UNIT_BOX}
          material={DARK_METAL}
          position={[side * mm(12.2), 0, mm(23)]}
          scale={[mm(1.2), mm(15), mm(18)]}
        />
      ))}
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(36 + 11)]}
        scale={[bootR, bootR, mm(22)]}
      />
    </group>
  );
}

/** IEC C19 plug (into a C20 inlet) — the high-current sibling. */
function C19Plug(props: PlugProps) {
  return (
    <group scale={[1.16, 1.24, 1.05]}>
      <C13Plug {...props} />
    </group>
  );
}

/** DC barrel plug. */
function BarrelPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(2.8));
  return (
    <group>
      <mesh
        geometry={UNIT_CYL}
        material={METAL}
        position={[0, 0, mm(4.5)]}
        scale={[mm(2.75), mm(2.75), mm(9)]}
      />
      <mesh
        geometry={UNIT_CYL}
        material={BLACK_MOLD}
        position={[0, 0, mm(9 + 6.5)]}
        scale={[mm(4.6), mm(4.6), mm(13)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(22 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** Phoenix / terminal-block plug: the green screw connector. */
function PhoenixPlug({ cableRadiusM }: PlugProps) {
  const green = useMemo(() => bootMaterial('#2f8f4e'), []);
  const bootR = Math.max(cableRadiusM * 1.4, mm(3));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={green}
        position={[0, 0, mm(7.5)]}
        scale={[mm(16.5), mm(9), mm(15)]}
      />
      {/* Screw heads on top */}
      {[-1, 0, 1].map((i) => (
        <mesh
          key={i}
          geometry={UNIT_CYL}
          material={METAL}
          position={[i * mm(5), mm(5.1), mm(7.5)]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[mm(1.6), mm(1.6), mm(1.6)]}
        />
      ))}
      <mesh
        geometry={BOOT_CONE}
        material={green}
        position={[0, 0, mm(15 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** DB9 serial plug: trapezoid shell + molded hood with thumbscrews. */
function Db9Plug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const bootR = Math.max(cableRadiusM * 1.5, mm(3.2));
  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={METAL}
        position={[0, 0, mm(4)]}
        scale={[mm(17), mm(8.5), mm(8)]}
      />
      <mesh
        geometry={UNIT_BOX}
        material={boot}
        position={[0, 0, mm(8 + 8)]}
        scale={[mm(31), mm(13), mm(16)]}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={UNIT_CYL}
          material={DARK_METAL}
          position={[side * mm(12.5), 0, mm(10)]}
          scale={[mm(2.2), mm(2.2), mm(10)]}
        />
      ))}
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(24 + BOOT_LEN / 2)]}
        scale={[bootR, bootR, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/** RJ11/RJ12 telephone-style plug — a narrow RJ45. */
function Rj11Plug(props: PlugProps) {
  return (
    <group scale={[0.68, 0.8, 0.85]}>
      <Rj45Plug {...props} />
    </group>
  );
}

/** Fallback barrel for unknown types — metal ferrule + boot. */
export function GenericPlug({ color, cableRadiusM }: PlugProps) {
  const boot = useMemo(() => bootMaterial(color), [color]);
  const r = Math.max(cableRadiusM * 1.5, mm(3.4));
  return (
    <group>
      <mesh
        geometry={UNIT_CYL}
        material={DARK_METAL}
        position={[0, 0, mm(7)]}
        scale={[r, r, mm(14)]}
      />
      <mesh
        geometry={BOOT_CONE}
        material={boot}
        position={[0, 0, mm(14 + BOOT_LEN / 2)]}
        scale={[r * 0.96, r * 0.96, mm(BOOT_LEN)]}
      />
    </group>
  );
}

/* ---- the factory ------------------------------------------------------ */

export type ConnectorKind =
  | 'rj45'
  | 'rj11'
  | 'sfp'
  | 'sfp-fiber'
  | 'qsfp'
  | 'lc'
  | 'sc'
  | 'usb-a'
  | 'usb-c'
  | 'hdmi'
  | 'displayport'
  | 'c13'
  | 'c19'
  | 'barrel'
  | 'phoenix'
  | 'db9'
  | 'generic';

interface ConnectorSpec {
  Component: (props: PlugProps) => ReactNode;
  /** Nose→boot-start length of the body, mm. */
  bodyLenMm: number;
  /** Default insertion depth into the port, mm. */
  insertionMm: number;
}

const CONNECTORS: Record<ConnectorKind, ConnectorSpec> = {
  rj45: { Component: Rj45Plug, bodyLenMm: RJ45_BODY.len, insertionMm: 13 },
  rj11: { Component: Rj11Plug, bodyLenMm: RJ45_BODY.len * 0.85, insertionMm: 10 },
  sfp: { Component: SfpPlug, bodyLenMm: 45, insertionMm: 34 },
  'sfp-fiber': { Component: SfpFiberPlug, bodyLenMm: 62, insertionMm: 28 },
  qsfp: { Component: QsfpPlug, bodyLenMm: 47, insertionMm: 36 },
  lc: { Component: LcPlug, bodyLenMm: 34, insertionMm: 8 },
  sc: { Component: ScPlug, bodyLenMm: 24, insertionMm: 9 },
  'usb-a': { Component: UsbAPlug, bodyLenMm: 28, insertionMm: 10 },
  'usb-c': { Component: UsbCPlug, bodyLenMm: 19.6, insertionMm: 6 },
  hdmi: { Component: HdmiPlug, bodyLenMm: 28, insertionMm: 9 },
  displayport: { Component: DisplayPortPlug, bodyLenMm: 28, insertionMm: 9 },
  c13: { Component: C13Plug, bodyLenMm: 36, insertionMm: 9 },
  c19: { Component: C19Plug, bodyLenMm: 38, insertionMm: 10 },
  barrel: { Component: BarrelPlug, bodyLenMm: 22, insertionMm: 8 },
  phoenix: { Component: PhoenixPlug, bodyLenMm: 15, insertionMm: 7 },
  db9: { Component: Db9Plug, bodyLenMm: 24, insertionMm: 7 },
  generic: { Component: GenericPlug, bodyLenMm: 14, insertionMm: 8 },
};

/** Copper RJ-class port types (keep in sync with DEFAULT_INSERTION_MM). */
const RJ45_PORTS = new Set<PhysicalConnectorType>([
  'rj45',
  'keystone',
  'poe-in',
  'console',
]);
const SFP_CLASS = new Set<PhysicalConnectorType>(['sfp', 'sfp+', 'sfp28']);
const QSFP_CLASS = new Set<PhysicalConnectorType>(['qsfp+', 'qsfp28']);

/**
 * The connector kind terminating a cable of `category` on a port of
 * `portType`. Metadata in, geometry out — devices never choose.
 */
export function connectorKindFor(
  portType: PhysicalConnectorType,
  category: CableCategory,
): ConnectorKind {
  if (RJ45_PORTS.has(portType)) return 'rj45';
  if (SFP_CLASS.has(portType)) {
    return category === 'fiber' ? 'sfp-fiber' : 'sfp';
  }
  if (QSFP_CLASS.has(portType)) return 'qsfp';
  switch (portType) {
    case 'fiber-lc':
      return 'lc';
    case 'usb':
    case 'usb-a':
      return 'usb-a';
    case 'usb-c':
      return 'usb-c';
    case 'hdmi':
      return 'hdmi';
    case 'displayport':
      return 'displayport';
    case 'c13':
    case 'c14':
    case 'power':
    case 'iec-lock':
    case 'nema':
      return 'c13';
    case 'c19':
    case 'c20':
      return 'c19';
    case 'dc':
    case 'external-adapter':
    case 'audio':
      return 'barrel';
    case 'phoenix':
      return 'phoenix';
    case 'serial':
      return 'db9';
    default:
      return 'generic';
  }
}

export function connectorSpec(kind: ConnectorKind): ConnectorSpec {
  return CONNECTORS[kind];
}

/** Default insertion depth for a port/cable pairing, mm. */
export function connectorInsertionMm(
  portType: PhysicalConnectorType,
  category: CableCategory,
  authoredInsertionMm: number | undefined,
): number {
  return (
    authoredInsertionMm ?? CONNECTORS[connectorKindFor(portType, category)].insertionMm
  );
}

/**
 * Distance from the port surface to where the cable sheath visually
 * begins (past the plug body and most of the boot), mm.
 */
export function connectorCableOffsetMm(
  portType: PhysicalConnectorType,
  category: CableCategory,
  authoredInsertionMm: number | undefined,
): number {
  const kind = connectorKindFor(portType, category);
  const spec = CONNECTORS[kind];
  const insertion = authoredInsertionMm ?? spec.insertionMm;
  return spec.bodyLenMm - insertion + BOOT_LEN * 0.85;
}
