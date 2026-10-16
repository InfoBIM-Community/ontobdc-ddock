import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { SetUpEntityFacadeMachine } from '@/infobim/web/plugin/machine/set_up_entity_facade/machine';

const ENTITY_OPENED = 'presentation.main.panel.entity.opened';

export class OnPanelEntityOpened {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_panel_entity_opened',
    logical_component: 'web',
    description: 'Starts entity facade setup after the entity tab is mounted.',
    arguments: [{
      listen: [ENTITY_OPENED], valued: true, parameter: 'id',
      description: 'Global id of the entity whose tab was mounted.', type: 'str',
    }, {
      listen: [ENTITY_OPENED], valued: true, parameter: 'panelId',
      description: 'DOM id of the mounted entity panel.', type: 'str',
    }],
  };

  constructor(private readonly event: AppEvent<AppEventMap[typeof ENTITY_OPENED]>) {}

  async run(): Promise<void> {
    const request = this.event.payload;
    if (!request?.id || !request.panelId) throw new Error('The opened entity panel carries no entity or panel id.');
    await new SetUpEntityFacadeMachine(request).execute();
  }
}
