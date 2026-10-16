import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { IfcViewRepository } from '@/infobim/shared/adapter/ifc-view-repository';
import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of an IFC tab; the Dockview panel id is `ifc:<path>`. The model is
 * drawn in 3D (three.js and web-ifc, loaded the first time one opens): left
 * drag orbits, right drag pans, the wheel zooms. A click is published as
 * `presentation.ifc.view.clicked`, and the view is registered by the path. Closing the tab publishes
 * `presentation.main.ifc.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'ifc',
  className: 'ifc-panel',
  closedEvent: 'presentation.main.ifc.closed',
  render: async (file, element, item) => {
    const [{ createModelView }, bytes] = await Promise.all([
      import('@/infobim/web/adapter/viewer/model-view'),
      file.arrayBuffer(),
    ]);
    // A click is only reported; selecting an element is the job of the machine that hears it.
    const view = createModelView(element, {
      onClick: ({ x, y }) => eventBus.publish('presentation.ifc.view.clicked', 'ifc', { item, x, y }),
    });
    try {
      await view.add(new Uint8Array(bytes));
    } catch (error) {
      view.dispose();
      throw error;
    }
    const forget = IfcViewRepository.getInstance().register(item, view);
    return () => {
      forget();
      view.dispose();
    };
  },
});
