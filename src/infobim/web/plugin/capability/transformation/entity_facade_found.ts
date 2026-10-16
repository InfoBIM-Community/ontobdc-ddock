import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

export class EntityFacadeFoundCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_facade_found',
    description: 'Inspect the entity facade in BrasidataCenter through the command execution pipeline.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { id, panelId } = context.parameters;
    if (!id) throw new Error('Entity facade lookup requires an entity id.');
    const entityType = EntityRepository.getInstance().find(id)?.item.type;
    if (!entityType) throw new Error(`The entity ${id} has no known type for facade lookup.`);
    const result = await requestCommand(`infobim context --entity ${quoted(entityType)} --inspect`, 'entity_facade_found');
    const response = result.stdout;
    const facade = response && typeof response === 'object' && !Array.isArray(response) ? response.content : null;
    if (!facade || typeof facade !== 'object' || Array.isArray(facade)
      || typeof facade.identifier !== 'string' || !Array.isArray(facade.fields)) {
      throw new Error(`The facade inspection returned no facade for entity ${id}.`);
    }
    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done', entity: { id, panelId, entityType }, result: { facade, command: result },
    });
  }
}
