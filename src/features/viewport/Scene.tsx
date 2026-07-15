import { Grid } from '@react-three/drei';
import { SceneLighting } from './SceneLighting';
import { CameraRig } from './CameraRig';
import { StatsProbe } from './StatsProbe';
import { VIEWPORT_THEME } from './viewportTheme';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import type { ResolvedTheme } from '@/types';

interface SceneProps {
  theme: ResolvedTheme;
}

export function Scene({ theme }: SceneProps) {
  const colors = VIEWPORT_THEME[theme];
  const gridVisible = useViewSettingsStore((s) => s.gridVisible);

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

      <CameraRig />
      <StatsProbe />
    </>
  );
}
