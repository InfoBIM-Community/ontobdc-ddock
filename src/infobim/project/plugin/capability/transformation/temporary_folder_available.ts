import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Creates the temporary folder the connection works in, in storage the browser can access. */
export class TemporaryFolderAvailableCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.temporary_folder_available',
    description: 'Create a temporary folder the browser can access.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const name = `remote-${context.requestId}`;
    const storage = await navigator.storage.getDirectory();
    const folder = await storage.getDirectoryHandle(name, { create: true });
    context.etl.write('remote_project_connection', context.requestId, context.state, {
      phase: 'done',
      entity: { name },
      result: { storage, folder, name },
    });
  }
}
