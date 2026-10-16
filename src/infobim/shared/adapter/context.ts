import { DataFactory, Parser, Store, Writer } from 'n3';

const CONTEXT_DIRECTORY = '.__ontobdc__';
const CONTEXT_FILE = 'context.ttl';
const OBDC = 'http://datacenter.app.br/ontology/tool/ontobdc/core/ns.ttl#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/** A freshly created context.ttl, matching what `infobim init` writes on the Python side. */
const DEFAULT_CONTEXT_TTL = `@prefix obdc: <${OBDC}> .

<urn:ontobdc:context/execution> a obdc:ExecutionContext .
`;

const { namedNode, literal, quad } = DataFactory;

/** `remote_api_token` -> `remoteApiToken`, the way the Python context names a parameter. */
const camelCase = (parameter: string): string =>
  parameter.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/**
 * Sets one parameter on the execution context of a context.ttl text,
 * replacing any value it already has. The file is parsed and written back as
 * RDF, so nothing depends on how it is laid out.
 */
export function withContextParameter(turtle: string, parameter: string, value: string): string {
  const store = new Store();
  let prefixes: Record<string, string> = {};
  store.addQuads(new Parser().parse(turtle, null, (name, iri) => {
    prefixes = { ...prefixes, [name]: iri.value };
  }));

  const contexts = store.getSubjects(namedNode(RDF_TYPE), namedNode(`${OBDC}ExecutionContext`), null);
  if (contexts.length === 0) throw new Error('The context file describes no obdc:ExecutionContext.');

  const predicate = namedNode(`${OBDC}${camelCase(parameter)}`);
  store.removeQuads(store.getQuads(contexts[0], predicate, null, null));
  store.addQuad(quad(contexts[0] as ReturnType<typeof namedNode>, predicate, literal(value)));

  const writer = new Writer({ prefixes });
  writer.addQuads(store.getQuads(null, null, null, null));
  let output = '';
  writer.end((error, result) => {
    if (error) throw error;
    output = result;
  });
  return output;
}

function withRecoveredContextParameter(turtle: string, parameter: string, value: string): string {
  try {
    return withContextParameter(turtle, parameter, value);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'The context file describes no obdc:ExecutionContext.') {
      throw error;
    }

    // Legacy or partial context files must not block project opening.
    return withContextParameter(DEFAULT_CONTEXT_TTL, parameter, value);
  }
}

/** Reads and writes the parameters the CLI context keeps in `.__ontobdc__/context.ttl`. */
export class ContextRepository {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async set(parameter: string, value: string): Promise<void> {
    const directory = await this.root.getDirectoryHandle(CONTEXT_DIRECTORY, { create: true });
    const fileHandle = await directory.getFileHandle(CONTEXT_FILE, { create: true });
    const existing = await (await fileHandle.getFile()).text();
    const turtle = existing.trim() ? existing : DEFAULT_CONTEXT_TTL;
    const updated = withRecoveredContextParameter(turtle, parameter, value);
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(updated);
    } finally {
      await writable.close();
    }
  }
}
