import { keepApplied, nameIn } from '@/infobim/shared/adapter/facade-labels';
import { GROUP_TABLE_MACHINE, bodyCells, tableAndFacade } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per table panel: what stops the names from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Shows the cells of the fields whose values are the subclasses of a class with
 * the name of the subclass in the language of the interface, instead of its
 * identifier, as the entity tab does. The identifier drawn is kept on the
 * element, so the name is always taken from the value.
 */
export class TableSubclassesResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_subclasses_resolved',
    description: 'Show the columns whose values are subclasses of a class with the name of the subclass in the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = tableAndFacade(context);
    const named = facade.fields.filter((field) => Object.keys(field.option_labels ?? {}).length > 0);

    await keepApplied(panel, watching, (locale) => {
      for (const field of named) {
        for (const cell of bodyCells(panel, field.identifier)) {
          const box = cell.querySelector<HTMLElement>('.cell');
          if (!box || cell.classList.contains('entity-empty')) continue;
          box.dataset.subclass ??= box.textContent ?? '';
          box.textContent = nameIn(field.option_labels![box.dataset.subclass], locale) ?? box.dataset.subclass;
          box.title = box.textContent;
        }
      }
    });

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { fields: named.map((field) => field.identifier) },
    });
  }
}
