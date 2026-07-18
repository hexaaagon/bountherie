import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/load.ts",
    "src/process.ts",
    "src/export.ts",
    "src/widget.ts",
    "src/resize.ts",
    "src/gif.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
});
