import { PanoramaIcon, VideoIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type OptionsType = {
  mediaType: /* "none", */ "static" | "animated";
  boundaries: "none" | "cut" | "clean";
};

export const buttonOption = cva(
  "flex flex-col justify-center items-center gap-2 py-4 w-48 border rounded-[1rem] transition",
  {
    variants: {
      variant: {
        default: "bg-accent/20",
        picked: "bg-accent-foreground border-accent/80 text-background",
      },
    },
  },
);

export default function Options() {
  const [options, setOptions] = useState<OptionsType>({ mediaType: "static", boundaries: "none" });

  return (
    <main className="border-foreground/10 border-x px-4 mx-auto max-w-4xl relative">
      <h2 className="font-medium text-sm absolute top-2 right-2 opacity-50">unfinished ui/ux</h2>
      <section className="flex flex-col w-full pt-8 pb-4 items-center gap-4">
        <h2 className="font-medium text-3xl">Boundaries</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className={buttonOption({
              variant: options.mediaType === "static" ? "picked" : "default",
            })}
            onClick={() => setOptions((opt) => ({ ...opt, mediaType: "static" }))}
          >
            <PanoramaIcon size={48} />
            <p className="text-center text-xl font-medium">Cut</p>
          </button>
          <button
            type="button"
            className={buttonOption({
              variant: options.mediaType === "animated" ? "picked" : "default",
            })}
            onClick={() => setOptions((opt) => ({ ...opt, mediaType: "animated" }))}
          >
            <VideoIcon size={48} />
            <p className="text-center text-xl font-medium">Clean</p>
          </button>
        </div>
      </section>
    </main>
  );
}
