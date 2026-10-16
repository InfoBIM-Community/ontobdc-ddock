import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { PROJECT_REFRESH_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const CODE_SUCCESS = 'presentation.main.code.success';
type CodeSuccess = AppEventMap[typeof CODE_SUCCESS];

export class OnProjectRefreshSucceeded {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_refresh_succeeded',
    logical_component: 'project',
    description: 'Announces that the project was refreshed when `infobim project --refresh` worked.',
    arguments: [
      {
        listen: [CODE_SUCCESS],
        valued: false,
        description: 'A command ran and worked; the result says which one.',
        type: 'str',
      },
    ],
  };

  private readonly payload: CodeSuccess | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as CodeSuccess | undefined;
  }

  /** Turns the success of the refresh command into the domain event the next steps wait for. */
  run(): void {
    const success = this.payload;
    if (success?.result.stdin !== PROJECT_REFRESH_COMMAND) return;

    eventBus.publish('presentation.project.refresh.completed', 'project_on_refresh_succeeded', { requestId: success.requestId });
  }
}
