import readXlsxFile from 'read-excel-file/browser';
import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';
import { renderTable } from '@/infobim/shared/adapter/table';

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
};

/**
 * Content of an Excel (.xlsx) tab, read-only; the Dockview panel id is
 * `xlsx:<path>`. Each sheet of the workbook is a table, the first row is its
 * header, and formulas show the value last calculated by Excel. Closing the
 * tab publishes `presentation.main.xlsx.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'xlsx',
  className: 'xlsx-panel',
  closedEvent: 'presentation.main.xlsx.closed',
  render: async (file, element) => {
    const sheets = await readXlsxFile(file);
    const tables = sheets.map((sheet) => sheet.data.map((row) => row.map(cellText)));

    const body = document.createElement('div');
    const show = (index: number): void => body.replaceChildren(renderTable(tables[index] ?? []));

    if (sheets.length > 1) {
      const picker = document.createElement('select');
      picker.className = 'xlsx-sheets';
      sheets.forEach((sheet, index) => picker.add(new Option(sheet.sheet, String(index))));
      picker.addEventListener('change', () => show(Number(picker.value)));
      element.appendChild(picker);
    }
    element.appendChild(body);
    show(0);
  },
});
