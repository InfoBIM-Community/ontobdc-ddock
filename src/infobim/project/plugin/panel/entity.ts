import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import type { Mountable } from '@/infobim/shared/adapter/view';
import type { EntityField } from '@/infobim/shared/domain/model/entity';
import type { MessageKey } from '@/infobim/shared/plugin/i18n';
import { applyTranslations, getLocale, onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

const SOURCE = 'entity';
const ID_PREFIX = 'entity:';

/**
 * The name of a field in the current language: the one the ontology gives in
 * the locale (`pt-br`), else in its language (`pt`), else English, else the
 * identifier the data source has.
 */
function fieldLabel(field: EntityField, locale: string): string {
  const tag = locale.toLowerCase();
  return field.labels[tag] ?? field.labels[tag.split('-')[0]] ?? field.labels.en ?? field.name;
}

type Action = 'edit' | 'save' | 'discard' | 'delete';

const ACTIONS: Array<{ action: Action; icon: string; label: MessageKey }> = [
  { action: 'edit', icon: '<path d="M10.5 2.5l3 3-7.5 7.5H3v-3z"/><path d="M9 4l3 3"/>', label: 'entity.action.edit' },
  { action: 'save', icon: '<path d="M3 2h8l2 2v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M5 2v4h5V2M5 14v-4h6v4"/>', label: 'annotations.menu.save' },
  { action: 'discard', icon: '<path d="M3 6h6a3.5 3.5 0 0 1 0 7H6"/><path d="M5.5 3.5 3 6l2.5 2.5"/>', label: 'annotations.menu.discard' },
  { action: 'delete', icon: '<path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/><path d="M6.5 6.5v5M9.5 6.5v5"/>', label: 'annotations.menu.delete' },
];

/**
 * A Surface tab with one entity of the database: its type, the dataset that
 * keeps it and every field its data source holds, whatever they are. The
 * fields are what `infobim project --entity` lists for the entity, so a new
 * kind of entity shows up here with nothing to change. The Dockview panel id is
 * `entity:<global id>`. The Edit, Save, Discard and Delete buttons are there
 * but disabled; the entity facade setup enables Edit when the facade declares an
 * editable field, and Edit then publishes `presentation.entity.edit.requested`
 * with the id; Delete is enabled the same way when the facade says its instances can
 * be deleted, and publishes `presentation.entity.delete.requested`. Nothing else
 * changes an entity yet. Closing the tab
 * publishes `presentation.main.entity.closed` with the id.
 */
export default function makeEntity({ id }: { id: string }): Mountable {
  const globalId = id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id;

  const root = document.createElement('div');
  root.id = `entity-panel:${encodeURIComponent(globalId)}`;
  root.className = 'panel-content entity-viewer';
  root.tabIndex = -1; // focusable, so a click in the tab activates it

  const actions = document.createElement('div');
  actions.className = 'annotation-actions';
  const buttons = ACTIONS.map(({ action, icon, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `annotation-action ${action}`;
    button.dataset.action = action;
    button.disabled = true;
    button.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
    return { button, label };
  });
  actions.append(...buttons.map(({ button }) => button));

  const render = (): void => {
    for (const { button, label } of buttons) {
      button.title = translate(label);
      button.setAttribute('aria-label', translate(label));
    }

    // While the entity is being edited the fields are what the person is typing: drawing them again would lose it.
    if (root.dataset.mode === 'editing') return;

    const found = EntityRepository.getInstance().find(globalId);
    actions.hidden = !found;
    root.dataset.state = found ? 'ready' : 'missing';
    if (!found) {
      const missing = document.createElement('p');
      missing.className = 'entity-missing';
      missing.dataset.i18n = 'entity.viewer.missing';
      missing.textContent = translate('entity.viewer.missing');
      root.replaceChildren(actions, missing);
      applyTranslations(root);
      return;
    }

    const { group, item } = found;
    const header = document.createElement('header');
    if (item.type) {
      const type = document.createElement('span');
      type.className = 'entity-type';
      type.textContent = item.type;
      header.append(type);
    }
    const title = document.createElement('h2');
    title.className = 'entity-title';
    title.textContent = item.name || item.id;
    const dataset = document.createElement('p');
    dataset.className = 'entity-dataset';
    dataset.textContent = translate('entity.viewer.dataset', { dataset: group.title });
    header.append(title, dataset);

    const fields = document.createElement('dl');
    fields.className = 'entity-fields';
    for (const field of item.fields) {
      // Stable across locale changes and renders; unique across entity tabs.
      const fieldId = `entity-field:${encodeURIComponent(globalId)}:${encodeURIComponent(field.name)}`;
      const term = document.createElement('dt');
      term.id = `${fieldId}:label`;
      term.textContent = fieldLabel(field, getLocale());
      term.title = field.name;
      term.dataset.field = field.name;
      const detail = document.createElement('dd');
      detail.id = `${fieldId}:value`;
      detail.setAttribute('aria-labelledby', term.id);
      if (field.values.length === 0) {
        detail.className = 'entity-empty';
        detail.textContent = '—';
      } else if (field.values.length === 1) {
        detail.textContent = field.values[0];
      } else {
        const list = document.createElement('ul');
        for (const value of field.values) {
          const entry = document.createElement('li');
          entry.textContent = value;
          list.append(entry);
        }
        detail.append(list);
      }
      fields.append(term, detail);
    }

    root.replaceChildren(actions, header, fields);
    applyTranslations(root);
  };

  render();

  const unsubscribers = [
    // The lists were read again: the entity is what the CLI answered last.
    eventBus.subscribe('presentation.project.entities.found', render),
    onLocaleChange(render),
  ];

  return {
    element: root,
    mounted: () => {
      eventBus.publish('presentation.main.panel.entity.opened', SOURCE, { id: globalId, panelId: root.id });
    },
    dispose: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      root.remove();
      eventBus.publish('presentation.main.entity.closed', SOURCE, { id: globalId });
    },
  };
}
