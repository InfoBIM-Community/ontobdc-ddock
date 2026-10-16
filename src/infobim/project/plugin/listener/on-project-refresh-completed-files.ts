import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import { crateFilePaths, pathsToTree } from '@/infobim/shared/adapter/project-format';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const REFRESH_COMPLETED = 'presentation.project.refresh.completed';
type RefreshCompleted = AppEventMap[typeof REFRESH_COMPLETED];
const SOURCE = 'project_on_refresh_completed_files';
const METADATA_DIRECTORY = '.__ontobdc__';
const CRATE_FILE = 'ro-crate-metadata.json';

export class OnProjectRefreshCompletedFiles {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'project',
    description: 'Reads the files of the project again once it was refreshed, for the explorer to show them.',
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

  /**
   * The refresh rewrites the RO-Crate of the project with the files it has now.
   * Reads it from the project folder and publishes `presentation.project.files.found`
   * with them, which replaces the tree of the FILES group. A project opened without
   * write access has no folder and keeps the files it showed.
   */
  async run(): Promise<void> {
    const folder = ProjectRepository.getInstance().get()?.folder;
    if (!folder) return;

    const directory = await folder.getDirectoryHandle(METADATA_DIRECTORY);
    const crate = await (await directory.getFileHandle(CRATE_FILE)).getFile();
    eventBus.publish('presentation.project.files.found', SOURCE, { nodes: pathsToTree(crateFilePaths(await crate.text())) });
  }
}
