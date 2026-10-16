import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { PROJECT_REFRESH_COMMAND } from '@/infobim/shared/domain/model/project-command';

const UPLOAD_SELECTED = 'presentation.explorer.file.upload.selected';
type UploadSelected = AppEventMap[typeof UPLOAD_SELECTED];
const SOURCE = 'project_on_explorer_file_upload_selected';

const isNotFound = (error: unknown): boolean => error instanceof DOMException && error.name === 'NotFoundError';

export class OnExplorerFileUploadSelected {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Writes the files the person picked into the project, then refreshes the project.',
    arguments: [
      {
        listen: [UPLOAD_SELECTED],
        valued: true,
        parameter: 'path',
        description: 'Where the files go, in the project: a directory, or an empty text for the root of the container.',
        type: 'str',
      },
    ],
  };

  private readonly request: UploadSelected | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as UploadSelected | undefined;
  }

  /**
   * Writes each picked file into `path` of the project folder, creating the
   * directories of the path that are missing. A file that already exists there is
   * left as it is and reported as skipped; nothing is overwritten. When at least
   * one file was written, publishes `presentation.explorer.file.uploaded` and asks
   * for `infobim project --refresh`, so the project sees the new files. When the
   * project cannot be written or the path is not valid, publishes
   * `presentation.explorer.file.upload.failed` and refreshes nothing.
   */
  async run(): Promise<void> {
    const path = this.request?.path;
    const picked = this.request?.files ?? [];
    if (typeof path !== 'string') throw new Error('The selected files carry no path.');

    try {
      const folder = ProjectRepository.getInstance().get()?.folder;
      if (!folder) throw new Error('The project cannot be written: it is not open with write access.');
      const segments = path.split('/').filter((segment) => segment !== '');
      if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error(`The path ${path} is not valid.`);

      let directory = folder;
      for (const segment of segments) directory = await directory.getDirectoryHandle(segment, { create: true });

      const files: string[] = [];
      const skipped: string[] = [];
      for (const file of picked) {
        const exists = await directory.getFileHandle(file.name).then(() => true, (error: unknown) => {
          if (isNotFound(error)) return false;
          throw error;
        });
        if (exists) {
          skipped.push(file.name);
          continue;
        }
        const writable = await (await directory.getFileHandle(file.name, { create: true })).createWritable();
        await writable.write(file);
        await writable.close();
        files.push(file.name);
      }

      eventBus.publish('presentation.explorer.file.uploaded', SOURCE, { path, files, skipped });
      if (files.length > 0) {
        eventBus.publish('presentation.main.command.requested', SOURCE, { requestId: crypto.randomUUID(), command: PROJECT_REFRESH_COMMAND });
      }
    } catch (error) {
      eventBus.publish('presentation.explorer.file.upload.failed', SOURCE, { path, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
