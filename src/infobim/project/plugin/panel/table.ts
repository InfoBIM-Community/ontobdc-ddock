import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { Mountable } from '@/infobim/shared/adapter/view';
import { applyTranslations, onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

const SOURCE = 'table';
const ID_PREFIX = 'table:';
const VALUES_SEPARATOR = '|';

/**
 * A Surface tab with a whole group of the database as a table: a row per
 * entity, a column per field the data holds. It draws the values as the data
 * source holds them, each cell and column addressable by the identifier of its
 * field (`data-field`); the facade setup of the group (a state machine that
 * `presentation.main.panel.table.opened` starts) then orders and names the
 * columns and shows the values by their datatype. The Dockview panel id is
 * `table:<group>`, where group is the dataset's path in the project. It draws
 * again when the entities are read again or the language changes.
 */
export default function makeTable({ id }: { id: string }): Mountable {
  const groupId = id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id;
  const repository = EntityRepository.getInstance();

  const root = document.createElement('div');
  root.id = `table-panel:${encodeURIComponent(groupId)}`;
  root.className = 'panel-content table-viewer';
  root.tabIndex = -1;

  const render = (): void => {
    const group = repository.findGroup(groupId);
    if (!group || group.items.length === 0) {
      root.dataset.state = 'empty';
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.dataset.i18n = 'database.empty';
      empty.textContent = translate('database.empty');
      root.replaceChildren(empty);
      return;
    }

    root.dataset.state = 'ready';
    const columns = group.items[0].fields.map((field) => field.name);

    const table = document.createElement('table');
    table.className = 'entity-table';
    const head = table.createTHead().insertRow();
    for (const name of columns) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = name;
      cell.title = name;
      cell.dataset.field = name;
      head.append(cell);
    }
    const body = table.createTBody();
    for (const item of group.items) {
      const row = body.insertRow();
      row.dataset.id = item.id;
      for (const name of columns) {
        const cell = row.insertCell();
        const values = item.fields.find((field) => field.name === name)?.values ?? [];
        cell.dataset.field = name;
        if (values.length === 0) {
          cell.className = 'entity-empty';
          cell.textContent = '—';
        } else {
          const box = document.createElement('div');
          box.className = 'cell';
          box.textContent = values.join(VALUES_SEPARATOR);
          cell.append(box);
        }
      }
    }
    root.replaceChildren(table);
    applyTranslations(root);
  };

  render();

  const unsubscribers = [
    eventBus.subscribe('presentation.project.entities.found', render),
    onLocaleChange(render),
  ];

  return {
    element: root,
    mounted: () => {
      eventBus.publish('presentation.main.panel.table.opened', SOURCE, { group: groupId, panelId: root.id });
    },
    dispose: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      root.remove();
    },
  };
}
