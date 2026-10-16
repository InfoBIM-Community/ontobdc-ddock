import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { editorFor } from '@/infobim/shared/adapter/editor_by_datatype';
import type { Editor } from '@/infobim/shared/adapter/editor/editor';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { nameIn } from '@/infobim/shared/adapter/facade-labels';
import { getLocale, onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

const SOURCE = 'entity_editing';

/** The tab of an entity, by the id the panel gives itself. */
export const panelOf = (id: string): HTMLElement | null => document.getElementById(`entity-panel:${encodeURIComponent(id)}`);

type Session = { end(): void };
/** The editing in progress, by entity id: a tab is edited once at a time. */
const sessions = new Map<string, Session>();

/**
 * Turns the fields of an entity tab that can be changed into editors, and the
 * Save and Discard buttons on. The fields are the ones marked `data-editable`
 * in the tab; each is edited with the editor of its datatype, starting from the
 * value the entity has (not from what is shown, which a mask may have changed).
 *
 * Save is on once something changed and everything is valid; it publishes
 * `presentation.entity.save.requested` with the fields that changed. Discard
 * puts the tab back as it was and publishes `presentation.entity.edit.cancelled`.
 * `presentation.entity.saved` ends the editing too, leaving the tab to be drawn
 * again with the saved values. While it lasts, the tab does not draw itself again.
 */
export async function startEditing(id: string): Promise<void> {
  const panel = panelOf(id);
  if (!panel || sessions.has(id)) return;

  const item = EntityRepository.getInstance().find(id)?.item;
  const terms = [...panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-editable="true"]')];
  if (!item || terms.length === 0) return;

  const save = panel.querySelector<HTMLButtonElement>('button[data-action="save"]');
  const discard = panel.querySelector<HTMLButtonElement>('button[data-action="discard"]');
  const edit = panel.querySelector<HTMLButtonElement>('button[data-action="edit"]');
  const remove = panel.querySelector<HTMLButtonElement>('button[data-action="delete"]');
  if (!save || !discard || !edit || !remove) throw new Error(`The entity tab of ${id} lacks its buttons.`);

  panel.dataset.mode = 'editing';
  const original = new Map<HTMLElement, Node[]>();
  const editors = new Map<string, { editor: Editor; initial: string; term: HTMLElement; required: boolean }>();

  for (const term of terms) {
    const name = term.dataset.field ?? '';
    const detail = term.nextElementSibling as HTMLElement | null;
    if (!detail) continue;
    const initial = item.fields.find((field) => field.name === name)?.values[0] ?? '';
    const options = term.dataset.options ? (JSON.parse(term.dataset.options) as string[]) : undefined;
    const optionLabels = term.dataset.optionLabels
      ? Object.fromEntries(Object.entries(JSON.parse(term.dataset.optionLabels) as Record<string, Record<string, string>>)
        .flatMap(([option, names]) => { const shown = nameIn(names, getLocale()); return shown ? [[option, shown]] : []; }))
      : undefined;
    const editor = (await editorFor(term.dataset.datatype, options, term.dataset.multivalued === 'true'))({
      value: initial,
      datatype: term.dataset.datatype ?? '',
      label: term.textContent ?? name,
      options,
      optionLabels,
      multivalued: term.dataset.multivalued === 'true',
      documents: term.dataset.documents === 'true',
      owner: id,
      field: name,
    });
    original.set(detail, [...detail.childNodes]);
    detail.replaceChildren(editor.element);
    editors.set(name, { editor, initial, term, required: term.dataset.required === 'true' });
  }

  const changes = (): Record<string, string> => Object.fromEntries(
    [...editors].filter(([, { editor, initial }]) => editor.value() !== initial).map(([name, { editor }]) => [name, editor.value()]),
  );
  const valid = (): boolean => [...editors.values()].every(({ editor, required }) => editor.isValid() && (!required || editor.value().trim() !== ''));
  const refresh = (): void => {
    for (const { editor, required } of editors.values()) {
      const ok = editor.isValid() && (!required || editor.value().trim() !== '');
      editor.element.toggleAttribute('aria-invalid', !ok);
    }
    save.disabled = Object.keys(changes()).length === 0 || !valid();
  };
  const titles = (): void => {
    save.title = translate('annotations.menu.save');
    discard.title = translate('annotations.menu.discard');
  };

  const onSave = (): void => {
    if (!valid()) return;
    eventBus.publish('presentation.entity.save.requested', SOURCE, { id, changes: changes() });
  };
  const onDiscard = (): void => {
    restore();
    eventBus.publish('presentation.entity.edit.cancelled', SOURCE, { id });
  };

  const unsubscribers = [
    onLocaleChange(titles),
    eventBus.subscribe('presentation.entity.saved', ({ payload }) => { if (payload?.id === id) finish(); }),
  ];
  const finish = (): void => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    save.removeEventListener('click', onSave);
    discard.removeEventListener('click', onDiscard);
    save.disabled = discard.disabled = true;
    edit.disabled = false;
    remove.disabled = remove.dataset.deletable !== 'true';
    delete panel.dataset.mode;
    sessions.delete(id);
  };
  /** Puts the fields back as they were drawn. */
  const restore = (): void => {
    for (const [detail, nodes] of original) detail.replaceChildren(...nodes);
    finish();
  };

  for (const { editor } of editors.values()) editor.onChange(refresh);
  save.addEventListener('click', onSave);
  discard.addEventListener('click', onDiscard);
  edit.disabled = true;
  remove.dataset.deletable = String(!remove.disabled);
  remove.disabled = true;
  discard.disabled = false;
  save.disabled = true;
  sessions.set(id, { end: restore });
  refresh();
  [...editors.values()][0]?.editor.element.focus();
}

/** Ends the editing of an entity, discarding what was typed. Nothing happens if it is not being edited. */
export function stopEditing(id: string): void {
  sessions.get(id)?.end();
}
