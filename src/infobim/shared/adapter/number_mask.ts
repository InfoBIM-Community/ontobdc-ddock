/**
 * Shows a number with a mask written the way the number is to look in the
 * language the mask is for: the mask carries its own separators, as the mask of
 * a date carries its own, and the language is chosen by picking its mask.
 *
 * - `0` is a digit that is always shown, `#` a digit shown only when needed;
 * - the separator that is last in the pattern is the decimal one, and the other
 *   one, if the pattern has it, groups the thousands: `#,##0.00` is `1,234.50`
 *   and `#.##0,00` is `1.234,50`;
 * - a pattern with a single kind of separator has only decimals (`0,00`), except
 *   when it is a `#` and exactly three digits before the end (`#,##0`, `#.##0`),
 *   which groups the thousands of a whole number;
 * - the digits after the decimal separator: the `0` are the least shown, the `0`
 *   and `#` together the most;
 * - whatever comes before and after the pattern is shown as it is, as in
 *   `R$ #.##0,00` or `0.0 kg`.
 */
const PATTERN = /^([^#0,.]*)([#0,.]+)([^#0,.]*)$/;

type Separators = { decimal: string | null; group: string | null };

function separatorsOf(core: string): Separators | null {
  const marks = [...core].filter((char) => char === ',' || char === '.');
  if (marks.length === 0) return { decimal: null, group: null };

  const last = marks[marks.length - 1];
  const other = last === ',' ? '.' : ',';
  // Both kinds: the last one is the decimal separator, and the other comes before it.
  if (marks.includes(other)) return core.lastIndexOf(other) < core.lastIndexOf(last) ? { decimal: last, group: other } : null;
  // One kind, once: decimals, unless it is the group of a whole number (`#,##0`).
  if (marks.length === 1) return /#[,.][#0]{3}$/.test(core) ? { decimal: null, group: last } : { decimal: last, group: null };
  // One kind, many times: only groups.
  return { decimal: null, group: last };
}

const count = (text: string, digit: string): number => [...text].filter((char) => char === digit).length;

/**
 * The value is the text of a number, as XSD writes it (`1234.5`). One that is
 * not a number, or a mask that is not a pattern, comes back as it came, so a
 * value is never lost to its mask.
 */
export function applyMask(value: string, mask: string): string {
  const match = PATTERN.exec(mask);
  const number = Number(value);
  if (!match || !value.trim() || !Number.isFinite(number)) return value;

  const [, prefix, core, suffix] = match;
  const separators = separatorsOf(core);
  if (!separators) return value;

  const { decimal, group } = separators;
  const at = decimal === null ? -1 : core.lastIndexOf(decimal);
  const integerPattern = at < 0 ? core : core.slice(0, at);
  const fractionPattern = at < 0 ? '' : core.slice(at + 1);
  const strayed = integerPattern.split(group ?? '\0').join('');
  if (/[,.]/.test(fractionPattern) || /[,.]/.test(strayed) || !/[#0]/.test(core)) return value;

  const minFraction = count(fractionPattern, '0');
  const maxFraction = fractionPattern.length;
  const groupSize = group === null ? 0 : integerPattern.length - integerPattern.lastIndexOf(group) - 1;
  const fixed = Math.abs(number).toFixed(maxFraction);
  let [whole, fraction = ''] = fixed.split('.');
  while (fraction.length > minFraction && fraction.endsWith('0')) fraction = fraction.slice(0, -1);
  whole = whole.padStart(Math.max(1, count(integerPattern, '0')), '0');
  if (group !== null && groupSize > 0) {
    whole = whole.replace(new RegExp(`\\B(?=(\\d{${groupSize}})+(?!\\d))`, 'g'), group);
  }

  const sign = number < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${prefix}${whole}${fraction && decimal ? decimal + fraction : ''}${suffix}`;
}
