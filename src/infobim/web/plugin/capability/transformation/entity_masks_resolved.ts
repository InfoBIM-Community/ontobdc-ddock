import { maskFor } from '@/infobim/shared/adapter/mask_by_datatype';
import { keepApplied, nameIn, panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the masks from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Shows the fields that have a mask (`csvw:format`) with the mask of the
 * language of the interface. A mask goes with the datatype of its field, and
 * the file that applies it is the one the table of `mask_by_datatype` names for
 * that datatype: a field of a datatype with no entry in the table, a language
 * the field has no mask for, or a value the mask does not understand is left as
 * it was drawn. The text drawn is kept on the element, so the mask is
 * always applied to the value and never to a text already masked.
 */
export class EntityMasksResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_masks_resolved',
    description: 'Show the fields that have a mask with the mask of the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const masked = new Map(
      facade.fields
        .filter((field) => maskFor(field.datatype) !== undefined && Object.keys(field.formats ?? {}).length > 0)
        .map((field) => [field.identifier, field]),
    );

    await keepApplied(panel, watching, (locale) => {
      for (const term of panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-field]')) {
        const field = masked.get(term.dataset.field ?? '');
        const detail = term.nextElementSibling as HTMLElement | null;
        if (!field || !detail || detail.classList.contains('entity-empty')) continue;

        const mask = nameIn(field.formats, locale);
        if (!mask) continue;
        const items = [...detail.querySelectorAll<HTMLElement>('li')];
        for (const element of items.length > 0 ? items : [detail]) {
          element.dataset.value ??= element.textContent ?? '';
          element.textContent = maskFor(field.datatype)!(element.dataset.value, mask);
        }
      }
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { fields: [...masked.keys()] },
    });
  }
}
