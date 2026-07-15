import { useMemo } from 'react';
import { Line } from '@react-three/drei';

interface RackSelectionProps {
  width: number;
  height: number;
  depth: number;
  accent: string;
  /** Hover shows only the floor outline; selection adds corner brackets. */
  selected: boolean;
}

const BRACKET_LEN = 0.085;
const FLOOR_MARGIN = 0.05;

/**
 * CAD-style selection feedback: thin accent corner brackets on the rack's
 * bounding box plus a soft outline on the floor. No glow, no bloom —
 * quiet and precise, in the manner of Fusion or Blender.
 */
export function RackSelection({
  width,
  height,
  depth,
  accent,
  selected,
}: RackSelectionProps) {
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

  const floorPoints = useMemo(() => {
    const hw = width / 2 + FLOOR_MARGIN;
    const hd = depth / 2 + FLOOR_MARGIN;
    const y = 0.002;
    return [
      [-hw, y, -hd],
      [hw, y, -hd],
      [hw, y, hd],
      [-hw, y, hd],
      [-hw, y, -hd],
    ] as Array<[number, number, number]>;
  }, [width, depth]);

  return (
    <group>
      <Line
        points={floorPoints}
        color={accent}
        lineWidth={1.5}
        transparent
        opacity={selected ? 0.55 : 0.22}
      />
      {selected && (
        <Line
          segments
          points={bracketPoints}
          color={accent}
          lineWidth={1.75}
          transparent
          opacity={0.95}
        />
      )}
    </group>
  );
}
