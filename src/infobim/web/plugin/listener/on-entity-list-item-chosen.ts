import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import { findListEditor } from '@/infobim/shared/adapter/list-editors';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const ITEM_CHOSEN = 'presentation.entity.list.item.chosen';
type ItemChosen = AppEventMap[typeof ITEM_CHOSEN];

export class OnEntityListItemChosen {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_entity_list_item_chosen',
    logical_component: 'web',
    description: 'Adds the item the person chose to the list field being edited.',
    arguments: [
      {
        listen: [ITEM_CHOSEN], valued: true, parameter: 'item',
        description: 'The value chosen to add to the list field.', type: 'str',
      },
    ],
  };

  private readonly request: ItemChosen | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ItemChosen | undefined;
  }

  /** Asks the list editor of the field to take the item in; nothing is saved, the edit goes on. */
  run(): void {
    const { owner, field, item } = this.request ?? {};
    if (owner === undefined || !field || !item) throw new Error('The chosen item carries no owner, field or item.');

    findListEditor(owner, field)?.add(item);
  }
}
