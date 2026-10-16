import { Parser } from 'n3';
import { crateFilePaths, CONTAINER_FILE_PATH } from '@/infobim/shared/adapter/project-format';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DATA_CONTAINER = 'http://datacenter.app.br/ontology/tool/ontobdc/core/ns.ttl#DataContainer';
const IDENTIFIER = 'http://purl.org/dc/terms/identifier';
const CRATE_FILE_PATH = '.__ontobdc__/ro-crate-metadata.json';

/** A file of the project, as a document of its container. */
export type ContainerDocument = { path: string; iri: string };

async function textOf(folder: FileSystemDirectoryHandle, path: string): Promise<string> {
  let directory = folder;
  const segments = path.split('/');
  for (const segment of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(segment);
  return (await (await directory.getFileHandle(segments.at(-1)!)).getFile()).text();
}

/** The identifier the container states for itself (`urn:uuid:...`). */
export function containerIdentifier(turtle: string): string {
  const quads = new Parser().parse(turtle);
  const container = quads.find((quad) => quad.predicate.value === RDF_TYPE && quad.object.value === DATA_CONTAINER)?.subject.value;
  const identifier = quads.find((quad) => quad.subject.value === container && quad.predicate.value === IDENTIFIER)?.object.value;
  if (!identifier) throw new Error('The container states no identifier.');
  return identifier;
}

/** The IRI of a file of the project as a document of its container, the form the entities refer to documents in. */
export function documentIri(identifier: string, path: string): string {
  return `urn:ontobdc:storage/container/${encodeURIComponent(identifier)}/payload/document/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** The files of the project that can be documents: every file but the ones of the metadata directories. */
export async function projectDocuments(folder: FileSystemDirectoryHandle): Promise<ContainerDocument[]> {
  const identifier = containerIdentifier(await textOf(folder, CONTAINER_FILE_PATH));
  return crateFilePaths(await textOf(folder, CRATE_FILE_PATH))
    .filter((path) => !path.endsWith('/') && !path.split('/').some((segment) => segment.startsWith('.')))
    .map((path) => ({ path, iri: documentIri(identifier, path) }));
}
