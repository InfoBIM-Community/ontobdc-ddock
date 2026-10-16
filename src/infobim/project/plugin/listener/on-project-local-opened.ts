import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { ContextRepository } from '@/infobim/shared/adapter/context';
import { runFeatureMessageQuery, waitForPythonReady } from '@/infobim/shared/adapter/command';
import { getLocale } from '@/infobim/shared/plugin/i18n';
import { PROJECT_REFRESH_COMMAND } from '@/infobim/shared/domain/model/project-command';
import type { ProjectOpened } from '@/infobim/shared/domain/model/project';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type {
  PythonFeatureDevice,
  PythonFeatureEnvironment,
} from '@/infobim/shared/domain/model/python-command';

const PROJECT_OPENED = 'presentation.project.opened';
const MOBILE_VIEWPORT = '(max-width: 768px)';

export class OnProjectLocalOpened {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_project_local_opened',
    logical_component: 'web',
    description: 'Responds when a local project is opened.',
    arguments: [
      {
        listen: ['presentation.project.local.opened'],
        valued: false,
        description: 'A local project was opened.',
        type: 'str',
      },
    ],
  };

  constructor(private readonly event: AppEvent<ProjectOpened>) {}

  async run(): Promise<void> {
    const project = this.event.payload;
    if (project?.access === 'read') return;
    if (!project?.folder) throw new Error('The opened local project carries no folder.');
    await new ContextRepository(project.folder).set('project_availability', 'local');

    // The terminal shows this command and the run listener executes it, as both hear the same event.
    eventBus.publish('presentation.main.command.requested', 'web_on_project_local_opened', {
      requestId: crypto.randomUUID(),
      command: PROJECT_REFRESH_COMMAND,
    });

    await this.publishProjectOpenedMessage(project.name);
  }

  private async publishProjectOpenedMessage(name: string): Promise<void> {
    const device: PythonFeatureDevice = window.matchMedia(MOBILE_VIEWPORT).matches ? 'Mobile' : 'Desktop';
    const environment: PythonFeatureEnvironment = 'Browser';

    await waitForPythonReady();
    const { text } = await runFeatureMessageQuery(
      OnProjectLocalOpened.METADATA.id,
      PROJECT_OPENED,
      device,
      environment,
      getLocale(),
      { access: 'local', name },
    );
    if (text === null) return;

    eventBus.publish('presentation.assistant.message.sent', OnProjectLocalOpened.METADATA.id, { text });
  }
}
