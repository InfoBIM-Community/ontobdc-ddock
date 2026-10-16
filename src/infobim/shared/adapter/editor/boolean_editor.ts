import { controlEditor, type Editor, type EditorOptions } from '@/infobim/shared/adapter/editor/editor';

/** Edits a yes or no with a check box; the data source keeps `true` or `false`. */
export default function booleanEditor({ value, label }: EditorOptions): Editor {
  const control = document.createElement('input');
  control.type = 'checkbox';
  control.className = 'entity-editor';
  control.checked = value.trim().toLowerCase() === 'true' || value.trim() === '1';
  control.setAttribute('aria-label', label);
  return controlEditor(control, () => (control.checked ? 'true' : 'false'), () => true);
}
