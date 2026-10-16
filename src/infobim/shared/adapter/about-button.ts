import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { onLocaleChange, translate } from '@/infobim/shared/plugin/i18n';

type Package = { name: string; label: string; version: string | null };

/**
 * The discreet question mark at the bottom right, in the status bar. A click opens a menu
 * that rises above it with the versions of the packages installed in the Python
 * runtime of the application, and closes it again; it also closes on a click anywhere else
 * and on Escape. Opening it publishes `presentation.main.about.requested`, and
 * the versions arrive in `presentation.main.about.found`: until they do, the menu
 * says it is looking them up. The button only shows and reports; what the request
 * means is up to the listeners.
 */
export function createAboutButton(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'about';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-button about-button';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5.1.6c0 1.7-2.6 2.2-2.6 3.9"/><path d="M12 17.2v.1"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'about-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  wrapper.append(button, menu);

  let packages: Package[] | null = null;
  const draw = (): void => {
    const title = document.createElement('div');
    title.className = 'about-menu-title';
    title.textContent = translate('about.title');
    const rows = packages === null
      ? [Object.assign(document.createElement('div'), { className: 'about-menu-row about-menu-loading', textContent: translate('about.loading') })]
      : packages.map((entry) => {
        const row = document.createElement('div');
        row.className = 'about-menu-row';
        row.setAttribute('role', 'menuitem');
        const name = document.createElement('span');
        name.textContent = entry.label;
        const version = document.createElement('span');
        version.className = 'about-menu-version';
        version.textContent = entry.version ?? translate('about.unavailable');
        row.append(name, version);
        return row;
      });
    menu.replaceChildren(title, ...rows);
    button.title = translate('about.button');
    button.setAttribute('aria-label', button.title);
  };

  const close = (): void => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!menu.hidden) return close();
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    eventBus.publish('presentation.main.about.requested', 'about-button');
  });
  document.addEventListener('click', (event) => { if (!menu.hidden && !wrapper.contains(event.target as Node)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) { close(); button.focus(); } });
  eventBus.subscribe('presentation.main.about.found', ({ payload }) => {
    packages = payload?.packages ?? [];
    draw();
  });
  onLocaleChange(draw);
  draw();
  return wrapper;
}
