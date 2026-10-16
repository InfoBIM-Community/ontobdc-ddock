
import { translate } from '@/infobim/shared/plugin/i18n';
import { SUPPORTED_LOCALES, getLocale, onLocaleChange, setLocale, type Locale } from '@/infobim/shared/plugin/i18n';

const FLAGS: Partial<Record<Locale, string>> = {
  'pt-BR': `<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#009c3b"/><path d="M10 1.8 18 7l-8 5.2L2 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="2.9" fill="#002776"/><path d="M7.3 6.3q2.7-.5 5.5 1" stroke="#fff" stroke-width=".5" fill="none"/></svg>`,
  'es-ES': `<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#aa151b"/><rect y="3.5" width="20" height="7" fill="#f1bf00"/></svg>`,
  en: `<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#fff"/><path d="M0 1h20M0 5h20M0 9h20M0 13h20" stroke="#b22234" stroke-width="2"/><rect width="9" height="7.5" fill="#3c3b6e"/></svg>`,
};

/** Display each discovered language in its own language, without a fixed list. */
function languageName(locale: Locale): string {
  return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
}

/** Builds the flag button and language menu used in the title bar. */
export function createLanguageSwitcher(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'lang-switcher';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lang-button';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  root.appendChild(button);

  const menu = document.createElement('div');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  root.appendChild(menu);

  const options = new Map<Locale, HTMLButtonElement>();
  for (const locale of SUPPORTED_LOCALES) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'lang-option';
    option.setAttribute('role', 'menuitemradio');
    option.lang = locale;
    option.innerHTML = `<span class="lang-flag">${FLAGS[locale] ?? ''}</span><span></span>`;
    option.lastElementChild!.textContent = languageName(locale);
    option.addEventListener('click', () => {
      setLocale(locale);
      close();
      button.focus();
    });
    options.set(locale, option);
    menu.appendChild(option);
  }

  const render = (): void => {
    const locale = getLocale();
    button.innerHTML = `<span class="lang-flag">${FLAGS[locale] ?? ''}</span><span class="lang-code"></span>`;
    button.lastElementChild!.textContent = locale;
    const label = `${translate('lang.label')}: ${languageName(locale)}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    menu.setAttribute('aria-label', translate('lang.label'));
    for (const [value, option] of options) {
      option.setAttribute('aria-checked', String(value === locale));
    }
  };

  const onDocPointer = (e: MouseEvent): void => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { close(); button.focus(); }
  };

  function open(): void {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocPointer, true);
    document.addEventListener('keydown', onKey, true);
    options.get(getLocale())?.focus();
  }

  function close(): void {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocPointer, true);
    document.removeEventListener('keydown', onKey, true);
  }

  button.addEventListener('click', () => (menu.hidden ? open() : close()));
  onLocaleChange(render);
  render();
  return root;
}

