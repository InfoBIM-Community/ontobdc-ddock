/** Converts a HEIC or HEIF file into a PNG in a Web Worker; the worker lives only as long as the conversion. */
export async function convertHeicToPng(file: Blob): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const worker = new Worker(new URL('./heic-worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<Blob>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<{ png?: Blob; error?: string }>) => {
        if (data.png) resolve(data.png);
        else reject(new Error(data.error ?? 'The HEIC worker returned nothing.'));
      };
      worker.onerror = (event) => reject(new Error(event.message || 'The HEIC worker failed.'));
      worker.postMessage({ bytes }, [bytes]);
    });
  } finally {
    worker.terminate();
  }
}
