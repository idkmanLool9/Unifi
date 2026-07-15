import { useMemo, useRef } from 'react';
import { Group, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Line2 } from 'three-stdlib';

interface RackSelectionProps {
  width: number;
  height: number;
  depth: number;
  accent: string;
  /** Hover shows only the floor outline; selection adds corner brackets. */
  selected: boolean;
  /** 'device' renders brackets only — no floor outline mid-rack. */
  variant?: 'rack' | 'device';
}

const BRACKET_LEN = 0.085;
const FLOOR_MARGIN = 0.05;
const FLOOR_CORNER_RADIUS = 0.07;

function buildRoundedRect(
  hw: number,
  hd: number,
  r: number,
): Array<[number, number, number]> {
  const y = 0.002;
  const pts: Array<[number, number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [hw - r, hd - r, 0],
    [-(hw - r), hd - r, Math.PI / 2],
    [-(hw - r), -(hd - r), Math.PI],
    [hw - r, -(hd - r), (3 * Math.PI) / 2],
  ];
  const SEGMENTS = 6;
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = start + (i / SEGMENTS) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
  }
  pts.push(pts[0]);
  return pts;
}

/**
 * CAD-style selection feedback: thin accent corner brackets on the rack's
 * bounding box plus a soft rounded outline on the floor. No glow, no
 * bloom — quiet and precise, in the manner of Fusion or Blender. Fades
 * and settles in via damped animation.
 */
export function RackSelection({
  width,
  height,
  depth,
  accent,
  selected,
  variant = 'rack',
}: RackSelectionProps) {
  const groupRef = useRef<Group>(null);
  const floorRef = useRef<Line2>(null);
  const bracketsRef = useRef<Line2>(null);
  const progress = useRef(0);

  const bracketPoints = useMemo(() => {
    const hw = width / 2 + 0.015;
    const hd = depth / 2 + 0.015;
    const y0 = 0.004;
    const y1 = height + 0.015;
    const pts: Array<[number, number, number]> = [];

    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        for (const [y, dy] of [
          [y0, 1],
          [y1, -1],
        ] as const) {
          const c: [number, number, number] = [sx * hw, y, sz * hd];
          pts.push(c, [c[0] - sx * BRACKET_LEN, c[1], c[2]]);
          pts.push(c, [c[0], c[1] + dy * BRACKET_LEN, c[2]]);
          pts.push(c, [c[0], c[1], c[2] - sz * BRACKET_LEN]);
        }
      }
    }
    return pts;
  }, [width, height, depth]);

  const floorPoints = useMemo(
    () =>
      buildRoundedRect(
        width / 2 + FLOOR_MARGIN,
        depth / 2 + FLOOR_MARGIN,
        FLOOR_CORNER_RADIUS,
      ),
    [width, depth],
  );

  // Settle-in animation: lines fade and shrink onto the bounds.
  useFrame((_, delta) => {
    progress.current = MathUtils.damp(progress.current, 1, 10, delta);
    const p = progress.current;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.03 - 0.03 * p);
    }
    if (floorRef.current) {
      floorRef.current.material.opacity = (selected ? 0.55 : 0.22) * p;
    }
    if (bracketsRef.current) {
      bracketsRef.current.material.opacity = (selected ? 0.95 : 0.35) * p;
    }
  });

  return (
    <group ref={groupRef}>
      {variant === 'rack' && (
        <Line
          ref={floorRef}
          points={floorPoints}
          color={accent}
          lineWidth={1.5}
          transparent
          opacity={0}
        />
      )}
      {(selected || variant === 'device') && (
        <Line
          ref={bracketsRef}
          segments
          points={bracketPoints}
          color={accent}
          lineWidth={1.6}
          transparent
          opacity={0}
        />
      )}
    </group>
  );
}
