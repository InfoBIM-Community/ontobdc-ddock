import { keepApplied, nameIn } from '@/infobim/shared/adapter/facade-labels';
import { GROUP_TABLE_MACHINE, tableAndFacade } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per table panel: what stops the names from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Names the columns of the table after the facade, in the language of the
 * interface. A column the facade does not name keeps the name the table drew.
 */
export class TableLabelsResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_labels_resolved',
    description: 'Name the columns of the table after the facade, in the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = tableAndFacade(context);
    const byIdentifier = new Map(facade.fields.map((field) => [field.identifier, field]));

    const locale = await keepApplied(panel, watching, (current) => {
      for (const column of panel.querySelectorAll<HTMLElement>('thead th[data-field]')) {
        const field = byIdentifier.get(column.dataset.field ?? '');
        const label = field ? nameIn(field.labels, current) : undefined;
        if (label) column.textContent = label;
      }
    });

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { locale, labels: facade.fields.map((field) => field.identifier) },
    });
  }
}
