import type { PythonMount } from '@/infobim/shared/domain/model/python-command';
import type { CapabilityContext } from '@/infobim/shared/domain/model/capability';

/** The temporary folder the first state of the connection left in the ETL. */
export function folderOf(context: CapabilityContext): { folder: FileSystemDirectoryHandle; mount: PythonMount } {
  const record = context.etl.read('remote_project_connection', context.requestId, 'temporary_folder_available');
  const result = record?.result as { folder?: FileSystemDirectoryHandle; name?: string } | undefined;
  if (!result?.folder || !result.name) throw new Error('The temporary folder of the connection is not available.');
  return { folder: result.folder, mount: { path: `/storage/${result.name}`, handle: result.folder } };
}

/** The access token the first state settled, if there is one. */
export function accessTokenOf(context: CapabilityContext): string | undefined {
  const record = context.etl.read('remote_project_connection', context.requestId, 'access_token_recovered');
  return (record?.result as { apiToken?: string } | undefined)?.apiToken;
}
