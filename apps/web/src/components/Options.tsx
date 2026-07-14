import { useEffect, useRef, useState } from "react";
import { PlusSeparator } from "./ui/plus-separator";
import { Card } from "./ui/card";
import { CloudArrowDown, Upload, X } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Loader2 } from "lucide-react";
import {
  fileToImageData,
  imageDataToObjectURL,
  revokeObjectURL,
  cutImage,
  cleanImage,
  clearImage,
  resizeImage,
  GifProcessor,
  GifProgressEvent,
} from "@bountherie/engine";
import type { ProcessOptions } from "@bountherie/engine";

export const buttonOption = (
  base: string,
  opts?: { variant: "default" | "picked" },
) =>
  `transition-all duration-300 ${opts?.variant === "picked" ? "invert-100" : "invert-0 hover:invert-[10%]"}`;

export type OptionsType =
  | { boundaries: "none" }
  | { boundaries: "cut"; options?: ProcessOptions }
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

export default function Options({ options: args }: { options: OptionsProps[] }) {
  const [options, setOptions] = useState<OptionsType>({ boundaries: "none" });
  const [file, setFile] = useState<{
    id: string;
    name: string;
    originalUrl: string;
    resultUrl: string | null;
    mime: string;
    file: File;
  } | null>(null);
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

    const raw = await fileToImageData(f);
    const resized = resizeImage(raw, { maxWidth: 1024 });
    cachedData.current = resized;

    const originalUrl = URL.createObjectURL(f);
    setFile({ id: crypto.randomUUID(), name: f.name, file: f, originalUrl, resultUrl: null, mime: f.type });
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
      if (file.resultUrl) revokeObjectURL(file.resultUrl);
    }
    cachedData.current = null;
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
        const processor = gifProcessorRef.current!;
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

    const a = document.createElement("a");
    a.href = file.resultUrl;
    a.download = file.name.replace(/(\.\w+)$/, "-processed$1");
    a.click();
  };

  const src = file?.resultUrl ?? file?.originalUrl;

  return (
    <main className="border-foreground/10 border-x px-12 pt-8 pb-4 mx-auto max-w-4xl relative flex flex-col gap-8">
      <h2 className="font-medium text-sm absolute top-2 right-2 opacity-50">unfinished ui/ux</h2>
      <section className="flex flex-col w-full tracking-[-0.04em] items-start gap-4">
        <h2 className="font-medium text-4xl underline">Boundaries</h2>
        <div className="grid grid-cols-3 gap-4">
          {args.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={buttonOption("", {
                variant: options.boundaries === opt.id ? "picked" : "default",
              })}
              onClick={() =>
                setOptions((oldOption) => ({ ...oldOption, boundaries: opt.id }))
              }
            >
              <img
                src={opt.image.src}
                {...opt.image.attributes}
                alt="Optimized Carousel Asset"
              />
            </button>
          ))}
        </div>
        <PlusSeparator position={["bottom-left", "bottom-right"]} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-4xl underline">Upload Photo</h2>
        {file ? (
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <div className="relative rounded-lg border bg-muted overflow-hidden flex items-center justify-center max-h-[500px]">
                <img
                  src={src}
                  alt={file.name}
                  className="max-w-full max-h-[500px] object-contain"
                />
                {file.resultUrl && (
                  <span className="absolute top-2 left-2 bg-background/80 text-xs px-2 py-1 rounded font-mono">
                    processed
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-7 rounded-full bg-background/80 hover:bg-background"
                onClick={removeFile}
                aria-label="Remove"
              >
                <X className="size-4" />
              </Button>
            </div>

            {processing && (
              <div className="flex items-center gap-3">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <Progress value={progress} className="h-2" />
                  <span className="text-xs text-muted-foreground truncate">{statusText || `${progress}%`}</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground shrink-0">{progress}%</span>
              </div>
            )}

            <div className="flex gap-3">
              {options.boundaries !== "none" && (
                <Button onClick={processFile} disabled={processing} className="flex-1">
                  {processing ? "Processing..." : file.resultUrl ? "Reprocess" : "Process"}
                </Button>
              )}
              <Button variant="outline" onClick={downloadFile} className="flex-1">
                <CloudArrowDown className="size-4 mr-1.5" />
                Download
              </Button>
            </div>
          </div>
        ) : (
          <Card
            className="group flex max-h-[200px] w-full flex-col items-center justify-center gap-4 py-8 border-dashed text-sm shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
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
                    className="text-primary p-0 h-auto font-normal"
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
            <span className="text-base/6 text-muted-foreground group-disabled:opacity-50 mt-2 block sm:text-xs">
              Supported: JPG, PNG, GIF (max 10 MB, resized to 1024px)
            </span>
          </Card>
        )}
      </section>
    </main>
  );
}
