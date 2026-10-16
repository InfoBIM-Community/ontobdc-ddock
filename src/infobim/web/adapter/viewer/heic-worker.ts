/// <reference lib="webworker" />
import { heicTo } from 'heic-to/next';

// The conversion runs here, off the UI thread: decoding a photo can take seconds.
self.onmessage = async ({ data }: MessageEvent<{ bytes: ArrayBuffer }>) => {
  try {
    const png = await heicTo({ blob: new Blob([data.bytes]), type: 'image/png' });
    self.postMessage({ png });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
