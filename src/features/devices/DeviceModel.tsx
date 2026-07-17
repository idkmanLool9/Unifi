import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { MathUtils } from 'three';
import { useGLTF } from '@react-three/drei';
import { DevicePlaceholder } from './DevicePlaceholder';
import { HardwareLayer } from './hardware/HardwareLayer';
import { calibrateFromModel } from './hardware/connectorCalibration';
import { deviceModelUrl } from './deviceRegistry';
import { buildImportReport } from './import/modelImport';
import { useImportReportStore } from './import/importReportStore';
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
 * Renders a device's real GLB through the universal import pipeline.
 * The loaded scene is cached by drei/useGLTF and shared across
 * instances; each instance renders a clone so per-node state never
 * leaks between instances. The clone shares geometry and material
 * resources with the cached original, so it is intentionally NOT
 * disposed on unmount — the cache owns those resources.
 *
 * The clone is measured once and the import pipeline resolves the final
 * transform: explicit metadata wins verbatim, otherwise a deterministic
 * default (origin normalization + spec axis matching) applies. The
 * model itself is never scaled or modified — dimension deviations are
 * reported as warnings.
 */
export function LoadedModel({
  url,
  definition,
}: {
  url: string;
  definition: DeviceDefinition;
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const register = useImportReportStore((s) => s.register);

  const report = useMemo(
    () => buildImportReport(definition, cloned),
    [definition, cloned],
  );

  useEffect(() => {
    cloned.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
  }, [cloned]);

  useEffect(() => {
    if (report) register(report);
  }, [report, register]);

  // Connector calibration: align metadata ports onto the model's real
  // connector geometry (runs once per definition; cached).
  useEffect(() => {
    if (report) calibrateFromModel(definition, cloned, report.transform);
  }, [report, definition, cloned]);

  const transform = report?.transform ?? definition.modelTransform;
  const rotation = useMemo(
    () =>
      (transform
        ? transform.rotationDeg.map((deg) => MathUtils.degToRad(deg))
        : [0, 0, 0]) as [number, number, number],
    [transform],
  );
  const offset = useMemo(
    () =>
      (transform
        ? transform.offsetMm.map((mm) => mm * MM_TO_M)
        : [0, 0, 0]) as [number, number, number],
    [transform],
  );

  return (
    <group scale={transform?.scale ?? 1} rotation={rotation} position={offset}>
      <primitive object={cloned} />
    </group>
  );
}

interface ModelBoundaryProps {
  fallback: ReactNode;
  /** Used for diagnostics; key the boundary by URL to retry a new asset. */
  label: string;
  children: ReactNode;
}

/**
 * A corrupt or unloadable GLB (or any crash inside a device's 3D subtree)
 * must degrade to the placeholder, never blank the scene. State is only
 * ever set from React's error path — no render-phase updates. Mount with
 * `key={url}` so a changed asset gets a fresh attempt.
 */
export class ModelErrorBoundary extends Component<
  ModelBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn(`[devices] ${this.props.label}: falling back —`, error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface DeviceModelProps {
  definition: DeviceDefinition;
  /** Mounted instance id (when rendered in the rack) — used by hardware
   *  overlays that react to per-instance interaction state. */
  instanceId?: string;
}

/**
 * The visual body of a device, in device-local space (origin at the
 * chassis center, front face toward +Z). Loads the conventional GLB when
 * present on disk; otherwise renders the parametric placeholder. The
 * universal import pipeline corrects orientation and origin of the GLB —
 * the source asset is never modified or resized arbitrarily.
 */
export function DeviceModel({ definition, instanceId }: DeviceModelProps) {
  const url = deviceModelUrl(definition);
  const availability = useAssetAvailability(url);

  if (availability !== 'available') {
    // Placeholder chassis + the full metadata-driven hardware layer.
    return (
      <>
        <DevicePlaceholder definition={definition} />
        <HardwareLayer definition={definition} mode="full" instanceId={instanceId} />
      </>
    );
  }

  // GLBs marked 'chassis' get the full hardware layer; detailed models
  // ('full', the default) only receive additive overlays (Etherlighting).
  return (
    <>
      <ModelErrorBoundary
        key={url}
        label={`model ${url}`}
        fallback={<DevicePlaceholder definition={definition} />}
      >
        <Suspense fallback={<DevicePlaceholder definition={definition} />}>
          <LoadedModel url={url} definition={definition} />
        </Suspense>
      </ModelErrorBoundary>
      <HardwareLayer
        definition={definition}
        mode={definition.modelDetail === 'chassis' ? 'full' : 'overlay'}
        instanceId={instanceId}
      />
    </>
  );
}

/** Warms the GLB cache for a device whose model is known to exist. */
export function preloadDeviceModel(definition: DeviceDefinition): void {
  useGLTF.preload(deviceModelUrl(definition), DRACO_DECODER_PATH);
}
