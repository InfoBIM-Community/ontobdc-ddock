import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { createMoreMenu, type MenuAction } from '@/infobim/shared/adapter/more-menu';
import type { AppEventMap, AppEventType } from '@/infobim/shared/domain/model/event';
import { translate, type MessageKey } from '@/infobim/shared/plugin/i18n';

/** One entry of the ⋯ menu a panel declares: the label it shows and the event it publishes. */
export type ActionMenuOption = {
  id: string;
  label: MessageKey;
  event: AppEventType;
  shortcut?: MessageKey;
  disabled?: boolean;
};

/** The ⋯ menu a panel shows, in the order its options are shown. */
export type ActionMenuTable = readonly ActionMenuOption[];

export type ActionMenu = {
  /**
   * Opens the menu under `anchor` with the options of `table`, publishing the
   * event of the option that is chosen with `payload`. The table comes per
   * call because a panel may show a different menu for each item of its own
   * (the explorer, one per group), and one menu is enough for all of them.
   */
  show(anchor: HTMLElement, table: ActionMenuTable, payload: unknown): void;
  close(): void;
  isOpen(): boolean;
};

/**
 * The one logic every ⋯ button shares: a panel declares, in its own table, what
 * each option shows and which event it publishes; the menu translates the
 * labels, publishes the event of the chosen option with the payload the panel
 * gives, and keeps only one menu open at a time. It only reports; what the
 * events mean is up to the listeners.
 */
export function createActionMenu(source: string): ActionMenu {
  const menu = createMoreMenu();

  const actionsOf = (table: ActionMenuTable, payload: unknown): MenuAction[] =>
    table.map((option) => ({
      id: option.id,
      label: translate(option.label),
      shortcut: option.shortcut ? translate(option.shortcut) : undefined,
      disabled: option.disabled === true,
      run: () => publish(source, option.event, payload),
    }));

  return {
    show: (anchor, table, payload) => menu.show(anchor, actionsOf(table, payload)),
    close: () => menu.close(),
    isOpen: () => menu.isOpen(),
  };
}

/**
 * Publishes the event of option `id` of `table`, as if the person had chosen
 * it from the menu. The double click and the group header use it, so no panel
 * keeps an event name of its own outside its table.
 */
export function runAction(source: string, table: ActionMenuTable, id: string, payload: unknown): void {
  const option = table.find((entry) => entry.id === id);
  if (!option) throw new Error(`Unknown action: ${id}`);
  publish(source, option.event, payload);
}

/**
 * A table holds event names as data, so the type of the payload each one
 * carries only exists at runtime: publish it as the bus declares it.
 */
function publish(source: string, type: AppEventType, payload: unknown): void {
  eventBus.publish(type, source, payload as AppEventMap[AppEventType]);
}
