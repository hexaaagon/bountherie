declare module "gifsicle-wasm-browser" {
  interface GifsicleInput {
    file: File | Blob | ArrayBuffer | string;
    name: string;
  }

  interface RunOptions {
    input: GifsicleInput[];
    command: string[];
    folder?: string[];
    isStrict?: boolean;
  }

  const gifsicle: {
    run(options: RunOptions): Promise<File[]>;
    tool: {
      workerLocalUrl: string;
      workerBlobUrl: string;
      worker(): Worker;
      errorLink(): void;
      testType(...args: unknown[]): unknown;
      textToUrl(text: string): string;
      loadCommand(command: string[]): void;
      loadOne(file: File | Blob | ArrayBuffer | string, name: string): void;
      loadFile(file: File | Blob | string): void;
      loadFolder(folder: string[]): void;
      run(): Promise<{ file: Uint8Array; name: string }[]>;
    };
  };

  export default gifsicle;
}
