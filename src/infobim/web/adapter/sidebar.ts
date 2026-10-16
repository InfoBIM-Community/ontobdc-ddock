import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { toMountable, type Mountable, type PanelFactory } from '@/infobim/shared/adapter/view';
import { applyTranslations, type MessageKey } from '@/infobim/shared/plugin/i18n';

/** The views of the left pane: the panel that fills it, and the header it takes while it is shown. */
const VIEWS: Record<string, { panel: string; header: MessageKey }> = {
  explorer: { panel: 'explorer', header: 'pane.explorer.header' },
  database: { panel: 'database', header: 'pane.database.header' },
};

/**
 * Mounts every view of the left pane once, in the pane the shell creates for
 * them (so a populated tree survives switching away), and shows the one picked
 * in the activity bar, swapping the pane header with it.
 */
export function initSidebar(factories: Record<string, PanelFactory>): () => void {
  let mounted: Mountable[] = [];

  const unsubscribeLayout = eventBus.subscribe('presentation.main.layout.loaded', () => {
    mounted.forEach((view) => view.dispose?.());
    mounted = [];
    const host = document.querySelector<HTMLDivElement>('#explorer-host');
    const title = document.querySelector<HTMLSpanElement>('.explorer-pane-title');
    if (!host || !title) throw new Error('Explorer host not found');

    const elements = new Map<string, HTMLElement>();
    for (const [view, { panel }] of Object.entries(VIEWS)) {
      const factory = factories[panel];
      if (!factory) throw new Error(`Sidebar panel not found: ${panel}`);
      const mountable = toMountable(factory({ id: panel }));
      mountable.element.dataset.sidebarView = view;
      host.appendChild(mountable.element);
      elements.set(view, mountable.element);
      mounted.push(mountable);
    }

    const buttons = document.querySelectorAll<HTMLButtonElement>('.activity[data-view]');
    const show = (view: string): void => {
      for (const [id, element] of elements) element.hidden = id !== view;
      for (const button of buttons) {
        const active = button.dataset.view === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      title.dataset.i18n = VIEWS[view].header;
      applyTranslations(title.parentElement ?? title);
    };
    for (const button of buttons) {
      const view = button.dataset.view;
      if (view && view in VIEWS) button.addEventListener('click', () => show(view));
    }
    show('explorer');
  });

  return () => {
    unsubscribeLayout();
    mounted.forEach((view) => view.dispose?.());
    mounted = [];
  };
}
