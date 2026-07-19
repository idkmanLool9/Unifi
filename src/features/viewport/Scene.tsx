import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Grid } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { useEtherlightingStore } from '@/features/devices/hardware/etherlighting/etherlightingStore';
import { SceneLighting } from './SceneLighting';
import { CameraRig } from './CameraRig';
import { StatsProbe } from './StatsProbe';
import { VIEWPORT_THEME } from './viewportTheme';
import { RackModel } from '@/features/rack/RackModel';
import { useCabinetStore } from '@/stores/cabinetStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import type { ResolvedTheme } from '@/types';

/**
 * On-demand shadow maps. Shadows are expensive (a full extra scene pass
 * from the light's view every frame) yet only change when geometry moves.
 * We switch off per-frame auto-update and re-render the shadow map only for
 * a short window after anything that actually moves the scene — device
 * placement/drag, cabinet doors, rack orientation, shadow toggle. Camera
 * orbit and the port-glow animation (which don't move casters) then cost no
 * shadow work at all. Purely a performance change: the shadows look identical.
 */
function ShadowSync() {
  const gl = useThree((s) => s.gl);
  const dirtyUntil = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    dirtyUntil.current = performance.now() + 800;
    const bump = () => {
      dirtyUntil.current = performance.now() + 700;
    };
    const unsub = [
      useRackStore.subscribe(bump),
      useDeviceInstancesStore.subscribe(bump),
      useCabinetStore.subscribe(bump),
      useViewSettingsStore.subscribe(bump),
    ];
    return () => {
      unsub.forEach((u) => u());
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    if (performance.now() < dirtyUntil.current) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

interface SceneProps {
  theme: ResolvedTheme;
}

export function Scene({ theme }: SceneProps) {
  const colors = VIEWPORT_THEME[theme];
  const gridVisible = useViewSettingsStore((s) => s.gridVisible);
  const shadowsEnabled = useViewSettingsStore((s) => s.shadowsEnabled);
  const aoEnabled = useViewSettingsStore((s) => s.aoEnabled);
  const rack = useRackStore((s) => s.rack);

  return (
    <>
      <SceneLighting />
      <ShadowSync />

      {gridVisible && (
        <Grid
          position={[0, 0, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.55}
          cellColor={colors.gridCell}
          sectionSize={2.5}
          sectionThickness={1.2}
          sectionColor={colors.gridSection}
          fadeDistance={40}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      {rack && <RackModel rack={rack} theme={theme} />}

      {rack && shadowsEnabled && (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={theme === 'dark' ? 0.55 : 0.34}
          scale={4.5}
          blur={2.8}
          far={2.6}
          resolution={512}
        />
      )}

      <ScenePostprocessing aoEnabled={aoEnabled} />

      <CameraRig />
      <StatsProbe />
    </>
  );
}

/**
 * Post pipeline: ambient occlusion + Etherlighting bloom share one
 * composer. HDR frame emissives (> 1) feed the bloom threshold, so lit
 * ports get the soft halo of real RGB hardware.
 */
function ScenePostprocessing({ aoEnabled }: { aoEnabled: boolean }) {
  const ether = useEtherlightingStore((s) => s.settings);
  const bloomActive = ether.enabled && ether.enableBloom;
  if (!aoEnabled && !bloomActive) return null;
  return (
    <EffectComposer multisampling={2}>
      {aoEnabled ? (
        <N8AO
          halfRes
          quality="performance"
          aoRadius={0.35}
          intensity={2.6}
          distanceFalloff={0.8}
        />
      ) : (
        <></>
      )}
      {bloomActive ? (
        <Bloom
          intensity={ether.bloomStrength}
          luminanceThreshold={1}
          luminanceSmoothing={0.35}
          mipmapBlur
        />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}
