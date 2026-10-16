import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { runFeatureMessageQuery, waitForPythonReady } from '@/infobim/shared/adapter/command';
import { getLocale } from '@/infobim/shared/plugin/i18n';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type {
  PythonFeatureDevice,
  PythonFeatureEnvironment,
} from '@/infobim/shared/domain/model/python-command';

const LAYOUT_LOADED = 'presentation.main.layout.loaded';
const MOBILE_VIEWPORT = '(max-width: 768px)';

export class OnLayoutLoaded {
  static readonly METADATA: ListenerMetadata = {
    id: 'run_on_layout_loaded',
    logical_component: 'run',
    description: "Looks up the assistant's welcome message once the layout is mounted.",
    arguments: [
      {
        listen: [LAYOUT_LOADED],
        valued: false,
        description: 'The layout was mounted; this event carries no data.',
        type: 'str',
      },
    ],
  };

  constructor(_event: AppEvent) {}

  /** Asks brasidatacenter's feature ontology for the welcome message and posts it to the assistant. */
  async run(): Promise<void> {
    const device: PythonFeatureDevice = window.matchMedia(MOBILE_VIEWPORT).matches ? 'Mobile' : 'Desktop';
    const environment: PythonFeatureEnvironment = 'Browser';

    await waitForPythonReady();
    const { text } = await runFeatureMessageQuery(
      OnLayoutLoaded.METADATA.id,
      LAYOUT_LOADED,
      device,
      environment,
      getLocale(),
    );
    if (text === null) return;

    eventBus.publish('presentation.assistant.message.sent', OnLayoutLoaded.METADATA.id, { text });
  }
}
