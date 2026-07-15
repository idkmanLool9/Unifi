import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ViewportHint } from './ViewportHint';
import { ViewportNavWidget } from './ViewportNavWidget';
import { WelcomeOverlay } from '@/features/rack/WelcomeOverlay';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useRackStore } from '@/stores/rackStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { CAMERA } from '@/lib/constants';

/** Pointer travel (px) below which a pointerup still counts as a click. */
const CLICK_DRAG_TOLERANCE = 5;

/**
 * The 3D editor viewport. The WebGL canvas is transparent and sits on a
 * CSS gradient backdrop with a soft vignette, so theme switching never
 * needs to touch GL state. Floating chrome (nav widget, hints, welcome
 * card) is layered above the canvas.
 */
export function ViewportCanvas() {
  const theme = useResolvedTheme();
  const hintsVisible = useViewSettingsStore((s) => s.hintsVisible);
  const hasRack = useRackStore((s) => s.rack !== null);
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="viewport-backdrop relative min-w-0 flex-1"
      onPointerDown={(e) => {
        pointerDownAt.current = { x: e.clientX, y: e.clientY };
      }}
    >
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
        onPointerMissed={(e) => {
          // Only deselect on a true click — orbiting the camera also ends
          // with a pointerup, which must not clear the selection.
          const down = pointerDownAt.current;
          const moved =
            down &&
            Math.hypot(e.clientX - down.x, e.clientY - down.y) >
              CLICK_DRAG_TOLERANCE;
          if (!moved) useRackStore.getState().setSelected(null);
        }}
      >
        <Scene theme={theme} />
      </Canvas>

      <div className="viewport-vignette pointer-events-none absolute inset-0" />

      {hasRack ? (
        <>
          <ViewportNavWidget />
          {hintsVisible && <ViewportHint />}
        </>
      ) : (
        <WelcomeOverlay />
      )}
    </div>
  );
}
