import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';

const DELETE_CONFIRMED = 'presentation.entity.delete.confirmed';
type DeleteConfirmed = AppEventMap[typeof DELETE_CONFIRMED];
const SOURCE = 'project_on_entity_delete_confirmed';

export class OnEntityDeleteConfirmed {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Deletes an entity of the project once its deletion was confirmed.',
    arguments: [
      {
        listen: [DELETE_CONFIRMED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the entity whose deletion was confirmed.',
        type: 'str',
      },
    ],
  };

  private readonly request: DeleteConfirmed | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DeleteConfirmed | undefined;
  }

  /**
   * Runs `infobim project --entity <id> --delete`. When it worked, publishes
   * `presentation.entity.deleted` and reads the entities again so the database
   * panel no longer lists it; when it did not, publishes
   * `presentation.entity.delete.failed` with the reason.
   */
  async run(): Promise<void> {
    const id = this.request?.id;
    if (!id) throw new Error('The confirmed deletion carries no entity id.');

    try {
      await requestCommand(`${PROJECT_ENTITY_COMMAND} ${quoted(id)} --delete`, SOURCE);
    } catch (error) {
      eventBus.publish('presentation.entity.delete.failed', SOURCE, { id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    eventBus.publish('presentation.entity.deleted', SOURCE, { id });
    eventBus.publish('presentation.main.command.requested', SOURCE, { requestId: crypto.randomUUID(), command: PROJECT_ENTITY_COMMAND });
  }
}
