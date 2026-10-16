import { documentTitle } from '@/infobim/shared/adapter/document-iri';
import { keepApplied, type FacadeField } from '@/infobim/shared/adapter/facade-labels';
import { GROUP_TABLE_MACHINE, bodyCells, tableAndFacade } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per table panel: what stops the resolved values from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/** Separates the values that a list field holds. */
const SEPARATOR = '|';

/** The facade of the resources the field points to exposes a title. */
const titled = (field: FacadeField): boolean => field.resource_facade?.fields.some((resource) => resource.identifier === 'title') === true;

/**
 * Settles how the cells of the fields that need more than text are shown, as
 * the entity tab does: a list field (`multivalued`) is split at `|`, and a
 * field whose facade has a resource facade with a `title` shows each value by
 * the title of its resource (for a document, the name of its file). The values
 * of a cell are shown separated by commas, and the whole text is its tooltip.
 */
export class TableResourceFieldsResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_resource_fields_resolved',
    description: 'Show the list columns split at the separator, and the columns that have a resource facade by the title of the resource.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = tableAndFacade(context);
    const handled = facade.fields.filter((field) => field.multivalued === true || titled(field));

    await keepApplied(panel, watching, () => {
      for (const field of handled) {
        for (const cell of bodyCells(panel, field.identifier)) {
          const box = cell.querySelector<HTMLElement>('.cell');
          if (!box || cell.classList.contains('entity-empty')) continue;
          box.dataset.raw ??= box.textContent ?? '';
          const values = (field.multivalued === true ? box.dataset.raw.split(SEPARATOR) : [box.dataset.raw])
            .map((text) => text.trim())
            .filter(Boolean);
          if (values.length === 0) continue;
          const shown = values.map((value) => (titled(field) ? documentTitle(value) ?? value : value));
          box.textContent = shown.join(', ');
          box.title = values.join('\n');
        }
      }
    });

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { fields: handled.map((field) => field.identifier) },
    });
  }
}
