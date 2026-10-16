import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const SOURCE = 'entity_deletability_resolved';

/** Per entity panel: what takes the Delete button back to how the tab drew it, replaced when the tab is set up again. */
const enabled = new WeakMap<HTMLElement, () => void>();

/**
 * An instance of an entity can be deleted when its facade says so
 * (`isDeletable`); a facade that does not say so forbids it. When it can, the
 * Delete button of the tab is enabled, and pressing it publishes
 * `presentation.entity.delete.requested` with the id of the entity. Nothing is
 * deleted here.
 */
export class EntityDeletabilityResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_deletability_resolved',
    description: 'Enable the Delete button of the entity tab when the facade says its instances can be deleted, and request the deletion when it is pressed.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const id = context.parameters.id as string;
    const button = panel.querySelector<HTMLButtonElement>('button[data-action="delete"]');
    if (!button) throw new Error(`The entity panel of ${id} has no Delete button.`);

    enabled.get(panel)?.();
    const deletable = facade.deletable === true;
    if (deletable) {
      const request = (): void => { eventBus.publish('presentation.entity.delete.requested', SOURCE, { id }); };
      button.disabled = false;
      button.addEventListener('click', request);
      enabled.set(panel, () => {
        button.removeEventListener('click', request);
        button.disabled = true;
      });
    }

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id, panelId: context.parameters.panelId },
      result: { deletable },
    });
  }
}
