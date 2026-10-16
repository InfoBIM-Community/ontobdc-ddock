import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import { RemoteProjectConnectionMachine } from '@/infobim/project/plugin/machine/remote_project_connection/machine';

const CONNECT_REQUESTED = 'presentation.project.connect.requested';
type ConnectRequested = AppEventMap[typeof CONNECT_REQUESTED];

export class RemoteProjectInitializationListener {
  static readonly METADATA: ListenerMetadata = {
    id: 'project_connect_remote',
    logical_component: 'project',
    description: 'Connect to a remote InfoBIM Project by its URL.',
    arguments: [
      {
        listen: [CONNECT_REQUESTED],
        valued: true,
        parameter: 'url',
        description:
          'Address of the remote project to connect to. It must be an http '
          + 'or https URL.',
        type: 'str',
      },
      {
        listen: [CONNECT_REQUESTED],
        valued: true,
        parameter: 'apiToken',
        description: 'API token the remote project is accessed with. Optional.',
        type: 'str',
      },
    ],
  };

  private readonly request: ConnectRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ConnectRequested | undefined;
  }

  /** Hands the request to the connection machine; the machine does the work. */
  async run(): Promise<void> {
    if (!this.request?.url) throw new Error('The connect request carries no URL.');

    await new RemoteProjectConnectionMachine(this.request).execute();
  }
}
