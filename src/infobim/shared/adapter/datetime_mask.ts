const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/** The letters of a mask and what each stands for; any other character of the mask is shown as it is. */
const TOKENS: Record<string, (date: Date) => string> = {
  yyyy: (d) => pad(d.getFullYear(), 4),
  yy: (d) => pad(d.getFullYear() % 100, 2),
  MM: (d) => pad(d.getMonth() + 1, 2),
  M: (d) => String(d.getMonth() + 1),
  dd: (d) => pad(d.getDate(), 2),
  d: (d) => String(d.getDate()),
  HH: (d) => pad(d.getHours(), 2),
  H: (d) => String(d.getHours()),
  hh: (d) => pad(d.getHours() % 12 || 12, 2),
  h: (d) => String(d.getHours() % 12 || 12),
  mm: (d) => pad(d.getMinutes(), 2),
  ss: (d) => pad(d.getSeconds(), 2),
  a: (d) => (d.getHours() < 12 ? 'AM' : 'PM'),
};

const PATTERN = /yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|ss|a/g;

/**
 * Shows a date and time with a mask such as `dd/MM/yyyy HH:mm` or
 * `M/d/yyyy h:mm a`. The value is an ISO 8601 text; one that is not a date
 * and time is returned as it came, so a value is never lost to its mask.
 */
export function applyMask(value: string, mask: string): string {
  const date = new Date(value);
  if (!value.trim() || Number.isNaN(date.getTime())) return value;
  return mask.replace(PATTERN, (token) => TOKENS[token](date));
}
