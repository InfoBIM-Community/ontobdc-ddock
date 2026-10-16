import { createActionMenu, runAction, type ActionMenuTable } from '@/infobim/shared/adapter/action-menu';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { Mountable } from '@/infobim/shared/adapter/view';
import type { EntityGroup, EntityItem } from '@/infobim/shared/domain/model/entity';
import { applyTranslations, getLocale, onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

const SOURCE = 'database';

/** The actions of an entity, in the order its ⋯ menu shows them. */
const ITEM_MENU: ActionMenuTable = [
  { id: 'open', label: 'database.menu.open', event: 'presentation.database.item.opened' },
];

/** The actions of a group, in the order its ⋯ menu shows them. */
const GROUP_MENU: ActionMenuTable = [
  { id: 'open', label: 'database.menu.open', event: 'presentation.database.group.open.requested' },
  { id: 'new', label: 'database.menu.new', event: 'presentation.database.group.new.requested' },
];

/**
 * The database panel. Its groups are the datasets of the project's container,
 * as `infobim project --entity` answers them, and arrive in
 * `presentation.project.entities.found`, which replaces them all. Each group is
 * an accordion section and only one is open at a time; opening one publishes
 * `presentation.database.group.open.requested`. Under a group, each entity shows its
 * name; a double click or the menu's Open publishes
 * `presentation.database.item.opened`. The panel starts disabled and is enabled
 * when a project opens. It only shows and reports; what those events mean is up
 * to the listeners.
 */
export default function makeDatabase(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content tree-panel database-panel';

  let activated = false;
  const setInactive = (inactive: boolean): void => {
    root.classList.toggle('inactive', inactive);
    root.setAttribute('aria-disabled', inactive ? 'true' : 'false');
    root.inert = inactive;
  };
  const activate = (): void => {
    if (activated) return;
    activated = true;
    setInactive(false);
  };
  setInactive(true);

  let groups: EntityGroup[] = [];
  let openGroup: string | null = null;
  /** The alphabetical order each group is sorted in, by group id; a group not in it keeps the order the CLI gave. */
  const sortOrder = new Map<string, 'asc' | 'desc'>();
  let failure: string | null = null;
  const moreMenu = createActionMenu(SOURCE);
  let selected: HTMLLIElement | null = null;

  const emptyMessage = (): HTMLParagraphElement => {
    const empty = document.createElement('p');
    empty.className = 'tree-empty';
    empty.dataset.i18n = 'database.empty';
    empty.textContent = translate('database.empty');
    return empty;
  };

  const select = (item: HTMLLIElement): void => {
    selected?.classList.remove('selected');
    selected = item;
    item.classList.add('selected');
  };

  const renderEntity = (group: EntityGroup, entity: EntityItem): HTMLLIElement => {
    const item = document.createElement('li');
    item.className = 'tree-node file entity';
    item.dataset.id = entity.id;
    item.setAttribute('role', 'treeitem');
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.setProperty('--depth', '0');
    const label = entity.name || entity.id;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-item';
    button.textContent = label;
    button.title = [entity.type, entity.id].filter(Boolean).join(' — ');

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tree-more';
    more.dataset.item = entity.id;
    more.setAttribute('aria-label', translate('database.moreActions', { item: label }));
    more.textContent = '⋯';

    const openPayload = { group: group.id, id: entity.id };
    button.addEventListener('click', () => {
      select(item);
      moreMenu.close();
    });
    button.addEventListener('dblclick', () => {
      select(item);
      runAction(SOURCE, ITEM_MENU, 'open', openPayload);
    });
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      select(item);
      if (moreMenu.isOpen()) { moreMenu.close(); return; }
      moreMenu.show(more, ITEM_MENU, openPayload);
    });
    row.append(button, more);
    item.appendChild(row);
    return item;
  };

  const sortedItems = (group: EntityGroup): EntityItem[] => {
    const order = sortOrder.get(group.id);
    if (!order) return group.items;
    const sign = order === 'asc' ? 1 : -1;
    const nameOf = (entity: EntityItem): string => entity.name || entity.id;
    return [...group.items].sort((a, b) => sign * nameOf(a).localeCompare(nameOf(b), getLocale(), { numeric: true, sensitivity: 'base' }));
  };

  const render = (): void => {
    moreMenu.close();
    selected = null;
    const sections: HTMLElement[] = [];
    if (failure !== null) {
      const error = document.createElement('p');
      error.className = 'tree-empty database-failure';
      error.dataset.i18n = 'database.failed';
      error.textContent = translate('database.failed');
      error.title = failure;
      sections.push(error);
    }
    if (groups.length === 0 && failure === null) sections.push(emptyMessage());
    if (openGroup === null || !groups.some((group) => group.id === openGroup)) openGroup = groups[0]?.id ?? null;

    for (const group of groups) {
      const section = document.createElement('details');
      section.open = group.id === openGroup;
      section.dataset.group = group.id;
      const summary = document.createElement('summary');
      const label = document.createElement('span');
      label.className = 'tree-group-label';
      label.textContent = group.title.toLocaleUpperCase();
      summary.appendChild(label);

      // Sorts the group's entities by name: A to Z, then Z to A, and so on.
      const order = sortOrder.get(group.id);
      const sort = document.createElement('button');
      sort.type = 'button';
      sort.className = 'annotations-sort';
      sort.dataset.group = group.id;
      sort.dataset.order = order ?? 'none';
      sort.hidden = group.id !== openGroup;
      sort.textContent = order === 'asc' ? 'A→Z' : order === 'desc' ? 'Z→A' : 'A↕Z';
      sort.title = translate(order === 'asc' ? 'annotations.sort.desc' : 'annotations.sort.asc');
      sort.setAttribute('aria-label', sort.title);
      sort.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        sortOrder.set(group.id, order === 'asc' ? 'desc' : 'asc');
        render();
      });
      summary.appendChild(sort);

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'tree-group-more';
      more.dataset.group = group.id;
      more.hidden = group.id !== openGroup;
      more.setAttribute('aria-label', translate('database.group.actions', { group: group.title }));
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        if (moreMenu.isOpen()) { moreMenu.close(); return; }
        moreMenu.show(more, GROUP_MENU, { group: group.id });
      });
      summary.appendChild(more);

      summary.addEventListener('click', (event) => {
        event.preventDefault();
        if (section.open) return;
        for (const sibling of root.querySelectorAll<HTMLDetailsElement>(':scope > details')) sibling.open = false;
        section.open = true;
        openGroup = group.id;
        eventBus.publish('presentation.database.group.activated', SOURCE, { group: group.id });
        runAction(SOURCE, GROUP_MENU, 'open', { group: group.id });
      });
      section.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'tree-group-body database-group-body';
      if (group.items.length === 0) {
        body.appendChild(emptyMessage());
      } else {
        const list = document.createElement('ul');
        list.className = 'tree database-list';
        list.setAttribute('role', 'tree');
        list.append(...sortedItems(group).map((entity) => renderEntity(group, entity)));
        body.appendChild(list);
      }
      section.appendChild(body);
      sections.push(section);
    }
    root.replaceChildren(...sections);
    applyTranslations(root);
  };

  render();

  const unsubscribers = [
    eventBus.subscribe('presentation.project.local.opened', activate),
    eventBus.subscribe('presentation.project.remote.opened', activate),
    eventBus.subscribe('presentation.project.state.reported', ({ payload }) => {
      if (payload?.project) activate();
    }),
    // Only the active group offers its actions: its ⋯ and its sort button are shown, every other one is hidden.
    eventBus.subscribe('presentation.database.group.activated', ({ payload }) => {
      if (!payload?.group) return;
      openGroup = payload.group;
      moreMenu.close();
      for (const more of root.querySelectorAll<HTMLButtonElement>('.tree-group-more')) more.hidden = more.dataset.group !== payload.group;
      for (const sort of root.querySelectorAll<HTMLButtonElement>('.annotations-sort')) sort.hidden = sort.dataset.group !== payload.group;
    }),
    eventBus.subscribe('presentation.project.entities.found', ({ payload }) => {
      groups = Array.isArray(payload?.groups) ? payload.groups : [];
      failure = null;
      render();
    }),
    eventBus.subscribe('presentation.project.entities.failed', ({ payload }) => {
      failure = payload?.message ?? '';
      render();
    }),
    onLocaleChange(render),
  ];

  // A project may already be open by the time the panel mounts; ask for the
  // current state so the panel does not stay locked forever.
  eventBus.publish('presentation.project.state.requested', SOURCE);

  return {
    element: root,
    dispose: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      moreMenu.close();
      root.remove();
    },
  };
}
