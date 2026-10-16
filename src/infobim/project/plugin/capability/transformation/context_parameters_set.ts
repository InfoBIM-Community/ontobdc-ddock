import { ContextRepository } from '@/infobim/shared/adapter/context';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import { accessTokenOf, folderOf } from './folder';

/** Puts the parameters of the connection in the context.ttl of the temporary folder. */
export class ContextParametersSetCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.context_parameters_set',
    description: 'Set the API token of the connection in context.ttl.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { folder } = folderOf(context);
    const set: string[] = [];
    const apiToken = accessTokenOf(context);
    if (apiToken) {
      await new ContextRepository(folder).set('remote_api_token', apiToken);
      set.push('remote_api_token');
    }
    context.etl.write('remote_project_connection', context.requestId, context.state, {
      phase: 'done',
      entity: { set },
      result: null,
    });
  }
}
