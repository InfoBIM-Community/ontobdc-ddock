import type { Editor, EditorOptions } from '@/infobim/shared/adapter/editor/editor';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { documentTitle } from '@/infobim/shared/adapter/document-iri';
import { registerListEditor } from '@/infobim/shared/adapter/list-editors';
import { translate } from '@/infobim/shared/plugin/i18n';

const SEPARATOR = '|';
const SOURCE = 'list_editor';

/**
 * Edits a field that holds several values: each one is an item with a × and
 * there is a + to add another. It only shows the items and reports what the
 * person asks: the × publishes `presentation.entity.list.item.remove.requested`
 * and the + `presentation.entity.list.item.add.requested`; the listeners decide
 * what happens and ask the editor, which is registered by owner and field, to
 * remove or add the item. An item of a field of documents is shown by the name
 * of its file. The value is the items separated by `|`, as the data source holds them.
 */
export default function listEditor({ value, label, documents = false, owner = '', field = '' }: EditorOptions): Editor {
  const items: string[] = value.split(SEPARATOR).map((item) => item.trim()).filter(Boolean);
  const listeners: Array<() => void> = [];
  const changed = (): void => listeners.forEach((listener) => listener());

  const root = document.createElement('div');
  root.className = 'entity-list-editor';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', label);
  const list = document.createElement('ul');
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'entity-list-add';
  add.textContent = '+';
  add.title = translate('entity.list.add');
  add.setAttribute('aria-label', add.title);
  root.append(list, add);

  const shown = (item: string): string => (documents ? documentTitle(item) ?? item : item);
  const draw = (): void => {
    list.replaceChildren(...items.map((item) => {
      const entry = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = shown(item);
      text.title = item;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'entity-list-remove';
      remove.textContent = '×';
      remove.title = translate('entity.list.remove', { item: shown(item) });
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => {
        eventBus.publish('presentation.entity.list.item.remove.requested', SOURCE, { owner, field, item });
      });
      entry.append(text, remove);
      return entry;
    }));
  };
  add.addEventListener('click', () => {
    eventBus.publish('presentation.entity.list.item.add.requested', SOURCE, { owner, field, documents });
  });

  draw();
  registerListEditor(owner, field, {
    element: root,
    remove: (item) => {
      const index = items.indexOf(item);
      if (index < 0) return;
      items.splice(index, 1);
      draw();
      changed();
    },
    add: (item) => {
      if (!item || items.includes(item)) return;
      items.push(item);
      draw();
      changed();
    },
  });

  return {
    element: root,
    value: () => items.join(SEPARATOR),
    isValid: () => true,
    onChange: (listener) => { listeners.push(listener); },
  };
}
