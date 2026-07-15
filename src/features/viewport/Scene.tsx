import { Grid, OrbitControls } from '@react-three/drei';
import { SceneLighting } from './SceneLighting';
import { StatsProbe } from './StatsProbe';
import { VIEWPORT_THEME } from './viewportTheme';
import { CAMERA } from '@/lib/constants';
import type { ResolvedTheme } from '@/types';

interface SceneProps {
  theme: ResolvedTheme;
}

export function Scene({ theme }: SceneProps) {
  const colors = VIEWPORT_THEME[theme];

  return (
    <>
      <SceneLighting />

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
        fadeStrength={1}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 1, 0]}
        minDistance={CAMERA.minDistance}
        maxDistance={CAMERA.maxDistance}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />

      <StatsProbe />
    </>
  );
}
