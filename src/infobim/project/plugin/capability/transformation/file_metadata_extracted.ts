import { readProjectFile } from '@/infobim/shared/adapter/project-file';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/**
 * Reads the activated file from the opened project folder and extracts its
 * metadata so the next state can decide how to open it.
 */
export class FileMetadataExtractedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.file_metadata_extracted',
    description: 'Read the activated file and extract its metadata.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const item = context.parameters.item;
    if (!item) throw new Error('No file was activated.');

    const project = ProjectRepository.getInstance().get();
    if (!project?.folder) throw new Error('No project is open.');

    const file = await readProjectFile(project.folder, item);
    const metadata = {
      path: item,
      name: file.name,
      extension: file.name.split('.').pop()?.toLowerCase() ?? '',
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
    };

    context.etl.write('explorer_file_open', context.requestId, context.state, {
      phase: 'done',
      entity: { path: item },
      result: metadata,
    });
  }
}
