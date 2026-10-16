import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { entityGroupsOf } from '@/infobim/shared/adapter/project-format';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const EVENT = 'presentation.main.code.success';
type Payload = AppEventMap[typeof EVENT];

export class OnProjectEntitySucceeded {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_entity_succeeded',
    logical_component: 'project',
    description: 'Fills the database when `infobim project --entity` worked.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'A command ran and worked; the result says which one.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** Publishes the groups the command answered, or says it could not read them. */
  run(): void {
    const success = this.payload;
    if (success?.result.stdin !== PROJECT_ENTITY_COMMAND) return;

    const groups = entityGroupsOf(success.result.stdout);
    if (groups) eventBus.publish('presentation.project.entities.found', 'project_on_entity_succeeded', { groups });
    else eventBus.publish('presentation.project.entities.failed', 'project_on_entity_succeeded', { message: 'The entity command did not answer with datasets.' });
  }
}
