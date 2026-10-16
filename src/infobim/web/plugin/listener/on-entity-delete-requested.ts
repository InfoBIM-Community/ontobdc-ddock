import { confirmDialog } from '@/infobim/shared/adapter/confirm-dialog';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { translate } from '@/infobim/shared/plugin/i18n';

const DELETE_REQUESTED = 'presentation.entity.delete.requested';
type DeleteRequested = AppEventMap[typeof DELETE_REQUESTED];
const SOURCE = 'web_on_entity_delete_requested';

export class OnEntityDeleteRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'web',
    description: 'Asks the person to confirm the deletion of an entity, in a modal, and says whether they did.',
    arguments: [
      {
        listen: [DELETE_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the entity whose deletion was requested.',
        type: 'str',
      },
    ],
  };

  private readonly request: DeleteRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DeleteRequested | undefined;
  }

  /** Publishes `presentation.entity.delete.confirmed` or `presentation.entity.delete.cancelled` with the id. Deletes nothing. */
  async run(): Promise<void> {
    const id = this.request?.id;
    if (!id) throw new Error('The deletion request carries no entity id.');

    const name = EntityRepository.getInstance().find(id)?.item.name || id;
    const confirmed = await confirmDialog({
      title: translate('entity.delete.title'),
      message: translate('entity.delete.message', { name }),
      confirmLabel: translate('entity.delete.confirm'),
      cancelLabel: translate('confirm.cancel'),
    });
    eventBus.publish(confirmed ? 'presentation.entity.delete.confirmed' : 'presentation.entity.delete.cancelled', SOURCE, { id });
  }
}
