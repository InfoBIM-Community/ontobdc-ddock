import { createDockview, themeLight, themeVisualStudio } from 'dockview';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';
import { createDockComponentFactory, observePanelClosures, type PanelFactory } from '@/infobim/shared/adapter/view';
import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

/** Mount the assistant tab after the shell creates its host. */
export function initAssistant(factories: Record<string, PanelFactory>): () => void {
  let disposeAssistant: (() => void) | undefined;

  const unsubscribeLayout = eventBus.subscribe('presentation.main.layout.loaded', () => {
    disposeAssistant?.();
    const host = document.querySelector<HTMLDivElement>('#llm-host');
    if (!host) throw new Error('Assistant panel host not found');

    const dockview = createDockview(host, {
      theme: getTheme() === 'light' ? themeLight : themeVisualStudio,
      createComponent: createDockComponentFactory(factories),
    });
    const unsubscribeClosures = observePanelClosures(dockview, 'assistant');
    const unsubscribeOpenRequests = eventBus.subscribe('presentation.main.panel.open.requested', ({ payload }) => {
      if (payload?.container !== 'assistant') return;
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
    disposeAssistant = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      dockview.dispose();
    };
    dockview.addPanel({ id: 'assistant', component: 'assistant', title: translate('assistant.tab'), });

    const unsubscribeTheme = onThemeChange((theme) => {
      dockview.updateOptions({ theme: theme === 'light' ? themeLight : themeVisualStudio });
    });
    const unsubscribeLocale = onLocaleChange(() => {
      dockview.getPanel('assistant')?.api.setTitle(translate('assistant.tab'));
    });
    disposeAssistant = () => {
      unsubscribeClosures();
      unsubscribeOpenRequests();
      unsubscribeTheme();
      unsubscribeLocale();
      dockview.dispose();
    };
  });

  return () => {
    unsubscribeLayout();
    disposeAssistant?.();
  };
}
