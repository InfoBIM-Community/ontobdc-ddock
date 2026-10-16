import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a DXF tab; the Dockview panel id is `dxf:<path>`. The drawing is
 * drawn in 2D (dxf-viewer, loaded the first time one opens): drag pans, the
 * wheel zooms, and the layers can be shown or hidden. Closing the tab
 * publishes `presentation.main.dxf.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'dxf',
  className: 'dxf-panel',
  closedEvent: 'presentation.main.dxf.closed',
  render: async (file, element) => {
    const { renderDrawing } = await import('@/infobim/web/adapter/viewer/drawing-render');
    return renderDrawing(file, element);
  },
});
