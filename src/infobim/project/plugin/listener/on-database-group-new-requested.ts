import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { nameIn, type Facade } from '@/infobim/shared/adapter/facade-labels';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { getLocale, translate } from '@/infobim/shared/plugin/i18n';

const GROUP_NEW_REQUESTED = 'presentation.database.group.new.requested';
type GroupNewRequested = AppEventMap[typeof GROUP_NEW_REQUESTED];
const SOURCE = 'project_on_database_group_new_requested';

export class OnDatabaseGroupNewRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Opens the tab where a new entity of a group of the database is filled in, with the fields of its facade.',
    arguments: [
      {
        listen: [GROUP_NEW_REQUESTED],
        valued: true,
        parameter: 'group',
        description: 'Path of the dataset, in the project, the new entity would belong to.',
        type: 'str',
      },
    ],
  };

  private readonly request: GroupNewRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as GroupNewRequested | undefined;
  }

  /**
   * Reads the facade of the entity the group holds (`infobim context --entity
   * <type> --inspect`), keeps it with the entities, and asks the surface for the
   * tab `entity-new:<group>`, which shows the fields to fill in; asking again
   * focuses it. Without the facade, or when its facade does not allow creating
   * instances, no tab opens and `presentation.database.group.new.failed` says why.
   * Nothing is created here.
   */
  async run(): Promise<void> {
    const groupId = this.request?.group;
    if (!groupId) throw new Error('The request for a new entity carries no group.');

    try {
      const repository = EntityRepository.getInstance();
      const group = repository.findGroup(groupId);
      if (!group) throw new Error(`The database has no group ${groupId}.`);

      const entityType = group.items[0]?.type || group.entityTypes[0];
      if (!entityType) throw new Error(`The group ${group.title} has no entity type to look the facade of.`);

      const result = await requestCommand(`infobim context --entity ${quoted(entityType)} --inspect`, SOURCE);
      const response = result.stdout;
      const content = response && typeof response === 'object' && !Array.isArray(response) ? response.content : null;
      if (!content || typeof content !== 'object' || Array.isArray(content) || !Array.isArray(content.fields)) {
        throw new Error(`The facade inspection returned no facade for ${entityType}.`);
      }
      const facade = content as unknown as Facade;
      if (facade.creatable !== true) throw new Error(`The entities of ${entityType} cannot be created: their facade does not allow it.`);
      repository.setFacade(groupId, facade);

      eventBus.publish('presentation.main.panel.open.requested', SOURCE, {
        container: 'surface',
        id: `entity-new:${groupId}`,
        component: 'entity_new',
        title: translate('database.new.title', { name: nameIn(facade.labels, getLocale()) ?? facade.name ?? group.title }),
      });
    } catch (error) {
      eventBus.publish('presentation.database.group.new.failed', SOURCE, { group: groupId, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
