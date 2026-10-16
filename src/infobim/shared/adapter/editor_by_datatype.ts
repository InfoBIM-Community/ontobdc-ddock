import type { EditorFactory } from '@/infobim/shared/adapter/editor/editor';

const XSD = 'http://www.w3.org/2001/XMLSchema#';

const numeric = [
  'integer', 'int', 'long', 'short', 'byte',
  'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger',
  'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte',
  'decimal', 'double', 'float',
];

type Loader = () => Promise<{ default: EditorFactory }>;

/**
 * The file that edits the values of each datatype, loaded when it is first needed.
 * Several datatypes share a file when one editor serves them all. A datatype with
 * no entry is edited as text.
 */
export const EDITOR_BY_DATATYPE: Readonly<Record<string, Loader>> = {
  [`${XSD}string`]: () => import('@/infobim/shared/adapter/editor/text_editor'),
  [`${XSD}anyURI`]: () => import('@/infobim/shared/adapter/editor/text_editor'),
  [`${XSD}dateTime`]: () => import('@/infobim/shared/adapter/editor/datetime_editor'),
  [`${XSD}date`]: () => import('@/infobim/shared/adapter/editor/datetime_editor'),
  [`${XSD}time`]: () => import('@/infobim/shared/adapter/editor/datetime_editor'),
  [`${XSD}boolean`]: () => import('@/infobim/shared/adapter/editor/boolean_editor'),
  ...Object.fromEntries(numeric.map((name) => [`${XSD}${name}`, () => import('@/infobim/shared/adapter/editor/number_editor')])),
};

/**
 * The editor of a field: a list of values to add to and remove from when the
 * field holds several (and the facade lists none to choose from), a list to choose
 * from when the facade lists the values the field takes, else the editor of its datatype (an IRI), else the text editor.
 */
export async function editorFor(datatype: string | undefined, options?: string[], multivalued = false): Promise<EditorFactory> {
  if (multivalued && !(options && options.length > 0)) return (await import('@/infobim/shared/adapter/editor/list_editor')).default;
  if (options && options.length > 0) return (await import('@/infobim/shared/adapter/editor/choice_editor')).default;
  const load = datatype !== undefined && Object.hasOwn(EDITOR_BY_DATATYPE, datatype)
    ? EDITOR_BY_DATATYPE[datatype]
    : EDITOR_BY_DATATYPE[`${XSD}string`];
  return (await load()).default;
}
