export async function imageDataToBlob(
  imageData: ImageData,
  type: string = "image/png",
  quality?: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      type,
      quality,
    );
  });
}

export function createObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}

export async function imageDataToObjectURL(
  imageData: ImageData,
  type?: string,
  quality?: number,
): Promise<string> {
  const blob = await imageDataToBlob(imageData, type, quality);
  return createObjectURL(blob);
}
