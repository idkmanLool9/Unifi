import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ViewportHint } from './ViewportHint';
import { ViewportNavWidget } from './ViewportNavWidget';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { CAMERA } from '@/lib/constants';

/**
 * The 3D editor viewport. The WebGL canvas is transparent and sits on a
 * CSS gradient backdrop with a soft vignette, so theme switching never
 * needs to touch GL state. Floating chrome (nav widget, hints) is layered
 * above the canvas.
 */
export function ViewportCanvas() {
  const theme = useResolvedTheme();
  const hintsVisible = useViewSettingsStore((s) => s.hintsVisible);

  return (
    <div className="viewport-backdrop relative min-w-0 flex-1">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          position: [...CAMERA.position],
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
        }}
        className="!absolute inset-0"
      >
        <Scene theme={theme} />
      </Canvas>

      <div className="viewport-vignette pointer-events-none absolute inset-0" />
      <ViewportNavWidget />
      {hintsVisible && <ViewportHint />}
    </div>
  );
}
