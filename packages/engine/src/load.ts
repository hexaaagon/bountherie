export async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function imageBitmapToImageData(
  bitmap: ImageBitmap,
  width?: number,
  height?: number,
): ImageData {
  const canvas = new OffscreenCanvas(width ?? bitmap.width, height ?? bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await fileToImageBitmap(file);
  return imageBitmapToImageData(bitmap);
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
