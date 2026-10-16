/** Resolves a slash-separated project path against a directory handle and reads the file. */
export async function readProjectFile(root: FileSystemDirectoryHandle, path: string): Promise<File> {
  const segments = path.split('/').filter(Boolean);
  const name = segments.at(-1);
  if (!name) throw new Error(`Invalid file path: ${path}`);

  let directory: FileSystemDirectoryHandle = root;
  for (const segment of segments.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(segment);
  }
  const handle = await directory.getFileHandle(name);
  return await handle.getFile();
}
