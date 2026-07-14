export type { ProcessOptions } from "./types.ts";
import type { ProcessOptions } from "./types.ts";
import { applyWidgetFix, calculateTopStrip, calculateRadius } from "./widget.ts";
import type { WidgetOptions } from "./widget.ts";

function p(data: Uint8ClampedArray, i: number): number {
  return data[i]!;
}

export function cutImage(
  data: ImageData,
  options?: ProcessOptions & WidgetOptions,
): ImageData {
  const topStrip = options?.topStrip ?? calculateTopStrip(data.width, data.height);
  const radius = options?.radius ?? calculateRadius(data.width, data.height);
  return applyWidgetFix(data, topStrip, radius);
}

export function cleanImage(
  data: ImageData,
  options?: ProcessOptions,
): ImageData {
  const smoothness = options?.smoothness ?? 1;
  const { width, height } = data;
  const output = new Uint8ClampedArray(data.data);

  if (smoothness < 1) return new ImageData(output, width, height);

  const kernelSize = Math.max(1, Math.min(5, Math.round(smoothness)));
  const half = Math.floor(kernelSize / 2);
  const area = kernelSize * kernelSize;

  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;

      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const i = ((y + ky) * width + (x + kx)) * 4;
          rr += p(data.data, i);
          gg += p(data.data, i + 1);
          bb += p(data.data, i + 2);
          aa += p(data.data, i + 3);
        }
      }

      const i = (y * width + x) * 4;
      output[i] = rr / area;
      output[i + 1] = gg / area;
      output[i + 2] = bb / area;
      output[i + 3] = aa / area;
    }
  }

  return new ImageData(output, width, height);
}

export function clearImage(
  data: ImageData,
  options?: ProcessOptions,
): ImageData {
  const tolerance = options?.tolerance ?? 60;
  const threshold = options?.threshold ?? 240;
  const output = new Uint8ClampedArray(data.data);
  const { width, height } = data;

  const edgePixels: Array<[number, number, number, number]> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = p(data.data, i);
      const g = p(data.data, i + 1);
      const b = p(data.data, i + 2);
      const a = p(data.data, i + 3);

      if (
        a >= 30 &&
        (x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
          (r > threshold && g > threshold && b > threshold))
      ) {
        edgePixels.push([r, g, b, a]);
      }
    }
  }

  if (edgePixels.length === 0) return new ImageData(output, width, height);

  const avgR = edgePixels.reduce((s, p) => s + p[0], 0) / edgePixels.length;
  const avgG = edgePixels.reduce((s, p) => s + p[1], 0) / edgePixels.length;
  const avgB = edgePixels.reduce((s, p) => s + p[2], 0) / edgePixels.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = p(data.data, i);
      const g = p(data.data, i + 1);
      const b = p(data.data, i + 2);
      const a = p(data.data, i + 3);

      const dr = r - avgR;
      const dg = g - avgG;
      const db = b - avgB;
      if (dr * dr + dg * dg + db * db + (a - 255) * (a - 255) < tolerance * tolerance) {
        output[i + 3] = 0;
      }
    }
  }

  return new ImageData(output, width, height);
}
