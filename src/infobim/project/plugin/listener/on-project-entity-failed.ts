import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { PROJECT_ENTITY_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const EVENT = 'presentation.main.code.failure';
type Payload = AppEventMap[typeof EVENT];

export class OnProjectEntityFailed {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_entity_failed',
    logical_component: 'project',
    description: 'Tells the database that `infobim project --entity` failed.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'A command ran and did not work; the result says which one.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** Publishes why the entities could not be read. */
  run(): void {
    const failure = this.payload;
    if (failure?.result?.stdin !== PROJECT_ENTITY_COMMAND) return;

    eventBus.publish('presentation.project.entities.failed', 'project_on_entity_failed', { message: failure.message });
  }
}
