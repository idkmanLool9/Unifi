import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { RackFinish } from './rackConstants';
import type { RackSize } from '@/types';

const FONT_STACK = '"Inter Variable", system-ui, sans-serif';

/** Pixels drawn per rack unit of rail height. */
const PX_PER_U = 128;
/** Rail strip texture width in pixels (maps to the flange width). */
const RAIL_W = 128;

/**
 * EIA-310 hole centers within one U, measured from the top of the unit:
 * 6.35mm / 22.225mm / 38.1mm of 44.45mm.
 */
const HOLE_FRACTIONS = [6.35 / 44.45, 22.225 / 44.45, 38.1 / 44.45] as const;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

/**
 * Draws a full-height mounting rail strip: three square cage-nut holes per
 * U at the EIA pattern, a U boundary tick, and the unit number. U1 sits at
 * the bottom, as on a real rack. Holes get a faked bevel (dark top edge,
 * light bottom edge) so they read as punched steel under top lighting.
 *
 * @param mirror  When true the hole column hugs the right edge (for rails
 *                whose inner edge faces right as seen by the viewer).
 */
export function createRailTexture(
  units: RackSize,
  finish: RackFinish,
  mirror: boolean,
): CanvasTexture {
  const height = units * PX_PER_U;
  const { canvas, ctx } = makeCanvas(RAIL_W, height);

  // ~12.7mm square hole on a ~58mm flange strip. Kept compact so silver
  // rail shows between the three holes rather than merging into a band.
  const holeSize = 22;
  const holeCenterX = mirror ? RAIL_W - 26 : 26;
  const numberX = mirror ? RAIL_W - 78 : 78;

  for (let i = 0; i < units; i++) {
    const uNumber = units - i; // top row is the highest U
    const yTop = i * PX_PER_U;

    // U boundary tick across the flange
    ctx.fillStyle = finish.ink;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(6, yTop, RAIL_W - 12, 2);
    ctx.globalAlpha = 1;

    for (const f of HOLE_FRACTIONS) {
      const cy = yTop + f * PX_PER_U;
      const x = holeCenterX - holeSize / 2;
      const y = cy - holeSize / 2;

      // Punched square hole with a subtle bevel illusion
      ctx.fillStyle = finish.hole;
      ctx.beginPath();
      ctx.roundRect(x, y, holeSize, holeSize, 4);
      ctx.fill();
      // Shadowed top lip (soft, so it doesn't read as a black band on a
      // bright silver rail)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.beginPath();
      ctx.roundRect(x, y, holeSize, 5, 4);
      ctx.fill();
      // Light-catching bottom lip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.roundRect(x, y + holeSize - 3, holeSize, 3, 3);
      ctx.fill();
    }

    // Unit number, silkscreen-style
    ctx.fillStyle = finish.ink;
    ctx.font = `500 30px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    ctx.fillText(String(uNumber), numberX, yTop + PX_PER_U / 2);
    ctx.globalAlpha = 1;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Small tileable monochrome noise, used as roughness/bump map to give
 * powder-coated surfaces their slight orange-peel imperfection.
 */
export function createNoiseTexture(): CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 165 + Math.random() * 70;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 6);
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
