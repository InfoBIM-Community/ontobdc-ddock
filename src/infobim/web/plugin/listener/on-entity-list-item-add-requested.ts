import { pickDocument } from '@/infobim/shared/adapter/document-picker';
import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { promptDialog } from '@/infobim/shared/adapter/prompt-dialog';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { translate } from '@/infobim/shared/plugin/i18n';

const ADD_REQUESTED = 'presentation.entity.list.item.add.requested';
type AddRequested = AppEventMap[typeof ADD_REQUESTED];
const SOURCE = 'web_on_entity_list_item_add_requested';

export class OnEntityListItemAddRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'web',
    description: 'Shows the files of the project (or asks for a text) to choose the item to add to a list field, and says which was chosen.',
    arguments: [
      {
        listen: [ADD_REQUESTED], valued: true, parameter: 'field',
        description: 'Identifier of the list field an item is added to.', type: 'str',
      },
    ],
  };

  private readonly request: AddRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as AddRequested | undefined;
  }

  /**
   * For a field of documents, opens the files of the project to choose from; for
   * any other, asks for the text of the value. Publishes
   * `presentation.entity.list.item.chosen` with what was chosen, and nothing
   * when the person cancels.
   */
  async run(): Promise<void> {
    const { owner, field, documents } = this.request ?? {};
    if (owner === undefined || !field) throw new Error('The request to add an item carries no owner or field.');

    const item = documents === true
      ? await pickDocument()
      : await promptDialog({
        title: translate('entity.list.prompt.title'),
        label: translate('entity.list.new'),
        confirmLabel: translate('entity.list.prompt.confirm'),
        cancelLabel: translate('confirm.cancel'),
      });
    if (item) eventBus.publish('presentation.entity.list.item.chosen', SOURCE, { owner, field, item });
  }
}
