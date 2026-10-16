import type { ExplorerNode } from '@/infobim/shared/domain/model/explorer-node';
import type { EntityField, EntityGroup, EntityItem } from '@/infobim/shared/domain/model/entity';
import type { ProjectInspection, ProjectInspectionNode } from '@/infobim/shared/domain/model/project';

/** Where every OntoBDC container keeps its RO-Crate, relative to the container root. */
export const CRATE_DIRECTORY_NAME = '.__ontobdc__';
export const CRATE_FILE_NAME = 'ro-crate-metadata.json';

const ROOT_NODE_ID = './';
const URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Raised when the crate document exists but does not describe a container. */
export class InvalidCrateError extends Error {}

/**
 * Returns the path of every part the crate's root node (`./`) states in
 * `hasPart`, decoded and relative to the container — the same reading as
 * OntoBDC's `ContainerRoCrate.file_paths`. Parts that name an external
 * resource (a URI with a scheme) are not container files and are skipped.
 */
export function crateFilePaths(text: string): string[] {
  let crate: unknown;
  try {
    crate = JSON.parse(text);
  } catch {
    throw new InvalidCrateError('The RO-Crate is not valid JSON.');
  }
  if (!isRecord(crate)) throw new InvalidCrateError('The RO-Crate is not a JSON object.');

  const graph = crate['@graph'];
  if (!Array.isArray(graph)) throw new InvalidCrateError('The RO-Crate states no graph.');

  const root = graph.find((node): node is Record<string, unknown> =>
    isRecord(node) && node['@id'] === ROOT_NODE_ID);
  if (!root) throw new InvalidCrateError(`The RO-Crate describes no ${ROOT_NODE_ID} node.`);

  const parts = root.hasPart;
  if (parts === undefined) return [];
  if (!Array.isArray(parts)) {
    throw new InvalidCrateError('The RO-Crate states its parts as something other than a list.');
  }

  const paths: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    const id = part['@id'];
    if (typeof id !== 'string' || !id.trim()) continue;
    const path = pathOf(id);
    if (path) paths.push(path);
  }
  return paths.sort();
}

/** Builds a directory tree from container-relative paths (`a/b/c.txt`, `a/d/`). */
export function pathsToTree(paths: string[]): ExplorerNode[] {
  const root: ExplorerNode = { name: '', children: [] };
  for (const path of paths) {
    const isDir = path.endsWith('/');
    const segments = path.split('/').filter(Boolean);
    let node = root;
    segments.forEach((name, i) => {
      const last = i === segments.length - 1;
      const children = (node.children ??= []);
      let next = children.find((child) => child.name === name);
      if (!next) {
        next = last && !isDir ? { name } : { name, children: [] };
        children.push(next);
      } else if (!last && !next.children) {
        next.children = [];
      }
      node = next;
    });
  }
  sortTree(root.children ?? []);
  return root.children ?? [];
}

function sortTree(nodes: ExplorerNode[]): void {
  nodes.sort((a, b) => {
    const dirOrder = Number(!a.children) - Number(!b.children);
    return dirOrder || a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => node.children && sortTree(node.children));
}

function pathOf(id: string): string | null {
  const trimmed = id.trim();
  if (URI_SCHEME.test(trimmed)) return null;
  let path: string;
  try {
    path = decodeURIComponent(trimmed);
  } catch {
    path = trimmed;
  }
  if (path.startsWith(ROOT_NODE_ID)) path = path.slice(ROOT_NODE_ID.length);
  return path || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Metadata of an OntoBDC container, as its `.__ontobdc__/container.ttl` states it. */
export const CONTAINER_FILE_PATH = '.__ontobdc__/container.ttl';

const AT_LOCATION = /(?:prov:atLocation|<http:\/\/www\.w3\.org\/ns\/prov#atLocation>)\s+<(file:[^>]+)>/g;

/**
 * Returns the absolute path the container was registered at. The CLI checks
 * that a project still lives where it was registered, so the browser mounts
 * the picked directory at exactly this path before running it. The container
 * is the shortest location stated; its datasets live below it.
 */
export function containerLocation(turtle: string): string | null {
  const paths = [...turtle.matchAll(AT_LOCATION)]
    .map((match) => {
      try {
        return decodeURIComponent(new URL(match[1]).pathname).replace(/\/+$/, '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  if (paths.length === 0) return null;
  return paths.reduce((shortest, path) => (path.length < shortest.length ? path : shortest));
}

type CliResponse<Content> = { content: Content };

/** Parses a CLI JSON answer, or returns null when stdout is not one. */
export function parseCliResponse<Content>(stdout: string): CliResponse<Content> | null {
  try {
    const value: unknown = JSON.parse(stdout);
    if (typeof value === 'object' && value !== null && 'content' in value) return value as CliResponse<Content>;
  } catch { /* not JSON */ }
  return null;
}

/**
 * The CLI hard-wraps long strings at 80 columns even in --json output,
 * splitting words without a space, so the breaks are simply removed.
 * Only for strings that never hold a real line break (messages, paths).
 */
export function unwrapCliText(text: string): string {
  return text.replace(/\n/g, '');
}

/**
 * The explorer tree of one section of an inspection (`model` or `drawing`),
 * built from the paths of its files so folders read the same as in FILES.
 */
export function inspectSectionNodes(inspect: ProjectInspection | undefined, kind: 'model' | 'drawing'): ExplorerNode[] {
  const section = inspect?.content?.tree?.children?.find((child) => child.kind === kind);
  if (!section) return [];
  const paths: string[] = [];
  const collect = (node: ProjectInspectionNode): void => {
    if (typeof node.path === 'string' && node.path) paths.push(node.path);
    node.children?.forEach(collect);
  };
  section.children?.forEach(collect);
  return pathsToTree(paths.sort());
}

type ListedDataset = { path?: unknown; title?: unknown; entity_types?: unknown; entities?: unknown };

/**
 * The groups `infobim project --entity` answers: one per dataset of the
 * project's container, in the order the CLI gives them. Returns null when the
 * response is not that answer.
 */
export function entityGroupsOf(response: unknown): EntityGroup[] | null {
  const datasets = isRecord(response) && isRecord(response.content) ? response.content.datasets : undefined;
  if (!Array.isArray(datasets)) return null;

  const groups: EntityGroup[] = [];
  for (const dataset of datasets as ListedDataset[]) {
    if (typeof dataset.path !== 'string' || !dataset.path) return null;
    groups.push({
      id: dataset.path,
      title: typeof dataset.title === 'string' && dataset.title ? unwrapCliText(dataset.title) : dataset.path,
      entityTypes: Array.isArray(dataset.entity_types)
        ? dataset.entity_types.filter((type): type is string => typeof type === 'string')
        : [],
      items: entityItemsOf(dataset.entities),
    });
  }
  return groups;
}

function entityItemsOf(entities: unknown): EntityItem[] {
  if (!Array.isArray(entities)) return [];
  const items: EntityItem[] = [];
  for (const entity of entities as Array<Record<string, unknown>>) {
    if (typeof entity.global_id !== 'string' || !entity.global_id) continue;
    items.push({
      id: entity.global_id,
      name: typeof entity.name === 'string' ? unwrapCliText(entity.name) : '',
      type: typeof entity.type === 'string' ? entity.type : '',
      fields: entityFieldsOf(entity.fields),
    });
  }
  return items;
}

function entityFieldsOf(fields: unknown): EntityField[] {
  if (!Array.isArray(fields)) return [];
  const parsed: EntityField[] = [];
  for (const field of fields as Array<Record<string, unknown>>) {
    if (typeof field.name !== 'string' || !field.name) continue;
    parsed.push({
      name: field.name,
      labels: entityLabelsOf(field.labels),
      editable: field.editable === true,
      values: Array.isArray(field.values)
        ? field.values.filter((value): value is string => typeof value === 'string' && value !== '').map(unwrapCliText)
        : [],
    });
  }
  return parsed;
}

function entityLabelsOf(labels: unknown): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (isRecord(labels)) {
    for (const [language, label] of Object.entries(labels)) {
      if (typeof label === 'string' && label) parsed[language.toLowerCase()] = unwrapCliText(label);
    }
  }
  return parsed;
}
