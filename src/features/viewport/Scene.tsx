import { ContactShadows, Grid } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { SceneLighting } from './SceneLighting';
import { CameraRig } from './CameraRig';
import { StatsProbe } from './StatsProbe';
import { VIEWPORT_THEME } from './viewportTheme';
import { RackModel } from '@/features/rack/RackModel';
import { useRackStore } from '@/stores/rackStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import type { ResolvedTheme } from '@/types';

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

      {aoEnabled && (
        <EffectComposer multisampling={4}>
          <N8AO
            halfRes
            quality="performance"
            aoRadius={0.35}
            intensity={2.6}
            distanceFalloff={0.8}
          />
        </EffectComposer>
      )}

      <CameraRig />
      <StatsProbe />
    </>
  );
}
