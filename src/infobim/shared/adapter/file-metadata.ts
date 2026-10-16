import type { CapabilityContext } from '@/infobim/shared/domain/model/capability';

export type FileMetadata = { path?: string; extension?: string; type?: string };

/** What `file_metadata_extracted` left in the ETL for the file being opened. */
export function fileMetadataOf(context: CapabilityContext): FileMetadata | undefined {
  const record = context.etl.read('explorer_file_open', context.requestId, 'file_metadata_extracted');
  return record?.result as FileMetadata | undefined;
}

/** Asks the surface for a tab with id `<prefix>:<path>` that shows the file in the panel `component`. */
export function openFileTabRequest(
  context: CapabilityContext,
  prefix: string,
  component: string,
): { container: string; id: string; component: string; title: string } {
  const item = context.parameters.item;
  if (!item) throw new Error('No file was activated.');
  return { container: 'surface', id: `${prefix}:${item}`, component, title: item.split('/').pop() ?? item };
}
