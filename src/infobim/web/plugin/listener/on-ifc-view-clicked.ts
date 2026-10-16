import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import { IfcElementSelectionMachine } from '@/infobim/project/plugin/machine/ifc_element_selection/machine';

const VIEW_CLICKED = 'presentation.ifc.view.clicked';
type IfcViewClicked = AppEventMap[typeof VIEW_CLICKED];

export class OnIfcViewClicked {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_ifc_view_clicked',
    logical_component: 'web',
    description: 'Responds when the user clicks in the 3D view of an IFC tab.',
    arguments: [
      {
        listen: [VIEW_CLICKED],
        valued: true,
        parameter: 'item',
        description: 'Path of the IFC file whose tab was clicked.',
        type: 'str',
      },
    ],
  };

  private readonly request: IfcViewClicked | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as IfcViewClicked | undefined;
  }

  /** Hands the click to the selection machine; the machine does the work. */
  async run(): Promise<void> {
    if (!this.request?.item) throw new Error('The click carries no IFC file.');

    await new IfcElementSelectionMachine(this.request).execute();
  }
}
