import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a Markdown tab; the Dockview panel id is `md:<path>`. The text
 * becomes HTML and is sanitized before it reaches the page, since the file
 * comes from the project. Closing the tab publishes
 * `presentation.main.md.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'md',
  className: 'md-panel',
  closedEvent: 'presentation.main.md.closed',
  render: async (file, element) => {
    const html = DOMPurify.sanitize(await marked.parse(await file.text()));
    const content = document.createElement('div');
    content.className = 'md-content';
    content.innerHTML = html;
    for (const link of content.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    element.appendChild(content);
  },
});
