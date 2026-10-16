import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';

const CREATE_REQUESTED = 'presentation.entity.create.requested';
type CreateRequested = AppEventMap[typeof CREATE_REQUESTED];
const SOURCE = 'project_on_entity_create_requested';

export class OnEntityCreateRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Creates the entity the person filled in, in a group of the database.',
    arguments: [
      {
        listen: [CREATE_REQUESTED],
        valued: true,
        parameter: 'group',
        description: 'Path of the dataset, in the project, the entity is created in.',
        type: 'str',
      },
    ],
  };

  private readonly request: CreateRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as CreateRequested | undefined;
  }

  /**
   * Runs `infobim project --entity <type> --create '<values as JSON>'`, the type
   * being the one the group holds. When it worked, publishes
   * `presentation.entity.created` with the global id the command answered, asks
   * the surface to close the tab of the new entity and reads the entities again
   * so the database shows it; when it did not, publishes
   * `presentation.entity.create.failed` with the reason and the tab stays open.
   */
  async run(): Promise<void> {
    const group = this.request?.group;
    const values = this.request?.values;
    if (!group) throw new Error('The request to create an entity carries no group.');
    if (!values || Object.keys(values).length === 0) throw new Error('The request to create an entity carries no values.');

    try {
      const entities = EntityRepository.getInstance().findGroup(group);
      const type = entities?.entityTypes[0] || entities?.items[0]?.type;
      if (!type) throw new Error(`The group ${group} has no entity type to create an instance of.`);

      // The command parser has no escape syntax: the JSON goes inside single quotes,
      // so any apostrophe in a value is written as its JSON escape.
      const source = JSON.stringify(values).replaceAll("'", '\\u0027');
      const result = await requestCommand(`${PROJECT_ENTITY_COMMAND} ${quoted(type)} --create '${source}'`, SOURCE);
      const response = result.stdout;
      const content = response && typeof response === 'object' && !Array.isArray(response) ? response.content : null;
      const id = content && typeof content === 'object' && !Array.isArray(content) && typeof content.global_id === 'string' ? content.global_id : '';
      if (!id) throw new Error('The command did not answer the global id of the new entity.');

      eventBus.publish('presentation.entity.created', SOURCE, { group, id });
      eventBus.publish('presentation.main.panel.close.requested', SOURCE, { container: 'surface', id: `entity-new:${group}` });
      eventBus.publish('presentation.main.command.requested', SOURCE, { requestId: crypto.randomUUID(), command: PROJECT_ENTITY_COMMAND });
    } catch (error) {
      eventBus.publish('presentation.entity.create.failed', SOURCE, { group, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
