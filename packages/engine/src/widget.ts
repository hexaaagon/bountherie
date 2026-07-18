let DEBUG =
  typeof globalThis !== "undefined" &&
  !!(globalThis as unknown as Record<string, unknown>).__DWIF_DEBUG__;

export function setDebug(enabled: boolean) {
  DEBUG = enabled;
}
function debug(...args: unknown[]) {
  if (DEBUG) console.warn("[widget]", ...args);
}

export const REFERENCE_SIZE = 512;
export const AUTO_TOP_STRIP_BASE = 17;
export const AUTO_RADIUS_BASE = 36;

const AUTO_TOP_STRIP_EXPONENT = 1;
const AUTO_RADIUS_EXPONENT = 1;

export function calculateTopStrip(width: number, height: number): number {
  const sizeFactor = Math.sqrt(width * height) / REFERENCE_SIZE;
  const result = Math.max(
    0,
    Math.round(AUTO_TOP_STRIP_BASE * sizeFactor ** AUTO_TOP_STRIP_EXPONENT),
  );
  debug("calculateTopStrip(%d, %d) = %d (sizeFactor=%d)", width, height, result, sizeFactor);
  return result;
}

export function calculateRadius(width: number, height: number): number {
  const sizeFactor = Math.sqrt(width * height) / REFERENCE_SIZE;
  const result = Math.max(0, Math.round(AUTO_RADIUS_BASE * sizeFactor ** AUTO_RADIUS_EXPONENT));
  debug("calculateRadius(%d, %d) = %d (sizeFactor=%d)", width, height, result, sizeFactor);
  return result;
}

export interface WidgetOptions {
  topStrip?: number;
  radius?: number;
}

function buildCornerClearStarts(radius: number): Int32Array {
  const clearStarts = new Int32Array(radius);
  const radiusSquared = radius * radius;

  for (let localY = 0; localY < radius; localY++) {
    let clearStart = radius;
    const dy = localY + 0.5 - radius;

    for (let localX = 0; localX < radius; localX++) {
      const dx = localX + 0.5;

      if (dx * dx + dy * dy > radiusSquared) {
        clearStart = localX;
        break;
      }
    }

    clearStarts[localY] = clearStart;
  }

  debug("buildCornerClearStarts: radius=%d, starts=%o", radius, Array.from(clearStarts));
  return clearStarts;
}

export function applyWidgetFix(data: ImageData, topStrip: number, radius: number): ImageData {
  const { width, height } = data;
  const rowStride = width * 4;
  const output = new Uint8ClampedArray(width * height * 4);

  const clampedRadius = Math.min(radius, width, height);
  const clampedTopStrip = Math.min(topStrip, height);

  debug(
    "applyWidgetFix: %dx%d, topStrip=%d (clamped=%d), radius=%d (clamped=%d)",
    width,
    height,
    topStrip,
    clampedTopStrip,
    radius,
    clampedRadius,
  );

  for (let y = 0; y < height - clampedTopStrip; y++) {
    const srcOffset = y * rowStride;
    const dstOffset = (y + clampedTopStrip) * rowStride;
    output.set(data.data.subarray(srcOffset, srcOffset + rowStride), dstOffset);
  }

  if (clampedRadius > 0 && clampedRadius <= width) {
    const clearStarts = buildCornerClearStarts(clampedRadius);
    const cornerStartX = width - clampedRadius;

    for (let localY = 0; localY < clampedRadius; localY++) {
      const y = clampedTopStrip + localY;
      if (y >= height) break;

      const clearStart = clearStarts[localY] ?? clampedRadius;
      if (clearStart >= clampedRadius) continue;

      for (let localX = clearStart; localX < clampedRadius; localX++) {
        const x = cornerStartX + localX;
        const i = (y * width + x) * 4;
        output[i] = 0;
        output[i + 1] = 0;
        output[i + 2] = 0;
        output[i + 3] = 0;
      }
    }
  }

  return new ImageData(output, width, height);
}
