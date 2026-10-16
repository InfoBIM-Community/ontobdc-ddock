import { controlEditor, type Editor, type EditorOptions } from '@/infobim/shared/adapter/editor/editor';

/** Edits a field that takes one of a few values, with a list to choose from. The value it has now stays on the list. */
export default function choiceEditor({ value, label, options = [], optionLabels = {} }: EditorOptions): Editor {
  const control = document.createElement('select');
  control.className = 'entity-editor';
  control.setAttribute('aria-label', label);
  const values = options.includes(value) || value === '' ? options : [value, ...options];
  for (const option of values) {
    const entry = document.createElement('option');
    entry.value = option;
    entry.textContent = optionLabels[option] ?? option;
    control.append(entry);
  }
  control.value = value;
  return controlEditor(control);
}
