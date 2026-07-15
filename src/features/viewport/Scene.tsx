import { ContactShadows, Grid } from '@react-three/drei';
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
  const rack = useRackStore((s) => s.rack);

  return (
    <>
      <SceneLighting />

      {gridVisible && (
        <Grid
          position={[0, 0, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor={colors.gridCell}
          sectionSize={2.5}
          sectionThickness={1.1}
          sectionColor={colors.gridSection}
          fadeDistance={45}
          fadeStrength={1.2}
          infiniteGrid
        />
      )}

      {rack && <RackModel rack={rack} theme={theme} />}

      {rack && shadowsEnabled && (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={theme === 'dark' ? 0.5 : 0.32}
          scale={4}
          blur={2.4}
          far={2.5}
          resolution={512}
        />
      )}

      <CameraRig />
      <StatsProbe />
    </>
  );
}
