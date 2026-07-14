export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
}

export function resizeImage(
  data: ImageData,
  options?: ResizeOptions,
): ImageData {
  const maxWidth = options?.maxWidth ?? 1024;
  const maxHeight = options?.maxHeight;
  const { width, height } = data;

  if (width <= maxWidth && (!maxHeight || height <= maxHeight)) {
    return data;
  }

  let newWidth: number;
  let newHeight: number;

  if (maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    newWidth = Math.round(width * scale);
    newHeight = Math.round(height * scale);
  } else {
    const scale = Math.min(maxWidth / width, 1);
    newWidth = Math.round(width * scale);
    newHeight = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d")!;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCanvas.getContext("2d")!.putImageData(data, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

  return ctx.getImageData(0, 0, newWidth, newHeight);
}
