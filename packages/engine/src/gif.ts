import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

import gifsicle from "gifsicle-wasm-browser";
import { GifReader } from "omggif";
import { resizeImage } from "./resize.ts";

function tick() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

function hasAlpha(data: Uint8ClampedArray, threshold = 127): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) <= threshold) return true;
  }
  return false;
}

function collectOpaquePixels(data: Uint8ClampedArray, alphaThreshold = 127): Uint8Array {
  const pixelCount = Math.floor(data.length / 4);
  let kept = 0;
  for (let i = 0; i < pixelCount; i++) {
    if ((data[i * 4 + 3] ?? 0) > alphaThreshold) kept++;
  }

  if (kept === pixelCount) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  const out = new Uint8Array(kept * 4);
  let offset = 0;
  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4;
    if ((data[si + 3] ?? 0) <= alphaThreshold) continue;
    out[offset] = data[si] ?? 0;
    out[offset + 1] = data[si + 1] ?? 0;
    out[offset + 2] = data[si + 2] ?? 0;
    out[offset + 3] = 255;
    offset += 4;
  }
  return out;
}

function getBackgroundColor(buf: Uint8Array): [number, number, number] {
  const bgIndex = buf[11] ?? 0;
  const packed = buf[10] ?? 0;
  const gctFlag = (packed >> 7) & 1;
  if (!gctFlag) return [0, 0, 0];
  const gctSize = 1 << ((packed & 0x07) + 1);
  const gctOffset = 13;
  if (bgIndex >= gctSize) return [0, 0, 0];
  return [
    buf[gctOffset + bgIndex * 3] ?? 0,
    buf[gctOffset + bgIndex * 3 + 1] ?? 0,
    buf[gctOffset + bgIndex * 3 + 2] ?? 0,
  ];
}

function fillRect(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
): void {
  const x1 = Math.max(0, x);
  const y1 = Math.max(0, y);
  const x2 = Math.min(width, x + w);
  const y2 = Math.min(height, y + h);
  for (let row = y1; row < y2; row++) {
    let off = (row * width + x1) * 4;
    const end = (row * width + x2) * 4;
    while (off < end) {
      pixels[off] = color[0];
      pixels[off + 1] = color[1];
      pixels[off + 2] = color[2];
      pixels[off + 3] = 255;
      off += 4;
    }
  }
}

function saveRegion(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8ClampedArray {
  const saved = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcRow = y + row;
    if (srcRow < 0) continue;
    const srcStart = (srcRow * width + x) * 4;
    if (srcStart < 0 || srcStart >= pixels.length) continue;
    const len = Math.min(w * 4, pixels.length - srcStart);
    saved.set(pixels.subarray(srcStart, srcStart + len), row * w * 4);
  }
  return saved;
}

function restoreRegion(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  saved: Uint8ClampedArray,
  w: number,
  h: number,
): void {
  for (let row = 0; row < h; row++) {
    const dstRow = y + row;
    if (dstRow < 0) continue;
    const dstStart = (dstRow * width + x) * 4;
    if (dstStart < 0 || dstStart >= pixels.length) continue;
    const len = Math.min(w * 4, pixels.length - dstStart);
    pixels.set(saved.subarray(row * w * 4, row * w * 4 + len), dstStart);
  }
}

function analyzeTransparency(data: Uint8ClampedArray): {
  usesTransparency: boolean;
  transparentIndex: number;
} {
  const usesTransparency = hasAlpha(data);
  return { usesTransparency, transparentIndex: usesTransparency ? 0 : -1 };
}

function buildPalette(
  data: Uint8ClampedArray,
  usesTransparency: boolean,
  maxColorsOverride?: number,
): number[][] {
  const maxColors = maxColorsOverride ?? (usesTransparency ? 255 : 256);
  if (usesTransparency) {
    const opaqueSample = collectOpaquePixels(data);
    const opaquePalette =
      opaqueSample.length > 0
        ? quantize(opaqueSample, maxColors, { format: "rgb565" })
        : [[0, 0, 0]];
    return [[0, 0, 0], ...opaquePalette];
  }
  return quantize(data, maxColors, { format: "rgb565" });
}

function applyPaletteWithTransparency(
  data: Uint8ClampedArray,
  palette: number[][],
  transparentIndex: number,
): Uint8Array {
  if (transparentIndex >= 0) {
    const opaqueIndex = applyPalette(data, palette.slice(1), "rgb565");
    const index = new Uint8Array(opaqueIndex.length);
    for (let pi = 0; pi < opaqueIndex.length; pi++) {
      index[pi] = (data[pi * 4 + 3] ?? 0) <= 127 ? transparentIndex : (opaqueIndex[pi] ?? 0) + 1;
    }
    return index;
  }
  return applyPalette(data, palette, "rgb565");
}

function encodeGifFrame(
  gif: ReturnType<typeof GIFEncoder>,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  delay: number,
  isFirst: boolean,
  palette: number[][],
  transparentIndex: number,
): void {
  const index = applyPaletteWithTransparency(data, palette, transparentIndex);

  gif.writeFrame(index, width, height, {
    palette: isFirst ? palette : undefined,
    delay,
    repeat: isFirst ? 0 : undefined,
    transparent: transparentIndex >= 0,
    transparentIndex: transparentIndex === -1 ? 0 : transparentIndex,
    dispose: 2,
  });
}

export async function imageDataToGifBlob(imageData: ImageData): Promise<Blob> {
  const { width, height, data } = imageData;
  const { usesTransparency, transparentIndex } = analyzeTransparency(data);
  const palette = buildPalette(data, usesTransparency);
  const gif = GIFEncoder();
  encodeGifFrame(gif, data, width, height, 100, true, palette, transparentIndex);
  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
}

export class GifProgressEvent extends Event {
  constructor(
    public readonly current: number,
    public readonly total: number,
    public readonly phase: string,
  ) {
    super("progress");
  }
}

export class GifProcessor extends EventTarget {
  private _debug = false;
  private _log: (...args: unknown[]) => void = () => {};

  async processAnimatedGif(
    file: File,
    processor: (data: ImageData) => ImageData,
    debug?: boolean,
  ): Promise<Blob> {
    this._debug = debug ?? false;
    this._log = this._debug ? (...args: unknown[]) => console.log("[gif]", ...args) : () => {};

    this._log("Reading file:", file.name, file.size);
    const buf = await file.arrayBuffer();
    const raw = new Uint8Array(buf);
    const reader = new GifReader(raw);
    const { width, height } = reader;
    const totalFrames = reader.numFrames();
    const totalSteps = totalFrames * 2 + 1;
    const bgColor = getBackgroundColor(raw);

    this._log(`GIF: ${width}x${height}, ${totalFrames} frames, bg=${bgColor.join(",")}`);

    const accumulator = new Uint8ClampedArray(width * height * 4);
    const savedRegions: (Uint8ClampedArray | null)[] = [];
    const frames: { data: ImageData; delay: number }[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const info = reader.frameInfo(i);
      this._log(
        `Frame ${i + 1}/${totalFrames}: ${info.width}x${info.height} at (${info.x},${info.y}), delay=${info.delay}cs, disposal=${info.disposal}`,
      );

      if (i > 0) {
        const prev = reader.frameInfo(i - 1);
        if (prev.disposal === 2) {
          fillRect(accumulator, width, height, prev.x, prev.y, prev.width, prev.height, bgColor);
        } else if (prev.disposal === 3) {
          const saved = savedRegions[i - 1];
          if (saved) {
            restoreRegion(accumulator, width, prev.x, prev.y, saved, prev.width, prev.height);
          }
        }
      }

      if (info.disposal === 3) {
        savedRegions[i] = saveRegion(accumulator, width, info.x, info.y, info.width, info.height);
      } else {
        savedRegions[i] = null;
      }

      reader.decodeAndBlitFrameRGBA(i, accumulator);

      const composited = new ImageData(new Uint8ClampedArray(accumulator), width, height);
      const resized = resizeImage(composited, { maxWidth: 1024 });
      const processed = processor(resized);
      frames.push({ data: processed, delay: Math.max(1, info.delay) });

      this._emitProgress(i + 1, totalSteps, "Decoding frames");
      if ((i + 1) % 5 === 0) await tick();
    }

    this._log(`All ${totalFrames} frames decoded, encoding...`);

    const firstFrame = frames[0];
    if (!firstFrame) throw new Error("No frames decoded");
    const { usesTransparency, transparentIndex } = analyzeTransparency(firstFrame.data.data);
    const palette = buildPalette(firstFrame.data.data, usesTransparency);

    const gif = GIFEncoder();

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame) continue;
      encodeGifFrame(
        gif,
        frame.data.data,
        frame.data.width,
        frame.data.height,
        frame.delay,
        i === 0,
        palette,
        transparentIndex,
      );
      this._emitProgress(totalFrames + i + 1, totalSteps, "Encoding GIF");
    }

    gif.finish();
    let blob = new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
    this._log(`Encoded size: ${blob.size} bytes`);

    this._emitProgress(totalSteps, totalSteps, "Compressing GIF");
    await tick();

    const maxFileSize = 10 * 1024 * 1024;
    const originalBuf = await blob.arrayBuffer();
    let bestBlob = blob;
    let bestSize = blob.size;

    const configs: { lossy: number; colors: number; scale?: number }[] = [
      { lossy: 40, colors: 256 },
      { lossy: 100, colors: 128 },
      { lossy: 200, colors: 64, scale: 0.8 },
      { lossy: 200, colors: 32, scale: 0.6 },
    ];

    for (const cfg of configs) {
      const scaleArg = cfg.scale ? ` --scale ${cfg.scale}` : "";
      const cmd = `-O1 --lossy=${cfg.lossy} --colors ${cfg.colors}${scaleArg} gif.gif -o /out/out.gif`;
      try {
        const result = await gifsicle.run({
          input: [{ file: originalBuf, name: "gif.gif" }],
          command: [cmd],
        });
        const candidate = result[0] as Blob;
        this._log(
          `Compressed size: ${candidate.size} bytes (lossy=${cfg.lossy}, colors=${cfg.colors}${cfg.scale ? `, scale=${cfg.scale}` : ""})`,
        );
        if (candidate.size < bestSize) {
          bestSize = candidate.size;
          bestBlob = candidate;
        }
        if (candidate.size <= maxFileSize) break;
      } catch (err) {
        this._log("gifsicle attempt failed:", err);
      }
    }

    blob = bestBlob;

    this.dispatchEvent(new Event("done"));
    return blob;
  }

  private _emitProgress(current: number, total: number, phase: string) {
    this.dispatchEvent(new GifProgressEvent(current, total, phase));
  }
}

export async function processAnimatedGif(
  file: File,
  processor: (data: ImageData) => ImageData,
  onProgress?: (current: number, total: number, phase?: string) => void,
  debug?: boolean,
): Promise<Blob> {
  const log = debug ? (...args: unknown[]) => console.log("[gif]", ...args) : () => {};

  log("Reading file:", file.name, file.size);
  const buf = await file.arrayBuffer();
  const raw = new Uint8Array(buf);
  const reader = new GifReader(raw);
  const { width, height } = reader;
  const totalFrames = reader.numFrames();
  const totalSteps = totalFrames * 2 + 1;
  const bgColor = getBackgroundColor(raw);

  log(`GIF: ${width}x${height}, ${totalFrames} frames, bg=${bgColor.join(",")}`);

  const accumulator = new Uint8ClampedArray(width * height * 4);
  const savedRegions: (Uint8ClampedArray | null)[] = [];
  const frames: { data: ImageData; delay: number }[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const info = reader.frameInfo(i);
    log(
      `Frame ${i + 1}/${totalFrames}: ${info.width}x${info.height} at (${info.x},${info.y}), delay=${info.delay}cs, disposal=${info.disposal}`,
    );

    if (i > 0) {
      const prev = reader.frameInfo(i - 1);
      if (prev.disposal === 2) {
        fillRect(accumulator, width, height, prev.x, prev.y, prev.width, prev.height, bgColor);
      } else if (prev.disposal === 3) {
        const saved = savedRegions[i - 1];
        if (saved) {
          restoreRegion(accumulator, width, prev.x, prev.y, saved, prev.width, prev.height);
        }
      }
    }

    if (info.disposal === 3) {
      savedRegions[i] = saveRegion(accumulator, width, info.x, info.y, info.width, info.height);
    } else {
      savedRegions[i] = null;
    }

    reader.decodeAndBlitFrameRGBA(i, accumulator);

    const composited = new ImageData(new Uint8ClampedArray(accumulator), width, height);
    const resized = resizeImage(composited, { maxWidth: 1024 });
    const processed = processor(resized);
    frames.push({ data: processed, delay: Math.max(1, info.delay) });

    onProgress?.(i + 1, totalSteps, "Decoding frames");
  }

  log(`All ${totalFrames} frames decoded, encoding...`);

  const firstFrame = frames[0];
  if (!firstFrame) throw new Error("No frames decoded");
  const { usesTransparency, transparentIndex } = analyzeTransparency(firstFrame.data.data);
  const palette = buildPalette(firstFrame.data.data, usesTransparency);

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame) continue;
    encodeGifFrame(
      gif,
      frame.data.data,
      frame.data.width,
      frame.data.height,
      frame.delay,
      i === 0,
      palette,
      transparentIndex,
    );
    onProgress?.(totalFrames + i + 1, totalSteps, "Encoding GIF");
  }

  gif.finish();
  let blob = new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
  log(`Encoded size: ${blob.size} bytes`);

  onProgress?.(totalSteps, totalSteps, "Compressing GIF");

  const maxFileSize = 10 * 1024 * 1024;
  const originalBuf = await blob.arrayBuffer();
  let bestBlob = blob;
  let bestSize = blob.size;

  const configs: { lossy: number; colors: number; scale?: number }[] = [
    { lossy: 40, colors: 256 },
    { lossy: 100, colors: 128 },
    { lossy: 200, colors: 64, scale: 0.8 },
    { lossy: 200, colors: 32, scale: 0.6 },
  ];

  for (const cfg of configs) {
    const scaleArg = cfg.scale ? ` --scale ${cfg.scale}` : "";
    const cmd = `-O1 --lossy=${cfg.lossy} --colors ${cfg.colors}${scaleArg} gif.gif -o /out/out.gif`;
    try {
      const result = await gifsicle.run({
        input: [{ file: originalBuf, name: "gif.gif" }],
        command: [cmd],
      });
      const candidate = result[0] as Blob;
      log(
        `Compressed size: ${candidate.size} bytes (lossy=${cfg.lossy}, colors=${cfg.colors}${cfg.scale ? `, scale=${cfg.scale}` : ""})`,
      );
      if (candidate.size < bestSize) {
        bestSize = candidate.size;
        bestBlob = candidate;
      }
      if (candidate.size <= maxFileSize) break;
    } catch (err) {
      log("gifsicle attempt failed:", err);
    }
  }

  blob = bestBlob;

  return blob;
}
