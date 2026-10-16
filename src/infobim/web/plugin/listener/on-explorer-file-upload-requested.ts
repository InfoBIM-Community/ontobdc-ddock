import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const UPLOAD_REQUESTED = 'presentation.explorer.file.upload.requested';
type UploadRequested = AppEventMap[typeof UPLOAD_REQUESTED];
const SOURCE = 'web_on_explorer_file_upload_requested';

export class OnExplorerFileUploadRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'web',
    description: 'Opens the dialog of the browser to pick files on the computer, to upload to a path of the project.',
    arguments: [
      {
        listen: [UPLOAD_REQUESTED],
        valued: true,
        parameter: 'path',
        description: 'Where the files go, in the project: a directory, or an empty text for the root of the container.',
        type: 'str',
      },
    ],
  };

  private readonly request: UploadRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as UploadRequested | undefined;
  }

  /**
   * Opens the file picker of the browser, for one or more files. When files are
   * picked, publishes `presentation.explorer.file.upload.selected` with them and
   * the path; a cancelled dialog publishes nothing. Sends nothing anywhere.
   */
  run(): void {
    const path = this.request?.path;
    if (typeof path !== 'string') throw new Error('The upload request carries no path.');

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.hidden = true;
    document.body.append(input);
    const cleanup = (): void => input.remove();
    input.addEventListener('cancel', cleanup, { once: true });
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      cleanup();
      if (files.length > 0) eventBus.publish('presentation.explorer.file.upload.selected', SOURCE, { path, files });
    }, { once: true });
    input.click();
  }
}
