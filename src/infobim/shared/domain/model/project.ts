/** Only the inspection fields used when opening a project. */
export type ProjectInspectionNode = {
  name: string;
  kind?: string;
  path?: string;
  children?: ProjectInspectionNode[];
};

export type ProjectInspection = {
  content: { tree?: ProjectInspectionNode; error?: string };
};

/** Public project state; directory handles stay private to the project adapter. */
export type ProjectOpened = {
  /** Writable folder containing .__ontobdc__/context.ttl; absent for read-only imports. */
  folder?: FileSystemDirectoryHandle;
  name: string;
  access: 'readwrite' | 'read';
  parts: number;
  inspect: ProjectInspection;
};
