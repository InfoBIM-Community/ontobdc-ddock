import { makeFilePanel } from '@/infobim/shared/adapter/file-panel';

/**
 * Content of a HEIC/HEIF tab, read-only; the Dockview panel id is `heic:<path>`.
 * Browsers other than Safari cannot show HEIC, so the photo is converted to a
 * PNG (heic-to, in a Web Worker, loaded the first time one opens) and shown as
 * an image; the file in the project is not changed. Only the first image of
 * the file is shown. Closing the tab publishes `presentation.main.heic.closed`
 * with the path.
 */
export default makeFilePanel({
  prefix: 'heic',
  className: 'image-panel',
  closedEvent: 'presentation.main.heic.closed',
  render: async (file, element) => {
    const { convertHeicToPng } = await import('@/infobim/web/adapter/viewer/heic-convert');
    const objectUrl = URL.createObjectURL(await convertHeicToPng(file));
    const image = document.createElement('img');
    image.alt = file.name;
    image.src = objectUrl;
    element.appendChild(image);
    return () => URL.revokeObjectURL(objectUrl);
  },
});
