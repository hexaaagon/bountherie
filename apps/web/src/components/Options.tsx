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
import { ArrowClockwise, CaretDown, CloudArrowDown, Crop, Moon, Sun, Upload, X } from "@phosphor-icons/react";
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
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
  const [bgTheme, setBgTheme] = useState<"light" | "dark">("light");
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cachedData = useRef<ImageData | null>(null);
  const gifProcessorRef = useRef<GifProcessor | null>(null);

  useEffect(() => {
    if (!file) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [file]);

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

  const processFileRef = useRef(processFile);
  useEffect(() => {
    processFileRef.current = processFile;
  }, [processFile]);

  useEffect(() => {
    if (!file || options.boundaries === "none") return;
    if (!file.resultUrl) return; // Only auto-process on options change if already processed

    const timeoutId = setTimeout(
      () => {
        processFileRef.current();
      },
      file.mime === "image/gif" ? 500 : 50,
    );

    return () => clearTimeout(timeoutId);
  }, [options]);

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

    if (!isInitialCrop) {
      setTimeout(() => {
        processFileRef.current();
      }, 50);
    }

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
          <input
            ref={filePickerRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/gif"
            onChange={onFileInputChange}
          />
          <section className="flex flex-col gap-4">
            {file ? (
              <div className="flex flex-col gap-4">
                {!file.resultUrl ? (
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-lg"
                    onClick={openFilePicker}
                    onDragOver={onDragOver}
                    onDrop={onDropFiles}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBgTheme((prev) => (prev === "light" ? "dark" : "light"));
                      }}
                      className="absolute right-2 top-2 z-20 rounded-md bg-black/20 p-2 text-white transition-colors hover:bg-black/40"
                    >
                      {bgTheme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <div
                      className="relative flex max-h-[500px] items-center justify-center"
                      style={{
                        backgroundImage: bgTheme === "light"
                          ? `conic-gradient(#e5e7eb 25%, #f9fafb 25% 50%, #e5e7eb 50% 75%, #f9fafb 75%)`
                          : `conic-gradient(#374151 25%, #1f2937 25% 50%, #374151 50% 75%, #1f2937 75%)`,
                        backgroundSize: `16px 16px`,
                      }}
                    >
                      <img
                        src={src}
                        alt={file.name}
                        className="max-h-[500px] max-w-full object-contain"
                      />
                    </div>
                    {/* Hover overlay acting as upload box */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <Upload className="mb-2 size-8 text-white/80" />
                      <span className="font-medium text-white">Click or drag to replace image</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-lg">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBgTheme((prev) => (prev === "light" ? "dark" : "light"));
                      }}
                      className="absolute right-2 top-2 z-20 rounded-md bg-black/20 p-2 text-white transition-colors hover:bg-black/40"
                    >
                      {bgTheme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <div
                      className="relative flex max-h-[500px] items-center justify-center"
                      style={{
                        backgroundImage: bgTheme === "light"
                          ? `conic-gradient(#e5e7eb 25%, #f9fafb 25% 50%, #e5e7eb 50% 75%, #f9fafb 75%)`
                          : `conic-gradient(#374151 25%, #080b0f 25% 50%, #080b0f 50% 75%, #080b0f 75%)`,
                        backgroundSize: `16px 16px`,
                      }}
                    >
                      <img
                        src={src}
                        alt={file.name}
                        className="max-h-[500px] max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}

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

                <div className="flex flex-col gap-3">
                  {!file.resultUrl ? (
                    <>
                      <Button onClick={processFile} disabled={processing} className="w-full">
                        {processing ? "Processing..." : "Process"}
                      </Button>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setIsInitialCrop(false);
                            setCropDialogOpen(true);
                          }}
                          className="flex-1"
                          disabled={processing}
                        >
                          <Crop className="mr-1.5 size-4" />
                          Crop Image
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setCancelDialogOpen(true)}
                          className="flex-1"
                          disabled={processing}
                        >
                          <X className="mr-1.5 size-4" />
                          Delete Progress
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setIsInitialCrop(false);
                            setCropDialogOpen(true);
                          }}
                          className="flex-1"
                          disabled={processing}
                        >
                          <Crop className="mr-1.5 size-4" />
                          Recrop Image
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setFile((prev) => (prev ? { ...prev, resultUrl: null } : prev))
                          }
                          className="flex-1 text-destructive hover:bg-destructive/10 border-destructive/20"
                          disabled={processing}
                        >
                          <X className="mr-1.5 size-4" />
                          Cancel
                        </Button>
                      </div>
                      <Button onClick={downloadFile} disabled={processing} className="w-full">
                        <CloudArrowDown className="mr-1.5 size-4" />
                        {processing ? "Processing..." : "Download"}
                      </Button>
                    </>
                  )}
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

      {cancelDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <Card className="flex w-full max-w-md flex-col gap-4 p-6">
            <h3 className="font-semibold text-lg">Are you sure?</h3>
            <p className="text-muted-foreground text-sm">
              This will remove the current image and discard any unsaved changes.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  removeFile();
                  setCancelDialogOpen(false);
                }}
              >
                Yes, Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
