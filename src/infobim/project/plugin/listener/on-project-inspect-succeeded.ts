import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { inspectSectionNodes } from '@/infobim/shared/adapter/project-format';
import type { ProjectInspection } from '@/infobim/shared/domain/model/project';
import { PROJECT_INSPECT_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const CODE_SUCCESS = 'presentation.main.code.success';
type CodeSuccess = AppEventMap[typeof CODE_SUCCESS];

export class OnProjectInspectSucceeded {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_on_inspect_succeeded',
    logical_component: 'project',
    description: 'Fills the MODELS and DRAWINGS groups of the explorer when `infobim project --inspect` worked.',
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

  /** Publishes the nodes of the models and of the drawings the inspection found, for the explorer to show. */
  run(): void {
    const success = this.payload;
    if (success?.result.stdin !== PROJECT_INSPECT_COMMAND) return;

    const inspection = success.result.stdout as unknown as ProjectInspection;
    eventBus.publish('presentation.project.models.found', 'project_on_inspect_succeeded', { nodes: inspectSectionNodes(inspection, 'model') });
    eventBus.publish('presentation.project.drawings.found', 'project_on_inspect_succeeded', { nodes: inspectSectionNodes(inspection, 'drawing') });
  }
}
