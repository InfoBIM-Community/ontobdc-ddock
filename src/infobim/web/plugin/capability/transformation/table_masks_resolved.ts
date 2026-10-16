import { maskFor } from '@/infobim/shared/adapter/mask_by_datatype';
import { keepApplied, nameIn } from '@/infobim/shared/adapter/facade-labels';
import { GROUP_TABLE_MACHINE, bodyCells, tableAndFacade } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per table panel: what stops the masks from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Shows the cells of the fields that have a mask (`csvw:format`) with the mask
 * of the language of the interface, with the same files the entity tab uses
 * (the table of `mask_by_datatype`). A field of a datatype with no mask, a
 * language the field has no mask for, or a value the mask does not understand
 * is left as it was drawn. The value drawn is kept on the element, so the mask
 * is always applied to the value and never to a text already masked.
 */
export class TableMasksResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_masks_resolved',
    description: 'Show the columns that have a mask with the mask of the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = tableAndFacade(context);
    const masked = facade.fields.filter((field) => maskFor(field.datatype) !== undefined && Object.keys(field.formats ?? {}).length > 0);

    await keepApplied(panel, watching, (locale) => {
      for (const field of masked) {
        const mask = nameIn(field.formats, locale);
        if (!mask) continue;
        for (const cell of bodyCells(panel, field.identifier)) {
          const box = cell.querySelector<HTMLElement>('.cell');
          if (!box || cell.classList.contains('entity-empty')) continue;
          box.dataset.value ??= box.textContent ?? '';
          box.textContent = maskFor(field.datatype)!(box.dataset.value, mask);
          box.title = box.textContent;
        }
      }
    });

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { fields: masked.map((field) => field.identifier) },
    });
  }
}
