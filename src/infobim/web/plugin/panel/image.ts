import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of an image tab; the Dockview panel id is `image:<path>`. Closing
 * the tab publishes `presentation.main.image.closed` with that path.
 */
export default makeFilePanel({
  prefix: 'image',
  className: 'image-panel',
  closedEvent: 'presentation.main.image.closed',
  render: (file, element) => {
    const objectUrl = URL.createObjectURL(file);
    const image = document.createElement('img');
    image.alt = file.name;
    image.src = objectUrl;
    element.appendChild(image);
    // Without this, every image opened keeps its blob for the lifetime of the page.
    return () => URL.revokeObjectURL(objectUrl);
  },
});
