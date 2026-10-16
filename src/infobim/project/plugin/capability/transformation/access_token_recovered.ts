import { AccessTokenRepository } from '@/infobim/shared/adapter/access-token';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Settles the access token: the one given, or else the one remembered in the cookie. */
export class AccessTokenRecoveredCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.access_token_recovered',
    description: 'Use the given access token or recover the remembered one from the cookie.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const given = context.parameters.apiToken;
    const url = context.parameters.url;
    const recovered = given || !url ? undefined : new AccessTokenRepository().get(url);
    context.etl.write('remote_project_connection', context.requestId, context.state, {
      phase: 'done',
      entity: { source: given ? 'given' : recovered ? 'cookie' : 'none' },
      result: { apiToken: given || recovered },
    });
  }
}
