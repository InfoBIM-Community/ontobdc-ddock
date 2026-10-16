import { controlEditor, type Editor, type EditorOptions } from '@/infobim/shared/adapter/editor/editor';

/** A text longer than this, or with line breaks, is edited in a box of several lines. */
const LONG = 80;

/** Edits a text: a line when it is short, a box of several lines when it is long. */
export default function textEditor({ value, label }: EditorOptions): Editor {
  const long = value.includes('\n') || value.length > LONG;
  const control = long ? document.createElement('textarea') : document.createElement('input');
  if (control instanceof HTMLInputElement) control.type = 'text';
  else control.rows = Math.min(8, Math.max(3, value.split('\n').length));
  control.className = 'entity-editor';
  control.value = value;
  control.setAttribute('aria-label', label);
  return controlEditor(control);
}
