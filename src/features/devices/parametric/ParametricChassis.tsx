import { useEffect, useMemo } from 'react';
import { BoxGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { Detailed, Instance, Instances, RoundedBox } from '@react-three/drei';
import {
  buildChassisSpec,
  type ChassisSpec,
  type RectMm,
  type VentRegion,
} from './chassisSpec';
import {
  BRUSH_MATERIAL,
  GLASS_MATERIAL,
  RUBBER_MATERIAL,
  SCREW_MATERIAL,
  VENT_CAVITY_MATERIAL,
  chassisMaterial,
  tintedMaterial,
} from './materials';
import { earGeometry, skirtGeometry, ventLayout } from './parametricGeometry';
import { createTextTexture } from '@/features/rack/rackTextures';
import { MM_TO_M } from '@/features/rack/rackMath';
import type { DeviceDefinition } from '../deviceSchema';

/**
 * Parametric Device Generator — output stage. Renders a ChassisSpec as
 * professional placeholder hardware with four levels of detail that
 * switch automatically by camera distance (drei <Detailed> = THREE.LOD).
 * Repeated elements (vents, screws, bays, outlets, fingers) render as
 * instanced meshes over module-shared unit geometries, so a full rack
 * of generated devices stays a handful of draw calls per device.
 *
 * Ports, power inlets, LEDs, displays and fans render through the
 * existing metadata-driven HardwareLayer on top of this chassis — the
 * generator never duplicates them, which is what keeps Port Authoring,
 * cables, snapping and Etherlighting aligned for free.
 */

const MM = MM_TO_M;

/* Shared unit geometries (module singletons). */
const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_DISC = new CylinderGeometry(0.5, 0.5, 1, 16);
UNIT_DISC.rotateX(Math.PI / 2); // axis toward +Z
const UNIT_CYL = new CylinderGeometry(0.5, 0.5, 1, 12);
const RING_TORUS = new TorusGeometry(0.5, 0.055, 8, 20);

/* ---- vent field -------------------------------------------------------- */

const VENT_FACE_TRANSFORM: Record<
  VentRegion['face'],
  (spec: ChassisSpec, v: VentRegion) => {
    position: [number, number, number];
    rotation: [number, number, number];
  }
> = {
  front: (s, v) => ({
    position: [v.xMm * MM, v.yMm * MM, (s.depthMm / 2) * MM],
    rotation: [0, 0, 0],
  }),
  rear: (s, v) => ({
    position: [v.xMm * MM, v.yMm * MM, (-s.depthMm / 2) * MM],
    rotation: [0, Math.PI, 0],
  }),
  'side-left': (s, v) => ({
    position: [(-s.widthMm / 2 + s.bodyInsetMm) * MM, v.yMm * MM, v.xMm * MM],
    rotation: [0, -Math.PI / 2, 0],
  }),
  'side-right': (s, v) => ({
    position: [(s.widthMm / 2 - s.bodyInsetMm) * MM, v.yMm * MM, v.xMm * MM],
    rotation: [0, Math.PI / 2, 0],
  }),
  top: (s, v) => ({
    position: [v.xMm * MM, (s.heightMm / 2) * MM, v.yMm * MM],
    rotation: [-Math.PI / 2, 0, 0],
  }),
};

/** One perforated vent region: dark backing + instanced openings. */
function VentField({
  spec,
  region,
  detailed,
}: {
  spec: ChassisSpec;
  region: VentRegion;
  detailed: boolean;
}) {
  const layout = useMemo(() => ventLayout(region, region.style), [region]);
  const { position, rotation } = VENT_FACE_TRANSFORM[region.face](spec, region);

  return (
    <group position={position} rotation={rotation}>
      {/* Recessed backing plate */}
      <mesh position={[0, 0, -0.0006]} material={VENT_CAVITY_MATERIAL}>
        <boxGeometry args={[region.wMm * MM, region.hMm * MM, 0.0012]} />
      </mesh>
      {detailed && (
        <Instances
          geometry={layout.round ? UNIT_DISC : UNIT_BOX}
          material={VENT_CAVITY_MATERIAL}
          limit={layout.offsets.length}
          frustumCulled={false}
        >
          {layout.offsets.map(([x, y], i) => (
            <Instance
              key={i}
              position={[x * MM, y * MM, 0.0004]}
              scale={[layout.slotWMm * MM, layout.slotHMm * MM, 0.0011]}
            />
          ))}
        </Instances>
      )}
    </group>
  );
}

/* ---- silkscreen (badge + model label) --------------------------------- */

function Silkscreen({
  spec,
  definition,
}: {
  spec: ChassisSpec;
  definition: DeviceDefinition;
}) {
  const badgeTexture = useMemo(
    () =>
      createTextTexture(
        definition.manufacturerName.toUpperCase().slice(0, 14),
        spec.style.badgeInk,
      ),
    [definition.manufacturerName, spec.style.badgeInk],
  );
  const labelTexture = useMemo(
    () =>
      createTextTexture(
        definition.modelNumber.toUpperCase().slice(0, 18),
        spec.style.labelInk,
      ),
    [definition.modelNumber, spec.style.labelInk],
  );
  useEffect(
    () => () => {
      badgeTexture.dispose();
      labelTexture.dispose();
    },
    [badgeTexture, labelTexture],
  );

  const faceZ = (spec.depthMm / 2) * MM + 0.0007;
  const plane = (
    tex: typeof badgeTexture,
    xMm: number,
    yMm: number,
    hMm: number,
  ) => (
    <mesh position={[(xMm + hMm * 2) * MM, yMm * MM, faceZ]}>
      <planeGeometry args={[hMm * 4 * MM, hMm * MM]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );

  return (
    <>
      {spec.badge &&
        plane(badgeTexture, spec.badge.xMm, spec.badge.yMm, spec.badge.heightMm)}
      {spec.label &&
        plane(labelTexture, spec.label.xMm, spec.label.yMm, spec.label.heightMm)}
    </>
  );
}

/* ---- furniture --------------------------------------------------------- */

/** Mounting ears with punched holes + installed screw heads. */
function Ears({ spec, detailed }: { spec: ChassisSpec; detailed: boolean }) {
  const units = Math.max(1, Math.round(spec.heightMm / 44.45));
  const geometry = useMemo(
    () => earGeometry(spec.ears!.widthMm, spec.heightMm * 0.98, units),
    [spec.ears, spec.heightMm, units],
  );
  const material = chassisMaterial(spec.style.body, spec.style.finish, 'body');
  const earX = (spec.widthMm / 2 - spec.ears!.widthMm / 2) * MM;
  const earZ = (spec.depthMm / 2 - 1.5) * MM;

  return (
    <>
      {[-earX, earX].map((x) => (
        <mesh
          key={x}
          geometry={geometry}
          material={material}
          position={[x, 0, earZ]}
          castShadow
        />
      ))}
      {detailed && spec.earScrewsMm.length > 0 && (
        <Instances
          geometry={UNIT_DISC}
          material={SCREW_MATERIAL}
          limit={spec.earScrewsMm.length}
          frustumCulled={false}
        >
          {spec.earScrewsMm.map(([x, y], i) => (
            <Instance
              key={i}
              position={[x * MM, y * MM, earZ + 0.0014]}
              scale={[0.0088, 0.0088, 0.0016]}
            />
          ))}
        </Instances>
      )}
    </>
  );
}

/** Front drive bays: tray face, pull latch, activity dot. */
function DriveBays({ spec, detailed }: { spec: ChassisSpec; detailed: boolean }) {
  const faceZ = (spec.depthMm / 2) * MM;
  const trayMaterial = tintedMaterial(spec.style.detail, { roughness: 0.6 });
  const latchMaterial = tintedMaterial(spec.style.body, { roughness: 0.42 });
  return (
    <>
      <Instances
        geometry={UNIT_BOX}
        material={trayMaterial}
        limit={spec.driveBays.length}
        castShadow
        frustumCulled={false}
      >
        {spec.driveBays.map((bay, i) => (
          <Instance
            key={i}
            position={[bay.xMm * MM, bay.yMm * MM, faceZ + 0.0011]}
            scale={[bay.wMm * MM, bay.hMm * MM, 0.0022]}
          />
        ))}
      </Instances>
      {detailed && (
        <>
          <Instances
            geometry={UNIT_BOX}
            material={latchMaterial}
            limit={spec.driveBays.length}
            frustumCulled={false}
          >
            {spec.driveBays.map((bay, i) => (
              <Instance
                key={i}
                position={[
                  bay.xMm * MM,
                  (bay.yMm - bay.hMm / 2 + 3.4) * MM,
                  faceZ + 0.0024,
                ]}
                scale={[(bay.wMm - 8) * MM, 0.0035, 0.001]}
              />
            ))}
          </Instances>
          <Instances
            geometry={UNIT_DISC}
            material={tintedMaterial('#2f9e63', { roughness: 0.3 })}
            limit={spec.driveBays.length}
            frustumCulled={false}
          >
            {spec.driveBays.map((bay, i) => (
              <Instance
                key={i}
                position={[
                  (bay.xMm + bay.wMm / 2 - 5) * MM,
                  (bay.yMm + bay.hMm / 2 - 5) * MM,
                  faceZ + 0.0024,
                ]}
                scale={[0.002, 0.002, 0.0008]}
              />
            ))}
          </Instances>
        </>
      )}
    </>
  );
}

/** Rear PSU module frames around the resolved power inlets. */
function PsuFrames({ spec }: { spec: ChassisSpec }) {
  const rearZ = (-spec.depthMm / 2) * MM;
  const frameMaterial = tintedMaterial(spec.style.detail, { roughness: 0.55 });
  return (
    <Instances
      geometry={UNIT_BOX}
      material={frameMaterial}
      limit={spec.psuFramesMm.length}
      frustumCulled={false}
    >
      {spec.psuFramesMm.map((frame, i) => (
        <Instance
          key={i}
          position={[frame.xMm * MM, frame.yMm * MM, rearZ - 0.0008]}
          scale={[frame.wMm * MM, frame.hMm * MM, 0.0016]}
        />
      ))}
    </Instances>
  );
}

/** PDU visual outlet strip (only when no outlets are authored). */
function OutletStrip({ spec }: { spec: ChassisSpec }) {
  const strip = spec.outletStrip!;
  const faceZ = (spec.depthMm / 2) * MM;
  const count = Math.max(2, Math.floor(strip.wMm / 34));
  const span = (count - 1) * 34;
  return (
    <group position={[strip.xMm * MM, strip.yMm * MM, faceZ]}>
      <mesh position={[0, 0, 0.0006]} material={VENT_CAVITY_MATERIAL}>
        <boxGeometry args={[strip.wMm * MM, strip.hMm * MM, 0.0012]} />
      </mesh>
      <Instances
        geometry={UNIT_BOX}
        material={tintedMaterial('#1b1d21', { roughness: 0.5 })}
        limit={count}
        frustumCulled={false}
      >
        {Array.from({ length: count }, (_, i) => (
          <Instance
            key={i}
            position={[(-span / 2 + i * 34) * MM, 0, 0.0016]}
            scale={[0.024, Math.min(strip.hMm - 6, 22) * MM, 0.0014]}
          />
        ))}
      </Instances>
    </group>
  );
}

/** Power / reset buttons. */
function Buttons({ spec }: { spec: ChassisSpec }) {
  const faceZ = (spec.depthMm / 2) * MM;
  return (
    <>
      {spec.buttons.map((button, i) => (
        <group key={i} position={[button.xMm * MM, button.yMm * MM, faceZ]}>
          <mesh
            geometry={UNIT_DISC}
            material={tintedMaterial(spec.style.detail, { roughness: 0.4 })}
            position={[0, 0, 0.0005]}
            scale={[
              (button.diameterMm + 2.4) * MM,
              (button.diameterMm + 2.4) * MM,
              0.001,
            ]}
          />
          <mesh
            geometry={UNIT_DISC}
            material={button.kind === 'power' ? GLASS_MATERIAL : VENT_CAVITY_MATERIAL}
            position={[0, 0, 0.0012]}
            scale={[button.diameterMm * MM, button.diameterMm * MM, 0.0012]}
          />
        </group>
      ))}
    </>
  );
}

/** Vertical pull handles over the ears (servers, UPS). */
function Handles({ spec }: { spec: ChassisSpec }) {
  const faceZ = (spec.depthMm / 2) * MM;
  const material = tintedMaterial(spec.style.detail, {
    metalness: 0.7,
    roughness: 0.35,
  });
  return (
    <>
      {spec.handles.map((handle, i) => (
        <group key={i} position={[handle.xMm * MM, 0, faceZ + 0.006]}>
          <mesh material={material} castShadow>
            <boxGeometry args={[0.006, handle.heightMm * MM, 0.004]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              material={material}
              position={[0, (s * handle.heightMm * MM) / 2, -0.003]}
            >
              <boxGeometry args={[0.006, 0.004, 0.007]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Rubber feet for desktop devices. */
function Feet({ spec }: { spec: ChassisSpec }) {
  return (
    <Instances
      geometry={UNIT_CYL}
      material={RUBBER_MATERIAL}
      limit={spec.feetMm.length}
      frustumCulled={false}
    >
      {spec.feetMm.map(([x, z], i) => (
        <Instance
          key={i}
          position={[x * MM, (-spec.heightMm / 2) * MM - 0.0015, z * MM]}
          scale={[0.012, 0.003, 0.012]}
        />
      ))}
    </Instances>
  );
}

/** Recessed rows behind patch-panel keystones + numbering strip. */
function PatchRows({ spec }: { spec: ChassisSpec }) {
  const faceZ = (spec.depthMm / 2) * MM;
  return (
    <Instances
      geometry={UNIT_BOX}
      material={VENT_CAVITY_MATERIAL}
      limit={spec.patchRows.length}
      frustumCulled={false}
    >
      {spec.patchRows.map((row, i) => (
        <Instance
          key={i}
          position={[row.xMm * MM, row.yMm * MM, faceZ + 0.0004]}
          scale={[row.wMm * MM, row.hMm * MM, 0.0009]}
        />
      ))}
    </Instances>
  );
}

/** Cable-management fingers (+ optional cover) along one axis. */
function Fingers({ spec, detailed }: { spec: ChassisSpec; detailed: boolean }) {
  const f = spec.fingers!;
  const material = chassisMaterial(spec.style.body, spec.style.finish, 'body');
  const horizontal = f.axis === 'x';
  const spanMm = horizontal ? spec.widthMm - 40 : spec.heightMm - 10;
  const pitch = spanMm / f.count;
  const fingerLen = (horizontal ? spec.heightMm : spec.widthMm) * 0.86;
  const frontZ = (spec.depthMm / 2) * MM;

  return (
    <group>
      {detailed ? (
        <Instances
          geometry={UNIT_BOX}
          material={material}
          limit={f.count + 1}
          castShadow
          frustumCulled={false}
        >
          {Array.from({ length: f.count + 1 }, (_, i) => {
            const a = -spanMm / 2 + i * pitch;
            return (
              <Instance
                key={i}
                position={
                  horizontal
                    ? [a * MM, 0, frontZ - (f.depthMm / 2) * MM]
                    : [0, a * MM, frontZ - (f.depthMm / 2) * MM]
                }
                scale={
                  horizontal
                    ? [(pitch - f.slotMm) * MM, fingerLen * MM, f.depthMm * MM]
                    : [fingerLen * MM, (pitch - f.slotMm) * MM, f.depthMm * MM]
                }
              />
            );
          })}
        </Instances>
      ) : (
        <mesh
          material={material}
          position={[0, 0, frontZ - (f.depthMm / 2) * MM]}
          castShadow
        >
          <boxGeometry
            args={
              horizontal
                ? [spanMm * MM, fingerLen * MM, f.depthMm * MM]
                : [fingerLen * MM, spanMm * MM, f.depthMm * MM]
            }
          />
        </mesh>
      )}
      {f.cover && (
        <mesh
          material={chassisMaterial(spec.style.face, spec.style.finish, 'face')}
          position={[0, 0, frontZ + 0.0012]}
          castShadow
        >
          <boxGeometry
            args={
              horizontal
                ? [(spanMm + 24) * MM, (fingerLen + 8) * MM, 0.0024]
                : [(fingerLen + 8) * MM, (spanMm + 8) * MM, 0.0024]
            }
          />
        </mesh>
      )}
    </group>
  );
}

/** D-ring loops on the faceplate. */
function Rings({ spec }: { spec: ChassisSpec }) {
  const material = chassisMaterial(spec.style.body, spec.style.finish, 'body');
  const frontZ = (spec.depthMm / 2) * MM;
  return (
    <>
      {spec.rings.map((ring, i) => (
        <mesh
          key={i}
          geometry={RING_TORUS}
          material={material}
          position={[ring.xMm * MM, 0, frontZ + (ring.wMm / 2) * MM]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[ring.wMm * MM, ring.hMm * MM, ring.hMm * MM]}
          castShadow
        />
      ))}
    </>
  );
}

/** Dense round-hole field across a shelf deck, facing up. */
function DeckPerforation({ spec, yM }: { spec: ChassisSpec; yM: number }) {
  const layout = useMemo(
    () =>
      ventLayout(
        { xMm: 0, yMm: 0, wMm: spec.widthMm - 180, hMm: spec.depthMm * 0.58 },
        'holes',
      ),
    [spec.widthMm, spec.depthMm],
  );
  return (
    <Instances
      geometry={UNIT_DISC}
      material={VENT_CAVITY_MATERIAL}
      limit={layout.offsets.length}
      frustumCulled={false}
    >
      {layout.offsets.map(([x, z], i) => (
        <Instance
          key={i}
          position={[x * MM, yM, z * MM]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[layout.slotWMm * MM, layout.slotHMm * MM, 0.0008]}
        />
      ))}
    </Instances>
  );
}

/** One oblong (stadium) cable slot lying flat in the deck. */
function DeckSlot({ slot, yM }: { slot: RectMm; yM: number }) {
  const bodyW = Math.max(slot.wMm - slot.hMm, 1);
  return (
    <group position={[slot.xMm * MM, yM, slot.yMm * MM]}>
      <mesh
        geometry={UNIT_BOX}
        material={VENT_CAVITY_MATERIAL}
        scale={[bodyW * MM, 0.0008, slot.hMm * MM]}
      />
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={UNIT_DISC}
          material={VENT_CAVITY_MATERIAL}
          position={[((s * bodyW) / 2) * MM, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[slot.hMm * MM, slot.hMm * MM, 0.0008]}
        />
      ))}
    </group>
  );
}

/* ---- body shapes ------------------------------------------------------- */

/** Enclosed box: inset body + styled faceplate. */
function BoxBody({ spec }: { spec: ChassisSpec }) {
  const w = spec.widthMm * MM;
  const h = spec.heightMm * MM;
  const d = spec.depthMm * MM;
  const faceT = spec.faceThicknessMm * MM;
  const inset = spec.bodyInsetMm * MM;
  const radius = Math.min(spec.cornerRadiusMm * MM, h / 5, 0.004);
  return (
    <>
      <RoundedBox
        args={[w - inset, h - inset / 2, Math.max(d - faceT, 0.012)]}
        radius={Math.min(0.0028, h / 6)}
        smoothness={3}
        position={[0, 0, -faceT / 2]}
        castShadow
        receiveShadow
        material={chassisMaterial(spec.style.body, spec.style.finish, 'body')}
      />
      <RoundedBox
        args={[w, h, faceT]}
        radius={radius}
        smoothness={3}
        position={[0, 0, d / 2 - faceT / 2]}
        castShadow
        material={chassisMaterial(spec.style.face, spec.style.finish, 'face')}
      />
    </>
  );
}

/** Faceplate with a shallow return (patch/blank/brush panels). */
function PanelBody({ spec }: { spec: ChassisSpec }) {
  const w = spec.widthMm * MM;
  const h = spec.heightMm * MM;
  const d = spec.depthMm * MM;
  const faceT = spec.faceThicknessMm * MM;
  const returnD = Math.min(d - faceT, 0.024);
  return (
    <>
      <RoundedBox
        args={[w, h, faceT]}
        radius={Math.min(spec.cornerRadiusMm * MM, h / 5, 0.003)}
        smoothness={3}
        position={[0, 0, d / 2 - faceT / 2]}
        castShadow
        material={chassisMaterial(spec.style.face, spec.style.finish, 'face')}
      />
      {returnD > 0.004 && (
        <mesh
          position={[0, 0, d / 2 - faceT - returnD / 2]}
          material={chassisMaterial(spec.style.body, spec.style.finish, 'body')}
          castShadow
        >
          <boxGeometry args={[w * 0.94, h * 0.86, returnD]} />
        </mesh>
      )}
    </>
  );
}

/** Open accessory bases: deck, tray, raceway, bar, frame. */
function OpenBody({ spec }: { spec: ChassisSpec }) {
  const w = spec.widthMm * MM;
  const h = spec.heightMm * MM;
  const d = spec.depthMm * MM;
  const body = chassisMaterial(spec.style.body, spec.style.finish, 'body');
  const face = chassisMaterial(spec.style.face, spec.style.finish, 'face');

  switch (spec.openBody) {
    case 'deck': {
      if (spec.deck!.drawer) {
        return (
          <>
            <mesh position={[0, -h / 2 + 0.0015, 0]} material={body} castShadow receiveShadow>
              <boxGeometry args={[w * 0.98, 0.003, d * 0.96]} />
            </mesh>
            {/* Closed drawer face + pull */}
            <mesh position={[0, 0, d / 2 - 0.0015]} material={face} castShadow>
              <boxGeometry args={[w, h, 0.003]} />
            </mesh>
            <mesh position={[0, 0, d / 2 + 0.004]} material={tintedMaterial(spec.style.detail)} castShadow>
              <boxGeometry args={[w * 0.3, 0.006, 0.005]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[(s * (w * 0.98)) / 2, -h / 2 + (h * 0.4) / 2, 0]}
                material={body}
                castShadow
              >
                <boxGeometry args={[0.003, h * 0.4, d * 0.96]} />
              </mesh>
            ))}
          </>
        );
      }
      // Cantilever shelf: perforated deck at the BOTTOM of the unit,
      // starting flush at the faceplate so the whole depth is usable
      // surface. The front is OPEN — just a shallow folded lip under
      // the deck's leading edge (like the real hardware) — with the
      // tapered side gussets carrying the load.
      const deckT = 0.0022;
      const deckBase = (-spec.heightMm / 2 + 4) * MM;
      const deckY = deckT / 2;
      const earW = (spec.ears?.widthMm ?? 0) * MM;
      const deckLen = d * 0.97;
      const deckZ = d / 2 - 0.001 - deckLen / 2;
      return (
        <group position={[0, deckBase, 0]}>
          <mesh position={[0, deckY, deckZ]} material={face} castShadow receiveShadow>
            <boxGeometry args={[w * 0.985, deckT, deckLen]} />
          </mesh>
          {spec.deck!.perforated && <DeckPerforation spec={spec} yM={deckY + deckT / 2 + 0.0003} />}
          {spec.deck!.slotsMm.map((slot, i) => (
            <DeckSlot key={i} slot={slot} yM={deckY + deckT / 2 + 0.0004} />
          ))}
          {/* Shallow lip folding down from the deck's leading edge to
              the chassis bottom (4 mm below the deck) — never past the
              shelf's own rack unit. */}
          <mesh
            position={[0, (deckT - 0.004) / 2, d / 2 - 0.0015]}
            material={face}
            castShadow
          >
            <boxGeometry args={[w - 2 * earW - 0.002, 0.004 + deckT, 0.003]} />
          </mesh>
          {/* Tapered side gussets (full height front, thin rear tail).
              Orientation is baked into the geometry: tall edge at its
              z = 0, which we place on the shelf's front edge. */}
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={skirtGeometry(spec.heightMm, spec.depthMm)}
              material={body}
              position={[s < 0 ? -w / 2 : w / 2 - 0.0022, -deckBase, d * 0.485]}
              castShadow
            />
          ))}
        </group>
      );
    }
    case 'tray':
      return (
        <>
          <mesh position={[0, -h / 2 + 0.0015, 0]} material={body} castShadow receiveShadow>
            <boxGeometry args={[w * 0.96, 0.003, d * 0.9]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[(s * w * 0.96) / 2, -h / 2 + (h * 0.55) / 2, 0]}
              material={body}
              castShadow
            >
              <boxGeometry args={[0.0025, h * 0.55, d * 0.9]} />
            </mesh>
          ))}
        </>
      );
    case 'raceway':
      return (
        <>
          <RoundedBox
            args={[w * 0.98, h * 0.9, Math.max(d * 0.5, 0.03)]}
            radius={0.002}
            smoothness={2}
            position={[0, 0, -d * 0.2]}
            castShadow
            material={body}
          />
          {/* Entry slot */}
          <mesh position={[0, 0, -d * 0.2 + Math.max(d * 0.25, 0.016)]} material={VENT_CAVITY_MATERIAL}>
            <boxGeometry args={[w * 0.9, h * 0.28, 0.002]} />
          </mesh>
        </>
      );
    case 'bar':
      return (
        <mesh position={[0, 0, d / 2 - 0.004]} material={body} castShadow>
          <boxGeometry args={[w * 0.98, Math.min(h * 0.6, 0.02), 0.008]} />
        </mesh>
      );
    default:
      // Slim mounting frame behind whatever furniture the spec carries.
      return (
        <mesh position={[0, 0, d / 2 - 0.0025]} material={face} castShadow>
          <boxGeometry args={[w, h * 0.92, 0.005]} />
        </mesh>
      );
  }
}

/* ---- LOD levels -------------------------------------------------------- */

function ChassisLevel({
  spec,
  definition,
  detail,
}: {
  spec: ChassisSpec;
  definition: DeviceDefinition;
  detail: 0 | 1;
}) {
  const detailed = detail === 0;
  return (
    <group>
      {spec.bodyStyle === 'box' && <BoxBody spec={spec} />}
      {spec.bodyStyle === 'panel' && <PanelBody spec={spec} />}
      {spec.bodyStyle === 'open' && <OpenBody spec={spec} />}
      {spec.ears && <Ears spec={spec} detailed={detailed} />}
      {spec.vents.map((region, i) => (
        <VentField key={i} spec={spec} region={region} detailed={detailed} />
      ))}
      <Silkscreen spec={spec} definition={definition} />
      {spec.driveBays.length > 0 && <DriveBays spec={spec} detailed={detailed} />}
      {spec.psuFramesMm.length > 0 && <PsuFrames spec={spec} />}
      {spec.outletStrip && <OutletStrip spec={spec} />}
      {detailed && spec.buttons.length > 0 && <Buttons spec={spec} />}
      {spec.handles.length > 0 && <Handles spec={spec} />}
      {spec.feetMm.length > 0 && <Feet spec={spec} />}
      {spec.patchRows.length > 0 && <PatchRows spec={spec} />}
      {spec.fingers && <Fingers spec={spec} detailed={detailed} />}
      {spec.rings.length > 0 && <Rings spec={spec} />}
      {spec.brush && (
        <group position={[spec.brush.xMm * MM, spec.brush.yMm * MM, (spec.depthMm / 2) * MM]}>
          <mesh position={[0, 0, 0.0008]} material={BRUSH_MATERIAL}>
            <boxGeometry args={[spec.brush.wMm * MM, spec.brush.hMm * MM, 0.0035]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Distant silhouette: body + face color only (LOD2/3). */
function SimpleLevel({
  spec,
  labeled,
  definition,
}: {
  spec: ChassisSpec;
  labeled?: boolean;
  definition: DeviceDefinition;
}) {
  const w = spec.widthMm * MM;
  const h = spec.heightMm * MM;
  const d = spec.depthMm * MM;
  const flat = spec.bodyStyle === 'open';
  return (
    <group>
      <mesh
        castShadow
        receiveShadow
        material={chassisMaterial(spec.style.face, spec.style.finish, 'face')}
        position={flat ? [0, -h / 4, 0] : [0, 0, 0]}
      >
        <boxGeometry args={flat ? [w, h / 2, d * 0.9] : [w, h, d]} />
      </mesh>
      {labeled && <Silkscreen spec={spec} definition={definition} />}
    </group>
  );
}

/* ---- entry ------------------------------------------------------------- */

/** LOD switch distances, meters. */
const LOD_DISTANCES = [0, 3.2, 7.5, 16];

/**
 * The generated chassis for a definition. Rebuilds automatically when
 * the definition changes (metadata edits regenerate the model live),
 * and steps through four detail levels by camera distance.
 */
export function ParametricChassis({ definition }: { definition: DeviceDefinition }) {
  const spec = useMemo(() => buildChassisSpec(definition), [definition]);
  return (
    <Detailed distances={LOD_DISTANCES}>
      <ChassisLevel spec={spec} definition={definition} detail={0} />
      <ChassisLevel spec={spec} definition={definition} detail={1} />
      <SimpleLevel spec={spec} definition={definition} labeled />
      <SimpleLevel spec={spec} definition={definition} />
    </Detailed>
  );
}
