import { cva } from "class-variance-authority";
import { useState } from "react";

export const buttonOption = cva(
  "transition-all duration-300",
  {
    variants: {
      variant: {
        default: "invert-100 dark:invert-0",
        picked: "invert-0 dark:invert-100",
      },
    },
  },
);

export interface OptionsType {
  boundaries: "none" | "cut" | "clean" | "clear";
};

export interface OptionsProps {
  name: string;
  id: Exclude<OptionsType["boundaries"], "none">;
  image: {
    src: string;
    attributes: React.ImgHTMLAttributes<HTMLImageElement>;
  }
}

export default function Options({ options: args }: { options: OptionsProps[] }) {
  const [options, setOptions] = useState<OptionsType>({ boundaries: "none" });

  return (
    <main className="border-foreground/10 border-x px-4 mx-auto max-w-4xl relative">
      <h2 className="font-medium text-sm absolute top-2 right-2 opacity-50">unfinished ui/ux</h2>
      <section className="flex flex-col w-full tracking-tighter pt-8 pb-4 px-4 items-start gap-4">
        <h2 className="font-semibold text-4xl">Boundaries</h2>
        <div className="grid grid-cols-3 gap-4">
          {args.map((opt, idx) => (
            <button
              key={opt.id}
              type="button"
              className={buttonOption({
                variant: options.boundaries === opt.id ? "picked" : "default",
              })}
              onClick={() => setOptions((oldOption) => ({ ...oldOption, boundaries: opt.id }))}
            >
              <img
                src={opt.image.src}
                {...opt.image.attributes}
                alt="Optimized Carousel Asset"
              />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
