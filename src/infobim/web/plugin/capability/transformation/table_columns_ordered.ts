import { keepApplied } from '@/infobim/shared/adapter/facade-labels';
import { GROUP_TABLE_MACHINE, tableAndFacade } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per table panel: what stops the order from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Puts the columns of the table in the order the facade gives its fields. A
 * column the facade does not declare goes after those it does, in the order it
 * had. It is kept when the table is drawn again.
 */
export class TableColumnsOrderedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_columns_ordered',
    description: 'Put the columns of the table in the order the facade gives its fields.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = tableAndFacade(context);
    const position = new Map(
      [...facade.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((field, index) => [field.identifier, index]),
    );

    await keepApplied(panel, watching, () => {
      for (const row of panel.querySelectorAll<HTMLTableRowElement>('tr')) {
        const cells = [...row.cells];
        const ranked = cells
          .map((cell, index) => ({ cell, index, rank: position.get(cell.dataset.field ?? '') ?? position.size }))
          .sort((a, b) => a.rank - b.rank || a.index - b.index);
        if (ranked.some(({ cell }, index) => cell !== cells[index])) row.append(...ranked.map(({ cell }) => cell));
      }
    });

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { order: [...position.keys()] },
    });
  }
}
