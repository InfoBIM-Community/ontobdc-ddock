/**
 * One entry of a ⋯ menu; a `disabledReason` disables it and says why, under its label.
 * An entry with `children` is a branch: it runs nothing itself, and a click expands
 * (or folds) its children right under it.
 */
export type MenuAction = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  run: () => void;
  children?: MenuAction[];
};

export type MoreMenu = {
  /** Opens the menu under `anchor`, closing any other the same instance has open. */
  show(anchor: HTMLElement, actions: MenuAction[]): void;
  close(): void;
  isOpen(): boolean;
};

/**
 * The popup menu a ⋯ button opens, shared by the trees. One instance keeps one
 * menu open at a time; it closes on a click anywhere else and on Escape.
 */
export function createMoreMenu(): MoreMenu {
  let open: { menu: HTMLDivElement; cleanup: () => void } | null = null;

  const close = (): void => {
    if (!open) return;
    open.cleanup();
    open.menu.remove();
    open = null;
  };

  const show = (anchor: HTMLElement, actions: MenuAction[]): void => {
    close();
    const menu = document.createElement('div');
    menu.className = 'tree-more-menu';
    menu.setAttribute('role', 'menu');
    const addRow = (act: MenuAction, depth: number, parentRow?: HTMLButtonElement): HTMLButtonElement => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = depth > 0 ? 'tree-more-menu-item child' : 'tree-more-menu-item';
      row.setAttribute('role', 'menuitem');
      row.dataset.action = act.id;
      row.disabled = act.disabled === true;
      if (parentRow) row.hidden = true;
      const labelSpan = document.createElement('span');
      labelSpan.className = 'tree-more-menu-label';
      labelSpan.textContent = act.label;
      row.appendChild(labelSpan);
      if (act.disabledReason) {
        row.disabled = true;
        row.title = act.disabledReason;
        const reason = document.createElement('span');
        reason.className = 'tree-more-menu-reason';
        reason.textContent = act.disabledReason;
        labelSpan.appendChild(reason);
      }
      if (act.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'tree-more-menu-shortcut';
        sc.textContent = act.shortcut;
        row.appendChild(sc);
      }
      menu.appendChild(row);
      if (act.children) {
        row.classList.add('branch');
        row.setAttribute('aria-haspopup', 'menu');
        row.setAttribute('aria-expanded', 'false');
        const children = act.children.map((child) => addRow(child, depth + 1, row));
        row.addEventListener('click', (me) => {
          if (row.disabled) return;
          me.stopPropagation();
          const expand = row.getAttribute('aria-expanded') !== 'true';
          row.setAttribute('aria-expanded', String(expand));
          for (const child of children) child.hidden = !expand;
        });
        return row;
      }
      row.addEventListener('click', (me) => {
        if (row.disabled) return;
        me.stopPropagation();
        close();
        act.run();
      });
      return row;
    };
    for (const act of actions) addRow(act, 0);
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 2}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    const onDocClick = (e: MouseEvent): void => {
      if (!(e.target instanceof Node)) return;
      if (menu.contains(e.target) || anchor.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    const cleanup = (): void => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
    open = { menu, cleanup };
  };

  return { show, close, isOpen: () => open !== null };
}
