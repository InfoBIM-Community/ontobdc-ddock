import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a DWG tab, read-only; the Dockview panel id is `dwg:<path>`. The
 * browser cannot read DWG, so the file is converted to DXF (acadrust compiled
 * to WebAssembly, in a Web Worker, loaded the first time one opens) and drawn
 * like a DXF. The file in the project is not changed. Closing the tab
 * publishes `presentation.main.dwg.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'dwg',
  className: 'dxf-panel',
  closedEvent: 'presentation.main.dwg.closed',
  render: async (file, element) => {
    const [{ convertDwgToDxf }, { renderDrawing }] = await Promise.all([
      import('@/infobim/web/adapter/viewer/dwg-convert'),
      import('@/infobim/web/adapter/viewer/drawing-render'),
    ]);
    return renderDrawing(await convertDwgToDxf(file), element);
  },
});
