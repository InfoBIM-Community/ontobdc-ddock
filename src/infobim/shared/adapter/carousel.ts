import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

/** One image of a carousel. It is loaded only when it is about to be shown. */
export type CarouselItem = {
  id: string;
  caption: string;
  /** Gives the address of the image; `release` frees what the address holds, such as an object URL. */
  load(): Promise<{ url: string; release?: () => void }>;
};

export type CarouselOptions = {
  /** How many images are shown at a time. */
  visible?: number;
  /** Called with the id of the image that was double-clicked. */
  onOpen?(id: string): void;
};

export type Carousel = {
  element: HTMLElement;
  /** Replaces the images. Those that stay are not loaded again. */
  setItems(items: CarouselItem[]): void;
  /** Frees every loaded image and stops following the language. */
  dispose(): void;
};

/**
 * A row of images with Previous and Next buttons and the range being shown. It
 * knows nothing about entities or files: it is given items and draws them.
 */
export function createCarousel(options: CarouselOptions = {}): Carousel {
  const visible = options.visible ?? 3;

  const element = document.createElement('section');
  element.className = 'carousel';
  const stage = document.createElement('div');
  stage.className = 'carousel-stage';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'carousel-nav previous';
  previous.textContent = '‹';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-nav next';
  next.textContent = '›';
  const strip = document.createElement('div');
  strip.className = 'carousel-strip';
  const range = document.createElement('p');
  range.className = 'carousel-range';
  const empty = document.createElement('p');
  empty.className = 'carousel-empty';
  stage.append(previous, strip, next);
  element.append(stage, range, empty);

  let items: CarouselItem[] = [];
  let first = 0;
  const loaded = new Map<string, { url: string; release?: () => void }>();
  const loading = new Map<string, Promise<void>>();
  let disposed = false;

  const picture = (item: CarouselItem): HTMLElement => {
    const slide = document.createElement('figure');
    slide.className = 'carousel-slide';
    slide.dataset.id = item.id;
    const image = document.createElement('img');
    image.alt = item.caption;
    image.title = translate('carousel.openImage');
    image.addEventListener('dblclick', () => options.onOpen?.(item.id));
    const caption = document.createElement('figcaption');
    caption.textContent = item.caption;
    slide.append(image, caption);
    const ready = loaded.get(item.id);
    if (ready) image.src = ready.url;
    else void ensure(item).then(() => {
      const url = loaded.get(item.id)?.url;
      if (url && !disposed) image.src = url;
    });
    return slide;
  };

  const ensure = (item: CarouselItem): Promise<void> => {
    const pending = loading.get(item.id);
    if (pending) return pending;
    const started = item.load().then((result) => {
      if (disposed || !items.some((candidate) => candidate.id === item.id)) result.release?.();
      else loaded.set(item.id, result);
    }).catch(() => undefined);
    loading.set(item.id, started);
    return started;
  };

  const show = (): void => {
    previous.setAttribute('aria-label', translate('carousel.previous'));
    next.setAttribute('aria-label', translate('carousel.next'));
    empty.textContent = translate('carousel.noImages');
    first = Math.max(0, Math.min(first, items.length - visible));
    const window = items.slice(first, first + visible);
    element.dataset.count = String(items.length);
    stage.hidden = range.hidden = window.length === 0;
    empty.hidden = window.length !== 0;
    if (window.length === 0) {
      strip.replaceChildren();
      return;
    }
    previous.disabled = first === 0;
    next.disabled = first + visible >= items.length;
    range.textContent = translate('carousel.range', { from: first + 1, to: first + window.length, total: items.length });
    strip.replaceChildren(...window.map(picture));
  };

  previous.addEventListener('click', () => { first -= 1; show(); });
  next.addEventListener('click', () => { first += 1; show(); });
  const stopFollowing = onLocaleChange(show);
  show();

  return {
    element,
    setItems(next: CarouselItem[]): void {
      items = next;
      for (const [id, image] of loaded) {
        if (!items.some((item) => item.id === id)) {
          image.release?.();
          loaded.delete(id);
          loading.delete(id);
        }
      }
      show();
    },
    dispose(): void {
      disposed = true;
      stopFollowing();
      loaded.forEach((image) => image.release?.());
      loaded.clear();
      element.remove();
    },
  };
}
