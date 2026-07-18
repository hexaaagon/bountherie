import type { ProcessOptions, WidgetOptions } from "@bountherie/engine";
import {
  calculateRadius,
  calculateTopStrip,
  cleanImage,
  clearImage,
  cutImage,
  fileToImageData,
  GifProcessor,
  type GifProgressEvent,
  imageDataToObjectURL,
  revokeObjectURL,
} from "@bountherie/engine";
import { ArrowClockwise, CaretDown, CloudArrowDown, Crop, Upload, X } from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { PlusSeparator } from "./ui/plus-separator";
import { Progress } from "./ui/progress";

const buttonOption = (_base: string, opts?: { variant: "default" | "picked" }) =>
  `transition-all duration-300 ${opts?.variant === "picked" ? "invert-100" : "invert-0 hover:invert-[10%]"}`;

export type OptionsType =
  | { boundaries: "none" }
  | { boundaries: "cut"; options?: ProcessOptions & WidgetOptions }
  | { boundaries: "clean"; options?: ProcessOptions }
  | { boundaries: "clear"; options?: ProcessOptions };

export interface OptionsProps {
  name: string;
  id: Exclude<OptionsType["boundaries"], "none">;
  image: {
    src: string;
    attributes: React.ImgHTMLAttributes<HTMLImageElement>;
  };
}

const PROCESSORS: Record<string, (data: ImageData, opts?: ProcessOptions) => ImageData> = {
  cut: cutImage,
  clean: cleanImage,
  clear: clearImage,
};

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob ?? new Blob()));
    }, "image/png");
  });
}

export default function Options({ options: args }: { options: OptionsProps[] }) {
  const [options, setOptions] = useState<OptionsType>({ boundaries: "none" });
  const [file, setFile] = useState<{
    id: string;
    name: string;
    originalUrl: string;
    previewUrl: string;
    resultUrl: string | null;
    mime: string;
    file: File;
  } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [defaults, setDefaults] = useState({ topStrip: 17, radius: 36 });
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [aspect, setAspect] = useState<number>(13 / 12);
  const [isInitialCrop, setIsInitialCrop] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cachedData = useRef<ImageData | null>(null);
  const gifProcessorRef = useRef<GifProcessor | null>(null);

  useEffect(() => {
    const processor = new GifProcessor();
    gifProcessorRef.current = processor;

    const onProgress = (e: Event) => {
      const evt = e as GifProgressEvent;
      const pct = evt.total > 0 ? Math.round((evt.current / evt.total) * 100) : 0;
      setProgress(pct);
      if (evt.phase) setStatusText(evt.phase);
    };

    processor.addEventListener("progress", onProgress);

    return () => {
      processor.removeEventListener("progress", onProgress);
    };
  }, []);

  const openFilePicker = () => {
    filePickerRef.current?.click();
  };

  const addFile = async (f: File) => {
    if (file) {
      revokeObjectURL(file.originalUrl);
      if (file.resultUrl) revokeObjectURL(file.resultUrl);
    }
    cachedData.current = null;

    const W = 1300;
    const H = 1200;

    const raw = await fileToImageData(f);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");

    const scale = Math.min(W / raw.width, H / raw.height);
    const sw = Math.round(raw.width * scale);
    const sh = Math.round(raw.height * scale);
    const dx = Math.round((W - sw) / 2);
    const dy = Math.round((H - sh) / 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = raw.width;
    srcCanvas.height = raw.height;
    srcCanvas.getContext("2d")?.putImageData(raw, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(srcCanvas, 0, 0, raw.width, raw.height, dx, dy, sw, sh);

    const resized = ctx.getImageData(0, 0, W, H);
    cachedData.current = resized;
    setDefaults({
      topStrip: calculateTopStrip(W, H),
      radius: calculateRadius(W, H),
    });

    const originalUrl = URL.createObjectURL(f);
    const previewUrl = URL.createObjectURL(f);
    setFile({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      originalUrl,
      previewUrl,
      resultUrl: null,
      mime: f.type,
    });
    setIsInitialCrop(true);
    setCropDialogOpen(true);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0];
    if (f) addFile(f);
    event.target.value = "";
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const onDropFiles = (event: React.DragEvent) => {
    event.preventDefault();
    const f = event.dataTransfer.files?.[0];
    if (f) addFile(f);
  };

  const removeFile = () => {
    if (file) {
      revokeObjectURL(file.originalUrl);
      revokeObjectURL(file.previewUrl);
      if (file.resultUrl) revokeObjectURL(file.resultUrl);
    }
    cachedData.current = null;
    setDefaults({ topStrip: 17, radius: 36 });
    setFile(null);
    setProgress(0);
  };

  const processFile = async () => {
    if (options.boundaries === "none" || !file) return;

    setProcessing(true);
    setProgress(0);

    const imgOptions = "options" in options ? options.options : undefined;
    const fn = PROCESSORS[options.boundaries];

    try {
      if (file.mime === "image/gif") {
        console.log("[process] Starting animated GIF processing...");
        const processor = gifProcessorRef.current;
        if (!processor) return;
        const blob = await processor.processAnimatedGif(
          file.file,
          (data) => fn(data, imgOptions),
          true,
        );
        const url = URL.createObjectURL(blob);
        if (file.resultUrl) revokeObjectURL(file.resultUrl);
        setFile((prev) => (prev ? { ...prev, resultUrl: url } : prev));
        console.log("[process] GIF done, blob size:", blob.size);
      } else if (cachedData.current) {
        const processed = fn(cachedData.current, imgOptions);
        const url = await imageDataToObjectURL(processed);
        if (file.resultUrl) revokeObjectURL(file.resultUrl);
        setFile((prev) => (prev ? { ...prev, resultUrl: url } : prev));
      }
    } catch (err) {
      console.error("[process] Error:", err);
      alert(`Processing failed: ${err instanceof Error ? err.message : err}`);
    }

    setProgress(100);
    setProcessing(false);
  };

  const downloadFile = () => {
    if (!file) return;

    if (!file.resultUrl) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file.file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }

    const ext = file.mime === "image/gif" ? ".gif" : ".png";
    const a = document.createElement("a");
    a.href = file.resultUrl;
    a.download = `${file.name.replace(/\.[^.]+$/, "")}-processed${ext}`;
    a.click();
  };

  const resetOptions = () => {
    if (options.boundaries !== "cut") return;
    setOptions({ boundaries: "cut" });
  };

  const onCropComplete = useCallback(
    (_: unknown, croppedAreaPixels: { x: number; y: number; width: number; height: number }) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const applyCrop = async () => {
    if (!file || !croppedAreaPixels) return;
    const croppedUrl = await getCroppedImg(file.originalUrl, croppedAreaPixels);
    const img = new Image();
    img.src = croppedUrl;
    await new Promise((resolve) => (img.onload = resolve));
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    cachedData.current = imageData;

    revokeObjectURL(file.previewUrl);
    if (file.resultUrl) revokeObjectURL(file.resultUrl);
    setFile((prev) => (prev ? { ...prev, previewUrl: croppedUrl, resultUrl: null } : prev));
    setIsInitialCrop(false);
    setCropDialogOpen(false);
  };

  const currentTopStrip =
    options.boundaries === "cut" ? (options.options?.topStrip ?? defaults.topStrip) : 0;
  const currentRadius =
    options.boundaries === "cut" ? (options.options?.radius ?? defaults.radius) : 0;

  const src = file?.resultUrl ?? file?.previewUrl ?? file?.originalUrl;

  return (
    <main className="relative mx-auto flex max-w-4xl flex-col gap-8 border-foreground/10 border-x px-12 pt-8 pb-4">
      <h2 className="absolute top-2 right-2 font-medium text-sm opacity-50">unfinished ui/ux</h2>
      <section className="flex w-full flex-col items-start gap-4 tracking-[-0.04em]">
        <h2 className="font-medium text-4xl underline">Boundaries</h2>
        <div className="grid grid-cols-3 gap-4">
          {args.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={buttonOption("", {
                variant: options.boundaries === opt.id ? "picked" : "default",
              })}
              onClick={() => setOptions((oldOption) => ({ ...oldOption, boundaries: opt.id }))}
            >
              <img src={opt.image.src} {...opt.image.attributes} alt="Optimized Carousel Asset" />
            </button>
          ))}
        </div>
        <PlusSeparator position={["bottom-left", "bottom-right"]} />
      </section>
      {options.boundaries === "none" ? (
        <section>
          <Card className="flex items-center justify-center py-16 text-lg text-muted-foreground">
            Choose the boundaries type
          </Card>
        </section>
      ) : options.boundaries === "cut" ? (
        <>
          <section className="flex flex-col gap-4">
            {file ? (
              <div className="flex flex-col gap-4">
                <div className="group relative">
                  <div className="relative flex max-h-[500px] items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={src}
                      alt={file.name}
                      className="max-h-[500px] max-w-full object-contain"
                    />
                    {file.resultUrl && (
                      <span className="absolute top-2 left-2 rounded bg-background/80 px-2 py-1 font-mono text-xs">
                        processed
                      </span>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full bg-background/80 hover:bg-background"
                      onClick={() => {
                        setIsInitialCrop(false);
                        setCropDialogOpen(true);
                      }}
                      aria-label="Crop"
                    >
                      <Crop className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full bg-background/80 hover:bg-background"
                      onClick={removeFile}
                      aria-label="Remove"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>

                {processing && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Progress value={progress} className="h-2" />
                      <span className="truncate text-muted-foreground text-xs">
                        {statusText || `${progress}%`}
                      </span>
                    </div>
                    <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                      {progress}%
                    </span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={processFile} disabled={processing} className="flex-1">
                    {processing ? "Processing..." : file.resultUrl ? "Reprocess" : "Process"}
                  </Button>
                  <Button variant="outline" onClick={downloadFile} className="flex-1">
                    <CloudArrowDown className="mr-1.5 size-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <Card
                className="group flex max-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-4 border-dashed py-8 text-sm shadow-none transition-colors hover:bg-muted/50"
                onDragOver={onDragOver}
                onDrop={onDropFiles}
                onClick={openFilePicker}
              >
                <div className="grid space-y-3">
                  <div className="flex items-center gap-x-2 text-muted-foreground">
                    <Upload className="size-5" />
                    <div>
                      Drop files here or{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 font-normal text-primary"
                        onClick={openFilePicker}
                      >
                        browse files
                      </Button>{" "}
                      to add
                    </div>
                  </div>
                </div>
                <input
                  ref={filePickerRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif"
                  onChange={onFileInputChange}
                />
                <span className="mt-2 block text-base/6 text-muted-foreground group-disabled:opacity-50 sm:text-xs">
                  Supported: JPG, PNG, GIF (max 10 MB, resized to 1024px)
                </span>
              </Card>
            )}
          </section>

          <Card className="relative flex flex-col">
            {!file && (
              <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-card/30 backdrop-blur-[4px]">
                <span
                  className={cn(
                    "block text-muted-foreground underline group-disabled:opacity-50",
                    advancedOpen ? "text-lg sm:text-xl" : "text-xs sm:text-sm",
                  )}
                >
                  No file selected
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex w-full items-center justify-between px-6 text-left"
            >
              <h2 className="font-medium text-lg">Advanced Options</h2>
              <CaretDown
                className={`size-5 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
              />
            </button>
            {advancedOpen && (
              <div className="flex flex-col gap-4 px-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="topstrip-range" className="font-medium text-sm">
                    Top Strip
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="topstrip-range"
                      type="range"
                      min="0"
                      max="200"
                      value={currentTopStrip}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.boundaries === "cut"
                            ? {
                                ...prev,
                                options: { ...prev.options, topStrip: Number(e.target.value) },
                              }
                            : prev,
                        )
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={currentTopStrip}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.boundaries === "cut"
                            ? {
                                ...prev,
                                options: { ...prev.options, topStrip: Number(e.target.value) },
                              }
                            : prev,
                        )
                      }
                      className="w-16 rounded-md border border-border bg-input/30 px-2 py-1 text-center text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="radius-range" className="font-medium text-sm">
                    Radius
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="radius-range"
                      type="range"
                      min="0"
                      max="200"
                      value={currentRadius}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.boundaries === "cut"
                            ? {
                                ...prev,
                                options: { ...prev.options, radius: Number(e.target.value) },
                              }
                            : prev,
                        )
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={currentRadius}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.boundaries === "cut"
                            ? {
                                ...prev,
                                options: { ...prev.options, radius: Number(e.target.value) },
                              }
                            : prev,
                        )
                      }
                      className="w-16 rounded-md border border-border bg-input/30 px-2 py-1 text-center text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetOptions} className="gap-1">
                    <ArrowClockwise className="size-3.5" />
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <section>
          <Card className="flex items-center justify-center py-16 text-lg text-muted-foreground">
            Coming soon
          </Card>
        </section>
      )}

      {cropDialogOpen && file && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col">
            <div className="relative min-h-[400px] flex-1 bg-black/10">
              <Cropper
                image={file.originalUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="shrink-0 font-medium text-sm">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="shrink-0 font-medium text-sm">Aspect</span>
                <select
                  value={aspect}
                  onChange={(e) => setAspect(Number(e.target.value))}
                  className="rounded-md border border-border bg-input/30 px-2 py-1 text-sm"
                >
                  <option value={13 / 12}>Default (Subtitle 3)</option>
                  <option value={325 / 209}>No Subtitle</option>
                  <option value={65 / 48}>Subtitle 1</option>
                  <option value={65 / 54}>Subtitle 2</option>
                  <option value={13 / 12}>Subtitle 3</option>
                  <option value={1}>1:1</option>
                  <option value={16 / 9}>16:9</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsInitialCrop(false);
                    setCropDialogOpen(false);
                  }}
                >
                  {isInitialCrop ? "Don't Crop" : "Cancel"}
                </Button>
                <Button onClick={applyCrop}>Apply Crop</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
