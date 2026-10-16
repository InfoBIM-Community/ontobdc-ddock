import { renderAsync } from 'docx-preview';
import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a Word (.docx) tab, read-only; the Dockview panel id is
 * `docx:<path>`. The document is drawn page by page with its own styles,
 * which stay inside the tab. Closing the tab publishes
 * `presentation.main.docx.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'docx',
  className: 'docx-panel',
  closedEvent: 'presentation.main.docx.closed',
  render: async (file, element) => {
    // Images as data URLs, so there are no object URLs to release when the tab closes.
    await renderAsync(file, element, element, { useBase64URL: true });
  },
});
