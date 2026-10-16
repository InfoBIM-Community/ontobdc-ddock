/** `urn:ontobdc:storage/container/<container id>/payload/document/<path>`: the IRI of a file as a document of its container. */
const DOCUMENT_IRI = /^urn:ontobdc:storage\/container\/[^/]+\/payload\/document\/(.+)$/;

/** The path, in the project, of the file a document IRI names. An IRI that names no document of a container has none. */
export function documentPath(iri: string): string | undefined {
  const match = DOCUMENT_IRI.exec(iri);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** The title of the document an IRI names: the name of its file. */
export function documentTitle(iri: string): string | undefined {
  const path = documentPath(iri);
  return path === undefined ? undefined : path.slice(path.lastIndexOf('/') + 1);
}
