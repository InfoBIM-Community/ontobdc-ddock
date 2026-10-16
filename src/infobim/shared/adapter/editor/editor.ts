/** What an editor is given to show a field of an entity. */
export type EditorOptions = {
  /** The value stored for the field, as the data source holds it. */
  value: string;
  /** The datatype of the field, an IRI such as `http://www.w3.org/2001/XMLSchema#dateTime`. */
  datatype: string;
  /** The name of the field, for those who cannot see it. */
  label: string;
  /** The only values the field takes, when the facade lists them: the field is then chosen from a list. */
  options?: string[];
  /** What to show for each option, in the language of the interface; an option with no entry shows as it is. */
  optionLabels?: Record<string, string>;
  /** The field holds a list of values, separated by `|` in the form the data source holds them. */
  multivalued?: boolean;
  /** The values of the field are documents of the project, chosen from its files. */
  documents?: boolean;
  /** Who is edited (an entity's global id, or `new:<group>` for a new entity) and which field: how a list editor tells the listeners what the person asked. */
  owner?: string;
  field?: string;
};

/** The widget with which a person changes the value of one field. */
export type Editor = {
  element: HTMLElement;
  /** What the person has now, in the form the data source holds. */
  value(): string;
  /** Whether what the person has now is a value of the datatype. */
  isValid(): boolean;
  /** Called whenever the person changes it. */
  onChange(listener: () => void): void;
};

export type EditorFactory = (options: EditorOptions) => Editor;

/** An editor around one form control, which the datatypes of a kind share. */
export function controlEditor(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  read: () => string = () => control.value,
  valid: () => boolean = () => control.checkValidity(),
): Editor {
  const listeners: Array<() => void> = [];
  const changed = (): void => listeners.forEach((listener) => listener());
  control.addEventListener('input', changed);
  control.addEventListener('change', changed);
  return {
    element: control,
    value: read,
    isValid: valid,
    onChange: (listener) => { listeners.push(listener); },
  };
}
