import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useViewportStore } from '@/stores/viewportStore';

const SAMPLE_INTERVAL_MS = 500;

/**
 * Measures real frame throughput inside the render loop and publishes it
 * to the viewport store on a throttle, so the status bar updates twice a
 * second without re-rendering anything per frame.
 */
export function StatsProbe() {
  const setStats = useViewportStore((s) => s.setStats);
  const frames = useRef(0);
  const windowStart = useRef(performance.now());

  useFrame(({ gl }) => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - windowStart.current;
    if (elapsed >= SAMPLE_INTERVAL_MS) {
      setStats({
        fps: Math.round((frames.current * 1000) / elapsed),
        triangles: gl.info.render.triangles,
        drawCalls: gl.info.render.calls,
      });
      frames.current = 0;
      windowStart.current = now;
    }
  });

  return null;
}
