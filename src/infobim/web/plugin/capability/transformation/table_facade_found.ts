import { quoted, requestCommand } from '@/infobim/shared/adapter/command-request';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { GROUP_TABLE_MACHINE } from '@/infobim/shared/adapter/facade-table';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

export class TableFacadeFoundCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_facade_found',
    description: 'Inspect the facade of the entity a group holds, in BrasidataCenter, through the command execution pipeline.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { id, panelId } = context.parameters;
    if (!id) throw new Error('Group facade lookup requires a group id.');
    const group = EntityRepository.getInstance().findGroup(id);
    const entityType = group?.entityTypes[0] || group?.items[0]?.type;
    if (!entityType) throw new Error(`The group ${id} has no known entity type for facade lookup.`);
    const result = await requestCommand(`infobim context --entity ${quoted(entityType)} --inspect`, 'table_facade_found');
    const response = result.stdout;
    const facade = response && typeof response === 'object' && !Array.isArray(response) ? response.content : null;
    if (!facade || typeof facade !== 'object' || Array.isArray(facade)
      || typeof facade.identifier !== 'string' || !Array.isArray(facade.fields)) {
      throw new Error(`The facade inspection returned no facade for group ${id}.`);
    }
    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done', entity: { id, panelId, entityType }, result: { facade, command: result },
    });
  }
}
