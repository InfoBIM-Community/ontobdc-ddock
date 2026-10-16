import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const EVENT = 'presentation.project.refresh.completed';
type Payload = AppEventMap[typeof EVENT];

export class OnProjectRefreshCompletedEntity {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_refresh_completed_entity',
    logical_component: 'project',
    description: 'Asks for the entities of the project once it was refreshed.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'The project was refreshed.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** Requests `infobim project --entity`; the terminal shows it and the run listener executes it. */
  run(): void {
    eventBus.publish('presentation.main.command.requested', 'project_on_refresh_completed_entity', {
      requestId: crypto.randomUUID(),
      command: PROJECT_ENTITY_COMMAND,
    });
  }
}
