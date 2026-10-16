import { translate } from '@/infobim/shared/plugin/i18n';

/**
 * Draws a DXF drawing in `element` (dxf-viewer, loaded the first time one
 * opens), with a list of its layers to show or hide. The result releases it.
 */
export async function renderDrawing(dxf: Blob, element: HTMLElement): Promise<() => void> {
  const { createDrawingView } = await import('@/infobim/web/adapter/viewer/drawing-view');
  // dxf-viewer sets `position: relative` on its container, so it gets a host of its own inside the sized one.
  const canvas = document.createElement('div');
  canvas.className = 'dxf-canvas';
  const host = document.createElement('div');
  host.className = 'dxf-host';
  canvas.appendChild(host);
  element.appendChild(canvas);
  const view = await createDrawingView(host, dxf);

  if (view.layers.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'dxf-layers';
    const title = document.createElement('div');
    title.className = 'dxf-layers-title';
    title.textContent = translate('drawing.layers');
    const list = document.createElement('ul');
    for (const layer of view.layers) {
      const label = document.createElement('label');
      label.className = 'dxf-layer';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.layer = layer.name;
      checkbox.addEventListener('change', () => view.showLayer(layer.name, checkbox.checked));
      const swatch = document.createElement('span');
      swatch.className = 'dxf-layer-swatch';
      swatch.style.background = layer.color;
      const name = document.createElement('span');
      name.textContent = layer.displayName || layer.name;
      label.append(checkbox, swatch, name);
      list.appendChild(document.createElement('li')).appendChild(label);
    }
    panel.append(title, list);
    element.appendChild(panel);
  }
  return () => view.dispose();
}
