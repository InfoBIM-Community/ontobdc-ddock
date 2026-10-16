import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';

const SAVE_REQUESTED = 'presentation.entity.save.requested';
type SaveRequested = AppEventMap[typeof SAVE_REQUESTED];
const SOURCE = 'project_on_entity_save_requested';

export class OnEntitySaveRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Saves the changes made to an entity of the project.',
    arguments: [
      {
        listen: [SAVE_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the entity whose changes must be saved.',
        type: 'str',
      },
    ],
  };

  private readonly request: SaveRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as SaveRequested | undefined;
  }

  /**
   * Runs `infobim project --entity <id> --update '<changes as JSON>'`. When it
   * worked, publishes `presentation.entity.saved` (which ends the editing) and
   * reads the entities again so the database panel shows the new values; when it
   * did not, publishes `presentation.entity.save.failed` with the reason and the
   * editing stays open.
   */
  async run(): Promise<void> {
    const id = this.request?.id;
    const changes = this.request?.changes;
    if (!id) throw new Error('The save request carries no entity id.');
    if (!changes || Object.keys(changes).length === 0) throw new Error('The save request carries no changes.');

    // The command parser has no escape syntax: the JSON goes inside single quotes,
    // so any apostrophe in a value is written as its JSON escape.
    const source = JSON.stringify(changes).replaceAll("'", '\\u0027');
    try {
      await requestCommand(`${PROJECT_ENTITY_COMMAND} ${quoted(id)} --update '${source}'`, SOURCE);
    } catch (error) {
      eventBus.publish('presentation.entity.save.failed', SOURCE, { id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    eventBus.publish('presentation.entity.saved', SOURCE, { id });
    eventBus.publish('presentation.main.command.requested', SOURCE, { requestId: crypto.randomUUID(), command: PROJECT_ENTITY_COMMAND });
  }
}
