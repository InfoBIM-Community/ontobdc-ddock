import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import { findListEditor } from '@/infobim/shared/adapter/list-editors';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const REMOVE_REQUESTED = 'presentation.entity.list.item.remove.requested';
type RemoveRequested = AppEventMap[typeof REMOVE_REQUESTED];

export class OnEntityListItemRemoveRequested {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_entity_list_item_remove_requested',
    logical_component: 'web',
    description: 'Removes an item from the list field being edited when the person asks to.',
    arguments: [
      {
        listen: [REMOVE_REQUESTED], valued: true, parameter: 'item',
        description: 'The value to remove from the list field.', type: 'str',
      },
    ],
  };

  private readonly request: RemoveRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as RemoveRequested | undefined;
  }

  /** Asks the list editor of the field to drop the item; nothing is saved, the edit goes on. */
  run(): void {
    const { owner, field, item } = this.request ?? {};
    if (owner === undefined || !field || !item) throw new Error('The request to remove an item carries no owner, field or item.');

    findListEditor(owner, field)?.remove(item);
  }
}
