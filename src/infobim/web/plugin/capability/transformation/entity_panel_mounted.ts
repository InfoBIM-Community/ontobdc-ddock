import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Confirms the entity panel and its fields are mounted before facade setup. */
export class EntityPanelMountedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_panel_mounted',
    description: 'Locate the mounted entity panel and its addressable field elements.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { id, panelId } = context.parameters;
    if (!id || !panelId) throw new Error('Entity facade setup requires entity and panel ids.');
    const panel = document.getElementById(panelId);
    if (!panel?.isConnected) throw new Error(`The entity panel ${panelId} is not mounted.`);
    if (panel.dataset.state !== 'ready') throw new Error(`The entity ${id} has no rendered fields.`);

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id, panelId },
      result: { fields: Array.from(panel.querySelectorAll('.entity-fields dd'), (field) => field.id) },
    });
  }
}
