import { startEditing } from '@/infobim/shared/adapter/entity-editing';
import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const EDIT_REQUESTED = 'presentation.entity.edit.requested';
type EditRequested = AppEventMap[typeof EDIT_REQUESTED];

export class OnEntityEditRequested {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_entity_edit_requested',
    logical_component: 'web',
    description: 'Puts the entity tab in edit mode: the fields that can be changed become editors.',
    arguments: [
      {
        listen: [EDIT_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the entity whose editing was requested.',
        type: 'str',
      },
    ],
  };

  private readonly request: EditRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as EditRequested | undefined;
  }

  /** Saves nothing: Save publishes `presentation.entity.save.requested`, which another listener handles. */
  async run(): Promise<void> {
    if (!this.request?.id) throw new Error('The edit request carries no entity id.');
    await startEditing(this.request.id);
  }
}
