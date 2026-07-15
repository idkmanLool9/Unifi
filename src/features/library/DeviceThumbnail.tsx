import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CatalogDevice } from './catalog';

/**
 * Procedural front-faceplate illustration for a device. Drawn as SVG from
 * the device's category and rack height, so every catalog entry gets a
 * crisp, consistent thumbnail without shipping image assets.
 */

const PLATE_W = 190;
const U_H = 22;
const EAR_W = 9;

interface FaceTone {
  plate: string;
  edge: string;
  detail: string;
}

const TONE: Record<'dark' | 'metal', FaceTone> = {
  dark: { plate: '#26282c', edge: '#3a3d43', detail: '#101114' },
  metal: { plate: '#585d66', edge: '#787d87', detail: '#2c3036' },
};

function PortGrid({
  x,
  y,
  cols,
  rows,
  cell,
  gap,
  color,
}: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell: number;
  gap: number;
  color: string;
}) {
  const ports: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ports.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * (cell + gap)}
          y={y + r * (cell + gap)}
          width={cell}
          height={cell}
          rx={0.8}
          fill={color}
        />,
      );
    }
  }
  return <>{ports}</>;
}

function FaceDetails({ device, tone }: { device: CatalogDevice; tone: FaceTone }) {
  const h = device.units * U_H;
  const midY = h / 2;

  switch (device.faceplate) {
    case 'network':
      return (
        <>
          <PortGrid x={22} y={midY - 7} cols={16} rows={2} cell={5.5} gap={1.6} color={tone.detail} />
          <PortGrid x={140} y={midY - 7} cols={4} rows={2} cell={5.5} gap={1.6} color={tone.detail} />
          <circle cx={172} cy={midY - 4} r={1.6} fill="#4c82f7" opacity={0.9} />
          <circle cx={172} cy={midY + 3} r={1.6} fill={tone.detail} />
        </>
      );
    case 'server':
      return (
        <>
          {Array.from({ length: device.units * 2 }, (_, i) => (
            <rect
              key={i}
              x={20}
              y={5 + i * (h - 10) / (device.units * 2)}
              width={116}
              height={(h - 14) / (device.units * 2)}
              rx={1.2}
              fill={tone.detail}
              opacity={0.85}
            />
          ))}
          <rect x={144} y={5} width={32} height={h - 10} rx={1.5} fill={tone.detail} opacity={0.55} />
          <circle cx={160} cy={h - 9} r={1.6} fill="#3fb970" opacity={0.9} />
        </>
      );
    case 'storage': {
      const bays = device.units === 1 ? 4 : 8;
      const cols = 4;
      const rows = bays / cols;
      const bayW = 34;
      const bayH = (h - 10 - (rows - 1) * 2) / rows;
      return (
        <>
          {Array.from({ length: bays }, (_, i) => {
            const c = i % cols;
            const r = Math.floor(i / cols);
            return (
              <g key={i}>
                <rect
                  x={20 + c * (bayW + 2)}
                  y={5 + r * (bayH + 2)}
                  width={bayW}
                  height={bayH}
                  rx={1.2}
                  fill={tone.detail}
                  opacity={0.9}
                />
                <rect
                  x={22 + c * (bayW + 2)}
                  y={5 + r * (bayH + 2) + bayH / 2 - 0.8}
                  width={5}
                  height={1.6}
                  rx={0.8}
                  fill={tone.edge}
                />
              </g>
            );
          })}
          <circle cx={172} cy={midY} r={1.8} fill="#4c82f7" opacity={0.85} />
        </>
      );
    }
    case 'ups':
      return (
        <>
          <rect x={22} y={midY - 7.5} width={34} height={15} rx={2} fill={tone.detail} />
          <rect x={26} y={midY - 4} width={26} height={8} rx={1} fill="#3a4a68" opacity={0.9} />
          <circle cx={70} cy={midY} r={2.2} fill={tone.detail} />
          <circle cx={80} cy={midY} r={2.2} fill={tone.detail} />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={96 + i * 5.6} y={midY - 6} width={2.4} height={12} rx={1} fill={tone.detail} opacity={0.7} />
          ))}
        </>
      );
    case 'pdu':
      return (
        <PortGrid x={20} y={midY - 3.5} cols={19} rows={1} cell={7} gap={1.4} color={tone.detail} />
      );
  }
}

interface DeviceThumbnailProps {
  device: CatalogDevice;
  className?: string;
}

export function DeviceThumbnail({ device, className }: DeviceThumbnailProps) {
  const gradientId = useId();
  const tone = TONE[device.tone];
  const h = device.units * U_H;

  return (
    <svg
      viewBox={`0 0 ${PLATE_W} ${h}`}
      className={cn('block w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.edge} />
          <stop offset="18%" stopColor={tone.plate} />
          <stop offset="100%" stopColor={tone.plate} />
        </linearGradient>
      </defs>

      {/* Rack ears */}
      {[0, PLATE_W - EAR_W].map((x) => (
        <g key={x}>
          <rect x={x} y={0.5} width={EAR_W} height={h - 1} rx={1.4} fill={tone.plate} />
          <circle cx={x + EAR_W / 2} cy={5.5} r={1.7} fill={tone.detail} />
          <circle cx={x + EAR_W / 2} cy={h - 5.5} r={1.7} fill={tone.detail} />
        </g>
      ))}

      {/* Faceplate body */}
      <rect
        x={EAR_W + 1.5}
        y={0.5}
        width={PLATE_W - 2 * EAR_W - 3}
        height={h - 1}
        rx={2}
        fill={`url(#${gradientId})`}
      />

      <FaceDetails device={device} tone={tone} />
    </svg>
  );
}
