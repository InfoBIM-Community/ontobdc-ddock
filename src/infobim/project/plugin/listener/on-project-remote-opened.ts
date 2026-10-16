import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { ContextRepository } from '@/infobim/shared/adapter/context';
import { runFeatureMessageQuery, waitForPythonReady } from '@/infobim/shared/adapter/command';
import { getLocale } from '@/infobim/shared/plugin/i18n';
import type { ProjectOpened } from '@/infobim/shared/domain/model/project';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type {
  PythonFeatureDevice,
  PythonFeatureEnvironment,
} from '@/infobim/shared/domain/model/python-command';

const PROJECT_OPENED = 'presentation.project.opened';
const MOBILE_VIEWPORT = '(max-width: 768px)';

export class OnProjectRemoteOpened {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_project_remote_opened',
    logical_component: 'web',
    description: 'Responds when a remote project is opened.',
    arguments: [
      {
        listen: ['presentation.project.remote.opened'],
        valued: false,
        description: 'A remote project was opened.',
        type: 'str',
      },
    ],
  };

  constructor(private readonly event: AppEvent<ProjectOpened>) {}

  async run(): Promise<void> {
    const project = this.event.payload;
    if (!project?.folder) throw new Error('The opened remote project carries no folder.');
    await new ContextRepository(project.folder).set('project_availability', 'remote');

    await this.publishProjectOpenedMessage(project.name);
  }

  private async publishProjectOpenedMessage(name: string): Promise<void> {
    const device: PythonFeatureDevice = window.matchMedia(MOBILE_VIEWPORT).matches ? 'Mobile' : 'Desktop';
    const environment: PythonFeatureEnvironment = 'Browser';

    await waitForPythonReady();
    const { text } = await runFeatureMessageQuery(
      OnProjectRemoteOpened.METADATA.id,
      PROJECT_OPENED,
      device,
      environment,
      getLocale(),
      { access: 'remoto', name },
    );
    if (text === null) return;

    eventBus.publish('presentation.assistant.message.sent', OnProjectRemoteOpened.METADATA.id, { text });
  }
}
