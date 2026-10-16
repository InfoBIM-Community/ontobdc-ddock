import { documentTitle } from '@/infobim/shared/adapter/document-iri';
import { keepApplied, panelAndFacade, type FacadeField } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the resolved values from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/** Separates the values that a list field holds. */
const SEPARATOR = '|';

/** What the field holds, as the panel drew it: its items when it has several, else its text. Kept on the element once read. */
function rawOf(detail: HTMLElement): string[] {
  if (detail.dataset.raw !== undefined) return JSON.parse(detail.dataset.raw) as string[];
  const items = [...detail.querySelectorAll('li')].map((item) => item.textContent ?? '');
  const raw = items.length > 0 ? items : [detail.textContent ?? ''];
  detail.dataset.raw = JSON.stringify(raw);
  return raw;
}

/**
 * Settles how the fields of a facade that need more than text are shown.
 *
 * - A field that holds a list (`multivalued`) is split at `|` and shown as an
 *   HTML list, one item for each value, even when it has a single one.
 * - A field whose facade has a resource facade with a `title` points to
 *   resources: each value is shown by the title of the resource (for a
 *   document, the name of its file) and keeps its IRI as the tooltip. A value
 *   that names no document stays as it is.
 *
 * Every other field is left as the panel drew it.
 */
export class EntityResourceFieldsResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_resource_fields_resolved',
    description: 'Show the list fields as lists, split at the separator, and the fields that have a resource facade by the title of the resource.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const fields = new Map<string, FacadeField>(facade.fields.map((field) => [field.identifier, field]));
    const handled = facade.fields
      .filter((field) => field.multivalued === true || this.titled(field))
      .map((field) => field.identifier);

    await keepApplied(panel, watching, () => {
      for (const term of panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-field]')) {
        const field = fields.get(term.dataset.field ?? '');
        const detail = term.nextElementSibling as HTMLElement | null;
        if (!field || !detail || detail.classList.contains('entity-empty')) continue;
        if (field.multivalued !== true && !this.titled(field)) continue;

        const raw = rawOf(detail);
        const values = (field.multivalued === true ? raw.flatMap((text) => text.split(SEPARATOR)) : raw)
          .map((text) => text.trim())
          .filter(Boolean);
        if (values.length === 0) continue;

        const shown = (value: string): string => (this.titled(field) ? documentTitle(value) ?? value : value);
        if (field.multivalued === true) {
          const list = document.createElement('ul');
          list.append(...values.map((value) => {
            const item = document.createElement('li');
            item.textContent = shown(value);
            if (shown(value) !== value) item.title = value;
            return item;
          }));
          detail.replaceChildren(list);
        } else {
          detail.textContent = shown(values[0]);
          if (shown(values[0]) !== values[0]) detail.title = values[0];
        }
      }
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { fields: handled },
    });
  }

  /** The facade of the resources the field points to exposes a title. */
  private titled(field: FacadeField): boolean {
    return field.resource_facade?.fields.some((resource) => resource.identifier === 'title') === true;
  }
}
