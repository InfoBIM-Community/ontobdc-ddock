import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Nothing the page loads may come from the network, and scripts never run
 * (the frame also has no `allow-scripts`): the file is shown, not executed.
 */
const POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">`;

/**
 * Content of an HTML tab; the Dockview panel id is `html:<path>`. The file is
 * shown as a static page in a sandboxed frame, so its scripts, forms,
 * external resources and links do nothing. Closing the tab publishes
 * `presentation.main.html.closed` with the path.
 */
export default makeFilePanel({
  prefix: 'html',
  className: 'html-panel',
  closedEvent: 'presentation.main.html.closed',
  render: async (file, element) => {
    const objectUrl = URL.createObjectURL(new Blob([POLICY, await file.text()], { type: 'text/html;charset=utf-8' }));
    const frame = document.createElement('iframe');
    frame.title = file.name;
    frame.setAttribute('sandbox', '');
    frame.src = objectUrl;
    element.appendChild(frame);
    return () => URL.revokeObjectURL(objectUrl);
  },
});
