/** One entry of the mounted folder, by its path relative to the mount. */
export type FolderEntry = { kind: 'file' | 'dir'; mtime: number; size: number };

/** The mounted folder's entries, by path relative to the mount (`a/b.txt`). */
export type FolderListing = Map<string, FolderEntry>;

/**
 * What a command changed in the mounted folder, to apply to the folder on
 * disk in this order: `remove`, `createDirs`, `writeFiles` (removing first
 * lets an entry that turned from a file into a directory, or back, be recreated).
 */
export type SyncPlan = {
  /** Directories the command created, parents first. */
  createDirs: string[];
  /** Files the command created or changed. */
  writeFiles: string[];
  /** Entries the command removed, children first. */
  remove: string[];
};

const depth = (path: string): number => path.split('/').length;

/**
 * Compares the mounted folder as it was when it was mounted with how the
 * command left it. Only what the command did is carried back to disk: what
 * it created or changed, and what it removed among the entries that were
 * there at mount time. Anything that appeared on disk while the command ran
 * (written by the app or by the user) is in neither listing, so it is left
 * alone — unlike Pyodide's `syncfs()`, which mirrors the mount and deletes it.
 */
export function planSync(atMount: FolderListing, afterCommand: FolderListing): SyncPlan {
  const createDirs: string[] = [];
  const writeFiles: string[] = [];
  const remove: string[] = [];

  for (const [path, entry] of afterCommand) {
    const before = atMount.get(path);
    if (entry.kind === 'dir') {
      if (before?.kind !== 'dir') createDirs.push(path);
    } else if (before?.kind !== 'file' || before.mtime !== entry.mtime || before.size !== entry.size) {
      writeFiles.push(path);
    }
  }
  for (const [path, entry] of atMount) {
    if (afterCommand.get(path)?.kind !== entry.kind) remove.push(path);
  }

  createDirs.sort((a, b) => depth(a) - depth(b));
  remove.sort((a, b) => depth(b) - depth(a));
  return { createDirs, writeFiles, remove };
}
