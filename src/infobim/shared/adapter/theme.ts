import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';
import { eventBus } from '@/infobim/shared/adapter/event-bus';

export type Theme = 'light' | 'dark';

const storageKey = 'infobim.theme';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* The theme also works when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

let current = initialTheme();
document.documentElement.dataset.theme = current;
document.querySelector('meta[name="theme-color"]')?.setAttribute(
  'content', current === 'light' ? '#ffffff' : '#181818',
);

export function getTheme(): Theme {
  return current;
}

/** Update the shared palette and notify components with their own theme API. */
export function setTheme(theme: Theme): void {
  if (theme === current) return;
  const previousTheme = current;
  current = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'light' ? '#ffffff' : '#181818',
  );
  try { localStorage.setItem(storageKey, theme); } catch { /* Storage is optional. */ }
  eventBus.publish('presentation.main.theme.changed', 'theme', { theme, previousTheme });
}

export function onThemeChange(listener: (theme: Theme) => void): () => void {
  return eventBus.subscribe('presentation.main.theme.changed', (event) => {
    if (event.payload) listener(event.payload.theme);
  });
}

/** Requests from the UI or another module use the same theme application path. */
const unsubscribeThemeRequests = eventBus.subscribe('presentation.main.theme.change.requested', (event) => {
  if (event.payload) setTheme(event.payload.theme);
});

if (import.meta.hot) import.meta.hot.dispose(unsubscribeThemeRequests);

/** The icon describes the theme that clicking the button will activate. */
export function createThemeSwitcher(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-button';
  const render = (): void => {
    const label = translate(current === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = current === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg>';
  };
  button.addEventListener('click', () => {
    eventBus.publish('presentation.main.theme.change.requested', 'theme-switcher', {
      theme: current === 'dark' ? 'light' : 'dark',
    });
  });
  onThemeChange(render);
  onLocaleChange(render);
  render();
  return button;
}
