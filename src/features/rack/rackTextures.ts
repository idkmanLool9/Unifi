import { CanvasTexture, SRGBColorSpace } from 'three';
import type { RackFinish } from './rackConstants';
import type { RackSize } from '@/types';

const FONT_STACK = '"Inter Variable", system-ui, sans-serif';

/** Pixels drawn per rack unit of rail height. */
const PX_PER_U = 96;
/** Rail strip texture width in pixels. */
const RAIL_W = 128;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * Draws a full-height mounting rail strip: three square cage-nut holes per
 * U (EIA pattern), a U boundary tick, and the unit number. U1 sits at the
 * bottom, as on a real rack.
 *
 * @param mirror  When true the hole column hugs the right edge (for the
 *                right-hand rail) instead of the left.
 */
export function createRailTexture(
  units: RackSize,
  finish: RackFinish,
  mirror: boolean,
): CanvasTexture {
  const height = units * PX_PER_U;
  const { canvas, ctx } = makeCanvas(RAIL_W, height);

  const holeSize = 24;
  const holeX = mirror ? RAIL_W - 38 - holeSize / 2 : 38 - holeSize / 2;
  const numberX = mirror ? RAIL_W - 82 : 82;

  for (let i = 0; i < units; i++) {
    const uNumber = units - i; // top row is the highest U
    const yTop = i * PX_PER_U;

    // U boundary tick across the flange
    ctx.fillStyle = finish.ink;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(8, yTop, RAIL_W - 16, 2);
    ctx.globalAlpha = 1;

    // Three cage-nut holes per U at the EIA hole pattern
    ctx.fillStyle = finish.hole;
    for (const f of [1 / 6, 3 / 6, 5 / 6]) {
      roundedRect(
        ctx,
        holeX,
        yTop + f * PX_PER_U - holeSize / 2,
        holeSize,
        holeSize,
        4,
      );
    }

    // Unit number
    ctx.fillStyle = finish.ink;
    ctx.font = `600 30px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(uNumber), numberX, yTop + PX_PER_U / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Small single-line label texture (used by the FRONT floor marker). */
export function createTextTexture(
  text: string,
  color: string,
): CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 128);
  ctx.fillStyle = color;
  ctx.font = `700 64px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Manual letter-spacing for a confident, engineered look.
  const spacing = 18;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = (canvas.width - total) / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, canvas.height / 2);
    x += widths[i] + spacing;
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
