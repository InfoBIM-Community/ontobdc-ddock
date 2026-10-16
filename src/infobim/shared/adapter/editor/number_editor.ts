import { controlEditor, type Editor, type EditorOptions } from '@/infobim/shared/adapter/editor/editor';

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const WHOLE = ['integer', 'int', 'long', 'short', 'byte', 'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger', 'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte'];

/** Edits a number: whole numbers by one, the others by any step. */
export default function numberEditor({ value, datatype, label }: EditorOptions): Editor {
  const control = document.createElement('input');
  control.type = 'number';
  control.step = WHOLE.some((name) => datatype === `${XSD}${name}`) ? '1' : 'any';
  if (datatype === `${XSD}nonNegativeInteger` || datatype === `${XSD}unsignedLong` || datatype === `${XSD}unsignedInt`) control.min = '0';
  if (datatype === `${XSD}positiveInteger`) control.min = '1';
  control.className = 'entity-editor';
  control.value = value;
  control.setAttribute('aria-label', label);
  return controlEditor(control, undefined, () => control.validity.valid && control.value !== '');
}
