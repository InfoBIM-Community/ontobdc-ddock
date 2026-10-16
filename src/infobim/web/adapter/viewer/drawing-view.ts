import { Color } from 'three';
import { DxfViewer } from 'dxf-viewer';
import robotoLatin from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import robotoLatinExt from '@fontsource/roboto/files/roboto-latin-ext-400-normal.woff?url';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';

export type DrawingLayer = { name: string; displayName: string; color: string };

/** One DXF drawing in a 2D view. */
export type DrawingView = {
  layers: DrawingLayer[];
  showLayer(name: string, show: boolean): void;
  dispose(): void;
};

/** Fonts for drawing texts, served by the app (Roboto, OFL); tried in order per glyph. */
const FONTS = [robotoLatin, robotoLatinExt];

/**
 * Draws a DXF drawing in `container` with dxf-viewer, which also pans (drag)
 * and zooms (wheel). Parsing runs in a Web Worker (dxf-worker.ts). This module
 * is loaded on demand, the first time a drawing opens. Each view holds a
 * WebGL context, which browsers limit (about 16 per page).
 */
export async function createDrawingView(container: HTMLElement, file: Blob): Promise<DrawingView> {
  const clearColor = new Color(getTheme() === 'light' ? '#f5f5f5' : '#1e1e1e');
  // dxf-viewer's own auto-resize would also follow the container down to 0×0 while the tab is hidden,
  // and scaling the camera by 0 ruins the view for good. So the size is followed here, ignoring 0.
  const viewer = new DxfViewer(container, {
    autoResize: false,
    canvasWidth: container.clientWidth || 1,
    canvasHeight: container.clientHeight || 1,
    clearColor,
    colorCorrection: true,
  });
  const canvas = container.querySelector('canvas');
  if (canvas) canvas.style.display = 'block';
  const resizeObserver = new ResizeObserver(() => {
    const width = Math.floor(container.clientWidth);
    const height = Math.floor(container.clientHeight);
    if (width === 0 || height === 0) return;
    // The canvas content may be lost while the tab was detached, so it is drawn again even at the same size.
    viewer.SetSize(width, height);
  });
  resizeObserver.observe(container);
  const url = URL.createObjectURL(file);
  try {
    await viewer.Load({
      url,
      fonts: FONTS,
      workerFactory: () => new Worker(new URL('./dxf-worker.ts', import.meta.url), { type: 'module' }),
    });
  } catch (error) {
    resizeObserver.disconnect();
    viewer.Destroy();
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }

  const unsubscribeTheme = onThemeChange((theme) => {
    viewer.SetClearColor(new Color(theme === 'light' ? '#f5f5f5' : '#1e1e1e'));
  });

  return {
    layers: [...viewer.GetLayers(true)].map((info) => ({
      name: info.name,
      displayName: info.displayName,
      color: `#${new Color(info.color).getHexString()}`,
    })),
    showLayer: (name, show) => viewer.ShowLayer(name, show),
    dispose: () => {
      unsubscribeTheme();
      resizeObserver.disconnect();
      viewer.Destroy();
    },
  };
}
