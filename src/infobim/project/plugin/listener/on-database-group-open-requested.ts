import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const GROUP_OPEN_REQUESTED = 'presentation.database.group.open.requested';
type GroupOpenRequested = AppEventMap[typeof GROUP_OPEN_REQUESTED];
const SOURCE = 'project_on_database_group_open_requested';

export class OnDatabaseGroupOpenRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Opens the table of a group of the database: one row per entity, one column per field of the facade.',
    arguments: [
      {
        listen: [GROUP_OPEN_REQUESTED],
        valued: true,
        parameter: 'group',
        description: 'Path of the dataset, in the project, whose entities the table shows.',
        type: 'str',
      },
    ],
  };

  private readonly request: GroupOpenRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as GroupOpenRequested | undefined;
  }

  /**
   * Asks the surface for the tab `table:<group>`, titled with the group; asking
   * again focuses it. The facade of the group is not read here: the setup of the
   * table does it when the tab is mounted.
   */
  run(): void {
    const groupId = this.request?.group;
    if (!groupId) throw new Error('The request to open a group carries no group.');

    const group = EntityRepository.getInstance().findGroup(groupId);
    if (!group) throw new Error(`The database has no group ${groupId}.`);

    eventBus.publish('presentation.main.panel.open.requested', SOURCE, {
      container: 'surface',
      id: `table:${groupId}`,
      component: 'table',
      title: group.title,
    });
  }
}
