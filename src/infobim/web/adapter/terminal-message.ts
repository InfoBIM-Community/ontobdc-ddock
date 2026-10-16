import type { Json } from '@/infobim/shared/domain/model/command-execution';

const record = (value: Json): value is { [key: string]: Json } =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const label = (key: string): string => key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const scalar = (value: Json): string => value === null ? 'None' : typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value);

/** Word-wrap inside the frame, including paths and identifiers longer than a row. */
function wrap(text: string, width: number): string[] {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const lines: string[] = [];
    let rest = Array.from(paragraph);
    while (rest.length > width) {
      let end = rest.slice(0, width + 1).lastIndexOf(' ');
      if (end <= 0) end = width;
      lines.push(rest.slice(0, end).join(''));
      rest = rest.slice(end);
      if (rest[0] === ' ') rest.shift();
    }
    return [...lines, rest.join('')];
  });
}

/** Decompose CLI content into labeled records and lists instead of JSON syntax. */
function contentLines(value: Json, indent = ''): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value.flatMap((item) =>
    record(item) || Array.isArray(item)
      ? [`${indent}•`, ...contentLines(item, `${indent}  `)]
      : [`${indent}• ${scalar(item)}`]);
  if (record(value)) {
    const entries = Object.entries(value);
    const keyWidth = Math.max(0, ...entries.map(([key]) => label(key).length));
    return entries.flatMap(([key, item]) => record(item) || Array.isArray(item)
      ? [`${indent}${label(key)}`, ...contentLines(item, `${indent}  `)]
      : [`${indent}${label(key).padEnd(keyWidth)} : ${scalar(item)}`]);
  }
  return [`${indent}${scalar(value)}`];
}

/** Emulate a CLI response message box while keeping the command's JSON contract. */
export function renderTerminalMessage(value: Json, columns: number, failed = false): string {
  if (value === null) return '';
  if (!record(value)) return typeof value === 'string' ? value : contentLines(value).join('\r\n');
  const width = Math.max(8, Math.floor(columns));
  const inner = width - 4;
  const severity = typeof value.severity === 'string' ? value.severity : failed ? 'ERROR' : 'INFO';
  const title = typeof value.title === 'string' ? value.title : '';
  const description = typeof value.description === 'string' ? value.description : '';
  const heading = title ? `[${severity}] ${title}` : '';
  const lines = [
    ...wrap(heading, inner),
    ...(description ? ['', ...wrap(description, inner)] : []),
    ...((value.content !== undefined) ? ['', ...contentLines(value.content).flatMap((line) => wrap(line, inner))] : contentLines(value).flatMap((line) => wrap(line, inner))),
  ];
  const color = failed || severity === 'ERROR' ? '\x1b[31m' : '\x1b[36m';
  const border = (text: string): string => `${color}${text}\x1b[0m`;
  return [
    border(`┌${'─'.repeat(width - 2)}┐`),
    ...lines.map((line) => `${border('│')} ${line}${' '.repeat(Math.max(0, inner - Array.from(line).length))} ${border('│')}`),
    border(`└${'─'.repeat(width - 2)}┘`),
  ].join('\r\n');
}
