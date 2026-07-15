import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { MathUtils } from 'three';
import { useGLTF } from '@react-three/drei';
import { DevicePlaceholder } from './DevicePlaceholder';
import { deviceModelUrl } from './deviceRegistry';
import { MM_TO_M } from '@/features/rack/rackMath';
import { assetUrl } from '@/lib/assetUrl';
import { useAssetAvailability } from '@/stores/assetStore';
import type { DeviceDefinition } from './deviceSchema';

/**
 * Draco decoder location. Self-hosted (copied from three's examples into
 * public/draco) so compressed GLBs never depend on a third-party CDN —
 * required for offline use, restrictive networks, and subpath deploys.
 */
const DRACO_DECODER_PATH = assetUrl('draco/');

/**
 * Renders a device's real GLB. The loaded scene is cached by drei/useGLTF
 * and shared across instances; each instance renders a clone so per-node
 * state never leaks between instances. The clone shares geometry and
 * material resources with the cached original, so it is intentionally NOT
 * disposed on unmount — the cache owns those resources.
 */
function LoadedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
  }, [cloned]);
  return <primitive object={cloned} />;
}

interface ModelBoundaryProps {
  fallback: ReactNode;
  /** Reset key: retry when the URL changes. */
  url: string;
  children: ReactNode;
}

/**
 * A corrupt or unloadable GLB must degrade to the placeholder, never
 * blank the scene: loader rejections thrown through Suspense are caught
 * here and logged once.
 */
class ModelErrorBoundary extends Component<
  ModelBoundaryProps,
  { failedUrl: string | null }
> {
  state = { failedUrl: null as string | null };

  static getDerivedStateFromError(): { failedUrl: string } {
    return { failedUrl: 'pending' };
  }

  componentDidCatch(error: unknown): void {
    this.setState({ failedUrl: this.props.url });
    console.warn(`[devices] failed to load model ${this.props.url}:`, error);
  }

  render(): ReactNode {
    if (this.state.failedUrl !== null && this.state.failedUrl !== this.props.url) {
      // A different model URL — allow a fresh attempt.
      this.setState({ failedUrl: null });
    }
    return this.state.failedUrl !== null
      ? this.props.fallback
      : this.props.children;
  }
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
      <ModelErrorBoundary
        url={url}
        fallback={<DevicePlaceholder definition={definition} />}
      >
        <Suspense fallback={<DevicePlaceholder definition={definition} />}>
          <LoadedModel url={url} />
        </Suspense>
      </ModelErrorBoundary>
    </group>
  );
}

/** Warms the GLB cache for a device whose model is known to exist. */
export function preloadDeviceModel(definition: DeviceDefinition): void {
  useGLTF.preload(deviceModelUrl(definition), DRACO_DECODER_PATH);
}
