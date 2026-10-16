/// <reference lib="webworker" />
// The package's own loader looks its WASM up by a computed path, which bundlers
// cannot follow, so the generated glue and the .wasm file are imported directly.
import initWasm, { convertDwgToDxf } from '../../../../node_modules/dwgdxf/dist/wasm/dwgdxf.js';
import wasmUrl from '../../../../node_modules/dwgdxf/dist/wasm/dwgdxf_bg.wasm?url';

/**
 * Converts DWG files into DXF off the UI thread (acadrust compiled to
 * WebAssembly, through the dwgdxf package), so a large drawing does not
 * freeze the interface.
 */
let ready: Promise<unknown> | null = null;

self.onmessage = async ({ data }: MessageEvent<{ bytes: ArrayBuffer }>) => {
  try {
    ready ??= initWasm({ module_or_path: wasmUrl }).catch((error: unknown) => {
      ready = null; // not cached: the next file retries
      throw error;
    });
    await ready;
    const dxf = convertDwgToDxf(new Uint8Array(data.bytes));
    self.postMessage({ dxf }, [dxf.buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
