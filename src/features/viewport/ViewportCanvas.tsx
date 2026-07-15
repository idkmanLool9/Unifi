import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ViewportHint } from './ViewportHint';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { CAMERA } from '@/lib/constants';

/**
 * The 3D editor viewport. The WebGL canvas is transparent and sits on a
 * CSS gradient backdrop, so theme switching never needs to touch the GL
 * clear color.
 */
export function ViewportCanvas() {
  const theme = useResolvedTheme();

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
          position: CAMERA.position,
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
        }}
        className="!absolute inset-0"
      >
        <Scene theme={theme} />
      </Canvas>
      <ViewportHint />
    </div>
  );
}
