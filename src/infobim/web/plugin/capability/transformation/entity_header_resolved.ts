import { keepApplied, nameIn, panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the header from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();

/**
 * Names the type in the header of the entity tab after the facade, in the
 * language of the interface. A facade with no name leaves the type the tab drew.
 */
export class EntityHeaderResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_header_resolved',
    description: 'Replace the type in the header of the entity tab with the name the facade gives it, in the current language.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const locale = await keepApplied(panel, watching, (current) => {
      const type = panel.querySelector<HTMLElement>('header .entity-type');
      const name = nameIn(facade.labels, current) ?? facade.name;
      if (type && name) type.textContent = name;
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id: context.parameters.id, panelId: context.parameters.panelId },
      result: { locale, name: nameIn(facade.labels, locale) ?? facade.name },
    });
  }
}
