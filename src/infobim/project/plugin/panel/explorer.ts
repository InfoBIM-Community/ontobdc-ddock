import { createActionMenu, runAction, type ActionMenuTable } from '@/infobim/shared/adapter/action-menu';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { Mountable } from '@/infobim/shared/adapter/view';
import type { ExplorerGroupId } from '@/infobim/shared/domain/model/event';
import type { ExplorerNode } from '@/infobim/shared/domain/model/explorer-node';
import { applyTranslations, onLocaleChange, translate, type MessageKey } from '@/infobim/shared/plugin/i18n';

const SOURCE = 'explorer';

const EXPLORER_GROUPS: Array<{ id: ExplorerGroupId; label: MessageKey }> = [
  { id: 'files', label: 'explorer.group.files' },
  { id: 'models', label: 'explorer.group.models' },
  { id: 'drawings', label: 'explorer.group.drawings' },
];

/**
 * The actions of an item, in the order its ⋯ menu shows them: one table per
 * group, because a file, a model and a drawing do not share the same event.
 */
const ITEM_MENU: Record<ExplorerGroupId, ActionMenuTable> = {
  files: [
    { id: 'open', label: 'explorer.menu.open', event: 'presentation.explorer.file.activated' },
    // { id: 'rename', label: 'explorer.menu.rename', shortcut: 'explorer.menu.shortcut.rename', disabled: true, event: 'presentation.explorer.activated' },
    // { id: 'delete', label: 'explorer.menu.delete', shortcut: 'explorer.menu.shortcut.delete', disabled: true, event: 'presentation.explorer.activated' },
  ],
  models: [
    { id: 'open', label: 'explorer.menu.open', event: 'presentation.explorer.model.activated' },
  ],
  drawings: [
    { id: 'open', label: 'explorer.menu.open', event: 'presentation.explorer.drawing.activated' },
  ],
};

/** The actions of a group, in the order its ⋯ menu shows them; a group with none shows no ⋯. */
const GROUP_MENU: Record<ExplorerGroupId, ActionMenuTable> = {
  files: [
    { id: 'upload', label: 'explorer.menu.upload', event: 'presentation.explorer.file.upload.requested' },
  ],
  models: [],
  drawings: [],
};

/** The actions of a directory, in the order its ⋯ menu shows them: it only takes uploads. */
const DIRECTORY_MENU: ActionMenuTable = [
  { id: 'upload', label: 'explorer.menu.upload', event: 'presentation.explorer.file.upload.requested' },
];

/** The header of every group opens it and publishes its activation. */
const GROUP_HEADER: ActionMenuTable = [
  { id: 'open', label: 'explorer.menu.open', event: 'presentation.explorer.group.activated' },
];

/**
 * Project explorer. Each group owns an independent tree that starts empty and
 * is (re)populated by its own event carrying `{ nodes }`: FILES by
 * `presentation.project.files.found`, the others by `presentation.project.<group>.found`.
 * The explorer only displays and reports what the user does: a double click or
 * a menu entry publishes `presentation.explorer.<file|model|drawing>.activated`,
 * and opening a group publishes `presentation.explorer.group.activated`.
 * What those mean is up to the listeners.
 */
export default function makeExplorer(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content tree-panel';

  const heading = document.createElement('div');
  heading.className = 'section-title explorer-title';
  const headingLabel = document.createElement('span');
  headingLabel.dataset.i18n = 'explorer.title';
  heading.appendChild(headingLabel);
  root.appendChild(heading);

  const moreMenu = createActionMenu(SOURCE);
  let selectedRow: HTMLLIElement | null = null;

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

  const openActionsMenu = (anchor: HTMLButtonElement, group: ExplorerGroupId, item: string, isDirectory: boolean): void => {
    if (isDirectory) moreMenu.show(anchor, DIRECTORY_MENU, { path: item });
    else moreMenu.show(anchor, ITEM_MENU[group], { item });
  };

  const select = (row: HTMLLIElement): void => {
    if (selectedRow && selectedRow !== row) selectedRow.classList.remove('selected');
    row.classList.add('selected');
    selectedRow = row;
  };

  const renderNodes = (
    nodes: ExplorerNode[],
    group: ExplorerGroupId,
    parentPath: string,
    depth: number,
  ): HTMLUListElement => {
    const list = document.createElement('ul');
    list.className = depth === 0 ? 'tree' : 'tree tree-children';
    list.setAttribute('role', depth === 0 ? 'tree' : 'group');

    for (const node of nodes) {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      const isDirectory = node.children !== undefined;

      const item = document.createElement('li');
      item.className = isDirectory ? 'tree-node dir' : 'tree-node file';
      item.dataset.path = path;
      item.setAttribute('role', 'treeitem');
      if (isDirectory) item.setAttribute('aria-expanded', 'false');

      const row = document.createElement('div');
      row.className = 'tree-row';
      row.style.setProperty('--depth', String(depth));

      const button = document.createElement('button');
      button.type = 'button';
      button.className = isDirectory ? 'tree-item dir' : 'tree-item';
      button.textContent = node.name;

      const more = document.createElement('button');
      more.className = 'tree-more';
      more.type = 'button';
      more.dataset.item = path;
      more.setAttribute('aria-label', translate('explorer.moreActions', { item: path }));
      more.textContent = '⋯';

      const children = isDirectory ? renderNodes(node.children ?? [], group, path, depth + 1) : null;
      if (children) children.hidden = true;

      button.addEventListener('click', () => {
        if (children) {
          children.hidden = !children.hidden;
          item.setAttribute('aria-expanded', String(!children.hidden));
        }
        select(item);
        moreMenu.close();
      });

      if (!isDirectory) {
        button.addEventListener('dblclick', () => {
          select(item);
          runAction(SOURCE, ITEM_MENU[group], 'open', { item: path });
        });
      }

      more.addEventListener('click', (event) => {
        event.stopPropagation();
        if (moreMenu.isOpen()) { moreMenu.close(); return; }
        openActionsMenu(more, group, path, isDirectory);
      });

      row.append(button, more);
      item.appendChild(row);
      if (children) item.appendChild(children);
      list.appendChild(item);
    }
    return list;
  };

  const groupBodies = new Map<ExplorerGroupId, HTMLDivElement>();

  const renderGroup = (group: ExplorerGroupId, nodes: ExplorerNode[]): void => {
    const body = groupBodies.get(group);
    if (!body) return;
    if (selectedRow && body.contains(selectedRow)) selectedRow = null;
    moreMenu.close();
    if (nodes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.dataset.i18n = 'explorer.empty';
      empty.textContent = translate('explorer.empty');
      body.replaceChildren(empty);
    } else {
      body.replaceChildren(renderNodes(nodes, group, '', 0));
    }
  };

  // One group open at a time.
  const sections = new Map<ExplorerGroupId, HTMLDetailsElement>();
  EXPLORER_GROUPS.forEach((group, index) => {
    const section = document.createElement('details');
    section.open = index === 0;
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'tree-group-label';
    label.dataset.i18n = group.label;
    summary.appendChild(label);

    const menu = GROUP_MENU[group.id];
    if (menu.length > 0) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'tree-group-more';
      more.dataset.group = group.id;
      more.setAttribute('aria-label', translate('explorer.files.actions'));
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        if (moreMenu.isOpen()) { moreMenu.close(); return; }
        moreMenu.show(more, menu, { path: '' });
      });
      summary.appendChild(more);
    }
    section.appendChild(summary);

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (section.open) return;
      for (const other of sections.values()) other.open = false;
      section.open = true;
      runAction(SOURCE, GROUP_HEADER, 'open', { group: group.id });
    });

    const body = document.createElement('div');
    body.className = 'tree-group-body';
    section.appendChild(body);
    root.appendChild(section);
    groupBodies.set(group.id, body);
    sections.set(group.id, section);
    renderGroup(group.id, []);
  });

  applyTranslations(root);

  const nodesOf = (payload: { nodes?: ExplorerNode[] } | undefined): ExplorerNode[] =>
    Array.isArray(payload?.nodes) ? payload.nodes : [];

  const unsubscribers = [
    eventBus.subscribe('presentation.project.local.opened', activate),
    eventBus.subscribe('presentation.project.remote.opened', activate),
    eventBus.subscribe('presentation.project.state.reported', ({ payload }) => {
      if (payload?.project) activate();
    }),
    eventBus.subscribe('presentation.project.files.found', (event) => renderGroup('files', nodesOf(event.payload))),
    eventBus.subscribe('presentation.project.models.found', (event) => renderGroup('models', nodesOf(event.payload))),
    eventBus.subscribe('presentation.project.drawings.found', (event) => renderGroup('drawings', nodesOf(event.payload))),
    // Translate in place so populated trees and the selection survive a locale switch.
    onLocaleChange(() => {
      applyTranslations(root);
      root.querySelectorAll<HTMLButtonElement>('.tree-more').forEach((button) => {
        button.setAttribute('aria-label', translate('explorer.moreActions', { item: button.dataset.item ?? '' }));
      });
    }),
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
