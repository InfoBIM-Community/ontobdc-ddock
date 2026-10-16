import { keepApplied, panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the order from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Puts the fields of the entity tab in the order the facade gives them. A
 * field the facade does not declare goes after the declared ones, in the order
 * the tab drew them.
 */
export class EntityFieldsOrderedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_fields_ordered',
    description: 'Put the fields of the entity tab in the order the facade declares.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const rank = new Map(
      [...facade.fields]
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
        .map((field, position) => [field.identifier, position]),
    );
    const undeclared = rank.size;
    await keepApplied(panel, watching, () => {
      const list = panel.querySelector<HTMLElement>('.entity-fields');
      if (!list) return;
      // A field is a term followed by its detail; the sort is stable, so undeclared fields keep their order.
      const pairs = [...list.querySelectorAll<HTMLElement>('dt[data-field]')]
        .map((term) => ({ term, detail: term.nextElementSibling as HTMLElement | null, position: rank.get(term.dataset.field ?? '') ?? undeclared }))
        .sort((a, b) => a.position - b.position);
      list.append(...pairs.flatMap(({ term, detail }) => (detail ? [term, detail] : [term])));
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { order: [...rank.keys()] },
    });
  }
}
