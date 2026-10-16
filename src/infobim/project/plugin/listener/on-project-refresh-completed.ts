import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { PROJECT_INSPECT_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const REFRESH_COMPLETED = 'presentation.project.refresh.completed';
type RefreshCompleted = AppEventMap[typeof REFRESH_COMPLETED];

export class OnProjectRefreshCompleted {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_refresh_completed',
    logical_component: 'project',
    description: 'Asks for the inspection of the project once it was refreshed.',
    arguments: [
      {
        listen: [REFRESH_COMPLETED],
        valued: false,
        description: 'The project was refreshed.',
        type: 'str',
      },
    ],
  };

  private readonly payload: RefreshCompleted | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as RefreshCompleted | undefined;
  }

  /** Requests `infobim project --inspect`; the terminal shows it and the run listener executes it. */
  run(): void {
    eventBus.publish('presentation.main.command.requested', 'project_on_refresh_completed', {
      requestId: crypto.randomUUID(),
      command: PROJECT_INSPECT_COMMAND,
    });
  }
}
