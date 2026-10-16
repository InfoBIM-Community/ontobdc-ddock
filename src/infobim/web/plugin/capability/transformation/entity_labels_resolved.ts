import { keepApplied, nameIn, panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the labels from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Names the fields of the entity tab after the facade, in the language of the
 * interface. A field the facade does not name keeps the label the tab drew.
 */
export class EntityLabelsResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_labels_resolved',
    description: 'Replace the labels of the entity fields with the names the facade gives them, in the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const byIdentifier = new Map(facade.fields.map((field) => [field.identifier, field]));
    const locale = await keepApplied(panel, watching, (current) => {
      for (const term of panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-field]')) {
        const field = byIdentifier.get(term.dataset.field ?? '');
        const label = field ? nameIn(field.labels, current) : undefined;
        if (label) term.textContent = label;
      }
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { locale, labels: facade.fields.map((field) => field.identifier) },
    });
  }
}
