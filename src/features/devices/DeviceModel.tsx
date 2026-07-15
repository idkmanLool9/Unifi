import { Suspense, useEffect, useMemo } from 'react';
import { MathUtils } from 'three';
import { useGLTF } from '@react-three/drei';
import { DevicePlaceholder } from './DevicePlaceholder';
import { deviceModelUrl } from './deviceRegistry';
import { MM_TO_M } from '@/features/rack/rackMath';
import { useAssetAvailability } from '@/stores/assetStore';
import type { DeviceDefinition } from './deviceSchema';

/**
 * Renders a device's real GLB. The loaded scene is cached by drei/useGLTF
 * and shared across instances; each instance renders a clone so per-node
 * state never leaks between instances. The clone shares geometry and
 * material resources with the cached original, so it is intentionally NOT
 * disposed on unmount — the cache owns those resources.
 */
function LoadedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
  }, [cloned]);
  return <primitive object={cloned} />;
}

interface DeviceModelProps {
  definition: DeviceDefinition;
}

/**
 * The visual body of a device, in device-local space (origin at the
 * chassis center, front face toward +Z). Loads the conventional GLB when
 * present on disk; otherwise renders the parametric placeholder. The
 * definition's modelTransform (metadata as source of truth) corrects
 * scale, rotation, and origin of the GLB — the source asset is never
 * modified or resized arbitrarily.
 */
export function DeviceModel({ definition }: DeviceModelProps) {
  const url = deviceModelUrl(definition);
  const availability = useAssetAvailability(url);

  const t = definition.modelTransform;
  const rotation = useMemo(
    () =>
      [
        MathUtils.degToRad(t.rotationDeg[0]),
        MathUtils.degToRad(t.rotationDeg[1]),
        MathUtils.degToRad(t.rotationDeg[2]),
      ] as [number, number, number],
    [t],
  );
  const offset = useMemo(
    () =>
      [
        t.offsetMm[0] * MM_TO_M,
        t.offsetMm[1] * MM_TO_M,
        t.offsetMm[2] * MM_TO_M,
      ] as [number, number, number],
    [t],
  );

  if (availability !== 'available') {
    return <DevicePlaceholder definition={definition} />;
  }

  return (
    <group scale={t.scale} rotation={rotation} position={offset}>
      <Suspense fallback={<DevicePlaceholder definition={definition} />}>
        <LoadedModel url={url} />
      </Suspense>
    </group>
  );
}

/** Warms the GLB cache for a device whose model is known to exist. */
export function preloadDeviceModel(definition: DeviceDefinition): void {
  useGLTF.preload(deviceModelUrl(definition));
}
