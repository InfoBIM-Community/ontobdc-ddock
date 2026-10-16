import { translate } from '@/infobim/shared/plugin/i18n';

/** A table this long would freeze the page, so only its first rows are drawn. */
export const MAX_TABLE_ROWS = 5000;

/**
 * Draws rows as a read-only table: the first row is the header. When there are
 * more rows than `MAX_TABLE_ROWS`, a note says only the first ones are shown.
 */
export function renderTable(rows: string[][]): DocumentFragment {
  const [header = [], ...body] = rows;
  const fragment = document.createDocumentFragment();

  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const name of header) {
    const cell = document.createElement('th');
    cell.textContent = name;
    head.appendChild(cell);
  }
  const tbody = table.createTBody();
  for (const values of body.slice(0, MAX_TABLE_ROWS)) {
    const row = tbody.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  fragment.appendChild(table);

  if (body.length > MAX_TABLE_ROWS) {
    const note = document.createElement('p');
    note.className = 'file-status';
    note.textContent = translate('file.rowsTruncated', { count: MAX_TABLE_ROWS });
    fragment.appendChild(note);
  }
  return fragment;
}
