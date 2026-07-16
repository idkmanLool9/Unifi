import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { RoundedBox } from '@react-three/drei';
import { createTextTexture } from '@/features/rack/rackTextures';
import { MM_TO_M } from '@/features/rack/rackMath';
import type { DeviceDefinition } from './deviceSchema';

const TONE_COLORS = {
  dark: { body: '#1d1f23', face: '#26282d', detail: '#101114' },
  metal: { body: '#4c5158', face: '#5b6067', detail: '#2c3036' },
} as const;

/**
 * Polished parametric chassis shown until the device's real GLB exists.
 * Built from the definition's true millimeter dimensions, with a branded
 * faceplate and status LED — intentional, not a gray box.
 */
export function DevicePlaceholder({
  definition,
}: {
  definition: DeviceDefinition;
}) {
  const w = definition.widthMm * MM_TO_M;
  const h = definition.heightMm * MM_TO_M;
  const d = definition.depthMm * MM_TO_M;
  const tone = TONE_COLORS[definition.presentation.tone];

  const materials = useMemo(
    () => ({
      body: new MeshStandardMaterial({
        color: tone.body,
        metalness: 0.65,
        roughness: 0.48,
        envMapIntensity: 0.9,
      }),
      face: new MeshStandardMaterial({
        color: tone.face,
        metalness: 0.7,
        roughness: 0.38,
        envMapIntensity: 1.05,
      }),
      led: new MeshStandardMaterial({
        color: '#4c82f7',
        emissive: '#4c82f7',
        emissiveIntensity: 1.6,
        toneMapped: false,
      }),
    }),
    [tone],
  );
  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials],
  );

  const labelTexture = useMemo(
    () =>
      createTextTexture(
        definition.modelNumber.toUpperCase().slice(0, 18),
        'rgba(255, 255, 255, 0.38)',
      ),
    [definition.modelNumber],
  );
  useEffect(() => () => labelTexture.dispose(), [labelTexture]);

  const faceD = 0.004;
  // 4:1 label plate, never taller than 40% of the chassis face; devices
  // with rendered connectors get the label tucked to the top edge so the
  // hardware layer owns the middle of the faceplate.
  const hasPorts = definition.ports.length > 0;
  const labelH = Math.min(Math.min(w * 0.45, 0.2) / 4, h * (hasPorts ? 0.32 : 0.55));
  const labelW = labelH * 4;
  const labelY = hasPorts ? h / 2 - labelH / 2 - h * 0.08 : 0;

  return (
    <group>
      {/* Chassis body */}
      <RoundedBox
        args={[w * 0.985, h * 0.96, Math.max(d - faceD, 0.01)]}
        radius={0.003}
        smoothness={3}
        position={[0, 0, -faceD / 2]}
        castShadow
        receiveShadow
        material={materials.body}
      />
      {/* Faceplate */}
      <RoundedBox
        args={[w, h, faceD]}
        radius={0.0015}
        smoothness={3}
        position={[0, 0, d / 2 - faceD / 2]}
        castShadow
        material={materials.face}
      />
      {/* Silkscreen model label */}
      <mesh position={[-w / 2 + labelW / 2 + 0.012, labelY, d / 2 + 0.0006]}>
        <planeGeometry args={[labelW, labelH]} />
        <meshBasicMaterial
          map={labelTexture}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {/* Status LED (metadata LEDs render via the hardware layer) */}
      {definition.leds.length === 0 && (
        <mesh position={[w / 2 - 0.016, 0, d / 2 + 0.0008]}>
          <boxGeometry args={[0.004, 0.004, 0.001]} />
          <primitive object={materials.led} attach="material" />
        </mesh>
      )}
    </group>
  );
}
