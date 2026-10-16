/** What a list editor lets the listeners do to the items it shows. */
export type ListEditorHandle = {
  element: HTMLElement;
  remove(item: string): void;
  add(item: string): void;
};

const editors = new Map<string, ListEditorHandle>();
const keyOf = (owner: string, field: string): string => `${owner}\u0000${field}`;

/** Registers the list editor of a field of what is being edited; a field has one editor at a time. */
export function registerListEditor(owner: string, field: string, handle: ListEditorHandle): void {
  editors.set(keyOf(owner, field), handle);
}

/** The list editor of the field, as long as it is in the page. */
export function findListEditor(owner: string, field: string): ListEditorHandle | null {
  const handle = editors.get(keyOf(owner, field));
  if (handle && !handle.element.isConnected) {
    editors.delete(keyOf(owner, field));
    return null;
  }
  return handle ?? null;
}
