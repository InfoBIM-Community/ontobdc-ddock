import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { SetUpGroupTableMachine } from '@/infobim/web/plugin/machine/set_up_group_table/machine';

const TABLE_OPENED = 'presentation.main.panel.table.opened';

export class OnPanelTableOpened {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_panel_table_opened',
    logical_component: 'web',
    description: 'Starts the setup of the table of a group after its tab is mounted.',
    arguments: [{
      listen: [TABLE_OPENED], valued: true, parameter: 'group',
      description: 'Path of the dataset, in the project, whose table was mounted.', type: 'str',
    }, {
      listen: [TABLE_OPENED], valued: true, parameter: 'panelId',
      description: 'DOM id of the mounted table panel.', type: 'str',
    }],
  };

  constructor(private readonly event: AppEvent<AppEventMap[typeof TABLE_OPENED]>) {}

  async run(): Promise<void> {
    const request = this.event.payload;
    if (!request?.group || !request.panelId) throw new Error('The opened table panel carries no group or panel id.');
    await new SetUpGroupTableMachine({ id: request.group, panelId: request.panelId }).execute();
  }
}
