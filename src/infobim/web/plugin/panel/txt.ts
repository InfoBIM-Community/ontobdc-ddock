import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a text file tab; the Dockview panel id is `txt:<path>`. Closing
 * the tab publishes `presentation.main.txt.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'txt',
  className: 'txt-panel',
  closedEvent: 'presentation.main.txt.closed',
  render: async (file, element) => {
    const text = document.createElement('pre');
    text.textContent = await file.text();
    element.appendChild(text);
  },
});
