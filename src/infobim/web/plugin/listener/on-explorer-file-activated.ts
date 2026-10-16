import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import { ExplorerFileOpenMachine } from '@/infobim/project/plugin/machine/explorer_file_open/machine';
import type { ExplorerFileOpenRequest } from '@/infobim/project/plugin/machine/explorer_file_open/port';

const FILE_ACTIVATED = 'presentation.explorer.file.activated';
const MODEL_ACTIVATED = 'presentation.explorer.model.activated';
const DRAWING_ACTIVATED = 'presentation.explorer.drawing.activated';
/** The three events carry the same payload: the path of the item. */
type ExplorerItemActivated = AppEventMap[typeof FILE_ACTIVATED];

export class OnExplorerFileActivated {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_explorer_file_activated',
    logical_component: 'web',
    description: 'Responds when a file, a model or a drawing is activated (double-clicked) in the explorer.',
    arguments: [
      {
        listen: [FILE_ACTIVATED, MODEL_ACTIVATED, DRAWING_ACTIVATED],
        valued: true,
        parameter: 'item',
        description: 'Path of the item activated in the explorer.',
        type: 'str',
      },
    ],
  };

  private readonly request: ExplorerItemActivated | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ExplorerItemActivated | undefined;
  }

  /** Hands the selected item to the file-open machine; the machine does the work. */
  async run(): Promise<void> {
    if (!this.request?.item) throw new Error('The explorer activation carries no item.');

    const request: ExplorerFileOpenRequest = { item: this.request.item };
    await new ExplorerFileOpenMachine(request).execute();
  }
}
