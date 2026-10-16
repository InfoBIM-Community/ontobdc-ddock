import { createDockview, themeLight, themeVisualStudio } from 'dockview';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';
import { createDockComponentFactory, observePanelClosures, type PanelFactory } from '@/infobim/shared/adapter/view';
import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

/** Mount the bottom tabs after the shell creates their host. */
export function initBottom(factories: Record<string, PanelFactory>): () => void {
  let disposeBottom: (() => void) | undefined;

  const unsubscribeLayout = eventBus.subscribe('presentation.main.layout.loaded', () => {
    disposeBottom?.();
    const host = document.querySelector<HTMLDivElement>('#terminal-host');
    if (!host) throw new Error('Bottom panel host not found');

    const dockview = createDockview(host, {
      theme: getTheme() === 'light' ? themeLight : themeVisualStudio,
      createComponent: createDockComponentFactory(factories),
    });
    const unsubscribeClosures = observePanelClosures(dockview, 'bottom');
    const unsubscribeOpenRequests = eventBus.subscribe('presentation.main.panel.open.requested', ({ payload }) => {
      if (payload?.container !== 'bottom') return;
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
    disposeBottom = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      dockview.dispose();
    };
    dockview.addPanel({ id: 'debug', component: 'debug', title: translate('events.tab'), });
    dockview.addPanel({ id: 'terminal', component: 'terminal', title: translate('terminal.tab'), });

    const unsubscribeTheme = onThemeChange((theme) => {
      dockview.updateOptions({ theme: theme === 'light' ? themeLight : themeVisualStudio });
    });
    const unsubscribeLocale = onLocaleChange(() => {
      dockview.getPanel('debug')?.api.setTitle(translate('events.tab'));
      dockview.getPanel('terminal')?.api.setTitle(translate('terminal.tab'));
    });
    disposeBottom = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      unsubscribeTheme();
      unsubscribeLocale();
      dockview.dispose();
    };
  });

  return () => {
    unsubscribeLayout();
    disposeBottom?.();
  };
}
