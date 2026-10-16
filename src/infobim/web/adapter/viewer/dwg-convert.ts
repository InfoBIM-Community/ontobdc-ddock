/** Converts a DWG file into DXF text bytes in a Web Worker; the worker lives only as long as the conversion. */
export async function convertDwgToDxf(file: Blob): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const worker = new Worker(new URL('./dwg-worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<Blob>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<{ dxf?: Uint8Array; error?: string }>) => {
        if (data.dxf) resolve(new Blob([data.dxf as BlobPart], { type: 'application/dxf' }));
        else reject(new Error(data.error ?? 'The DWG worker returned nothing.'));
      };
      worker.onerror = (event) => reject(new Error(event.message || 'The DWG worker failed.'));
      worker.postMessage({ bytes }, [bytes]);
    });
  } finally {
    worker.terminate();
  }
}
