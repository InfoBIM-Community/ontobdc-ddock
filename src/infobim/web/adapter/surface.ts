import { createDockview, themeLight, themeVisualStudio } from 'dockview';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';
import { createDockComponentFactory, observePanelClosures, type PanelFactory } from '@/infobim/shared/adapter/view';
import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

/** Listen before rendering the shell; its loaded event mounts Surface and Home. */
export function initSurface(factories: Record<string, PanelFactory>): () => void {
  let disposeSurface: (() => void) | undefined;

  const unsubscribeLayout = eventBus.subscribe('presentation.main.layout.loaded', () => {
    disposeSurface?.();
    const host = document.querySelector<HTMLDivElement>('#dockview');
    if (!host) throw new Error('Surface host not found');

    const dockview = createDockview(host, {
      theme: getTheme() === 'light' ? themeLight : themeVisualStudio,
      createComponent: createDockComponentFactory(factories),
    });

    const unsubscribeClosures = observePanelClosures(dockview, 'surface');
    const unsubscribeOpenRequests = eventBus.subscribe('presentation.main.panel.open.requested', ({ payload }) => {
      if (payload?.container !== 'surface') return;
      const existing = dockview.getPanel(payload.id);
      if (existing) {
        existing.api.setActive();
        return;
      }
      dockview.addPanel({
        id: payload.id,
        component: payload.component,
        title: payload.title ?? payload.id,
      });
    });
    const unsubscribeCloseRequests = eventBus.subscribe('presentation.main.panel.close.requested', ({ payload }) => {
      if (payload?.container !== 'surface') return;
      dockview.getPanel(payload.id)?.api.close();
    });
    disposeSurface = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      unsubscribeCloseRequests();
      dockview.dispose();
    };
    dockview.addPanel({ id: 'home', component: 'home', title: translate('home.tab'), });

    const unsubscribeTheme = onThemeChange((theme) => {
      dockview.updateOptions({ theme: theme === 'light' ? themeLight : themeVisualStudio });
    });
    const unsubscribeLocale = onLocaleChange(() => {
      dockview.getPanel('home')?.api.setTitle(translate('home.tab'));
    });

    disposeSurface = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      unsubscribeCloseRequests();
      unsubscribeTheme();
      unsubscribeLocale();
      dockview.dispose();
    };
  });

  return () => {
    unsubscribeLayout();
    disposeSurface?.();
  };
}
