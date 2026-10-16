/** A node of an explorer tree; a node with `children` (even empty) is a directory. */
export type ExplorerNode = { name: string; children?: ExplorerNode[] };
