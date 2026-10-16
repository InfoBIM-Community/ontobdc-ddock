import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a PDF tab; the Dockview panel id is `pdf:<path>`. The browser's
 * own PDF viewer shows the file. Closing the tab publishes
 * `presentation.main.pdf.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'pdf',
  className: 'pdf-panel',
  closedEvent: 'presentation.main.pdf.closed',
  render: (file, element) => {
    const objectUrl = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.title = file.name;
    frame.src = objectUrl;
    element.appendChild(frame);
    return () => URL.revokeObjectURL(objectUrl);
  },
});
