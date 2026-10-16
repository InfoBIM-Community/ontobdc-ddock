import { controlEditor, type Editor, type EditorOptions } from '@/infobim/shared/adapter/editor/editor';

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const HAS_ZONE = /(?:[zZ]|[+-]\d\d:?\d\d)$/;

const pad = (value: number): string => String(value).padStart(2, '0');

/** An ISO 8601 date and time as the local `YYYY-MM-DDTHH:MM:SS` the control takes; one with a zone is shown in the local zone. */
function localDateTime(value: string): string {
  if (!value.trim()) return '';
  if (!HAS_ZONE.test(value)) return value.slice(0, 19);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Edits a date, a time or a date and time with the picker of the browser, to the second. */
export default function datetimeEditor({ value, datatype, label }: EditorOptions): Editor {
  const kind = datatype === `${XSD}date` ? 'date' : datatype === `${XSD}time` ? 'time' : 'datetime-local';
  const control = document.createElement('input');
  control.type = kind;
  control.step = '1';
  control.className = 'entity-editor';
  control.setAttribute('aria-label', label);
  const local = localDateTime(value);
  control.value = kind === 'date' ? local.slice(0, 10) : kind === 'time' ? (value.match(/\d\d:\d\d(?::\d\d)?/)?.[0] ?? '') : local;

  // A browser leaves the seconds out when they are zero; the data source keeps them.
  const read = (): string => {
    const text = control.value;
    if (kind === 'datetime-local' && text.length === 16) return `${text}:00`;
    if (kind === 'time' && text.length === 5) return `${text}:00`;
    return text;
  };
  return controlEditor(control, read, () => control.validity.valid && control.value !== '');
}
