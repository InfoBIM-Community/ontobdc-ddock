import { applyTranslations, onLocaleChange } from '@/infobim/shared/plugin/i18n';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { createAboutButton } from '@/infobim/shared/adapter/about-button';
import { createLanguageSwitcher } from '@/infobim/shared/adapter/language';
import { createThemeSwitcher } from '@/infobim/shared/adapter/theme';
import { mountPythonStatus } from '@/infobim/web/adapter/python-status';
import infoBimLogo from '@/asset/infobim-ico.png';
import '@/infobim/web/plugin/asset/ad-slot.css';

let disposePythonStatus: (() => void) | undefined;
let removeViewportListener: (() => void) | undefined;
let removeLocaleListener: (() => void) | undefined;

/**
 * Renders the static shell: titlebar, activity bar, the pane frames that host
 * the explorer and the three Dockview instances, splitters and status bar.
 */
export function renderShell(app: HTMLElement): void {
  removeViewportListener?.();
  removeLocaleListener?.();
  disposePythonStatus?.();
  app.innerHTML = `
    <div class="shell">
      <header class="titlebar">
        <span class="brand"><img class="brand-logo" src="${infoBimLogo}" alt="" /><span>Info<span class="brand-bim">BIM</span></span></span>
        <span class="project" data-i18n="titlebar.noProject"></span>
      </header>
      <div class="workspace">
        <nav class="activitybar" data-i18n-aria-label="nav.primary">
          <button class="activity active" data-view="explorer" aria-pressed="true" data-i18n-title="nav.project" data-i18n-aria-label="nav.project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 2h6l6 6v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/>
              <path d="M14 2v6h6M3 5v14a4 4 0 0 0 4 4h10"/>
            </svg>
          </button>
          <button class="activity" data-view="database" aria-pressed="false" data-i18n-title="nav.database" data-i18n-aria-label="nav.database">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 6.5 12 4l9 2.5-9 2.5Z"/>
              <path d="M3 11.5 12 14l9-2.5"/>
              <path d="M3 16.5 12 19l9-2.5"/>
            </svg>
          </button>
        </nav>
        <section class="pane explorer-pane" data-i18n-aria-label="pane.explorer">
          <div class="pane-header"><span class="explorer-pane-title" data-i18n="pane.explorer.header"></span><span></span></div>
          <div class="pane-body" id="explorer-host"></div>
        </section>
        <div class="splitter splitter-horizontal explorer" data-panel="explorer" data-direction="horizontal" role="separator" aria-orientation="vertical" tabindex="0"></div>
        <section class="pane surface-pane" data-i18n-aria-label="pane.home">
          <div class="pane-header"><span>SURFACE</span><span></span></div>
          <div class="pane-body">
            <main id="dockview" class="dockview-host"></main>
          </div>
        </section>
        <div class="splitter splitter-horizontal llm" data-panel="llm" data-direction="horizontal" role="separator" aria-orientation="vertical" tabindex="0"></div>
        <section class="pane llm-pane" data-i18n-aria-label="pane.assistant">
          <div class="pane-header"><span class="assistant-title" data-i18n="pane.assistant.header"></span><span></span></div>
          <div class="pane-body dockview-host" id="llm-host"></div>
        </section>
        <div class="splitter splitter-vertical" data-panel="terminal" data-direction="vertical" role="separator" aria-orientation="horizontal" tabindex="0"></div>
        <section class="pane terminal-pane" data-i18n-aria-label="pane.bottom">
          <div class="bottom-strip">
            <div class="pane-body dockview-host" id="terminal-host"></div>
            <aside class="ad-slot" data-ad-slot="bottom-right" data-ad-state="house" data-i18n-aria-label="ad.house.label">
              <span class="ad-slot-text" data-i18n="ad.house.text"></span>
              <svg class="ad-slot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 10v4a2 2 0 0 0 2 2h2l7 3V5L8 8H6a2 2 0 0 0-2 2Z"/>
                <path d="m8 16 1 4h3"/>
                <path d="M18 9.5a4 4 0 0 1 0 5"/>
                <path d="M20 7a7 7 0 0 1 0 10"/>
              </svg>
            </aside>
          </div>
        </section>
      </div>
      <footer class="statusbar">
        <span class="statusbar-left">
          <span class="statusbar-label" data-i18n="statusbar.workspace"></span>
          <span class="statusbar-permission" data-state="disconnected">
            <span class="statusbar-permission-dot" aria-hidden="true"></span>
            <span class="statusbar-permission-label" data-i18n="statusbar.permission.disconnected"></span>
          </span>
          <span class="statusbar-project-availability"></span>
        </span>
        <span id="version-status"></span>
      </footer>
    </div>
  `;
  applyTranslations(app);
  removeLocaleListener = onLocaleChange(() => applyTranslations(app));
  disposePythonStatus = mountPythonStatus(app.querySelector<HTMLElement>('.statusbar-left')!);
  const titlebar = app.querySelector<HTMLElement>('.titlebar')!;
  const llmPane = app.querySelector<HTMLElement>('.llm-pane')!;
  const assistantHeader = llmPane.querySelector<HTMLElement>('.pane-header')!;
  const bottomStrip = app.querySelector<HTMLElement>('.bottom-strip')!;
  const adSlot = app.querySelector<HTMLElement>('.ad-slot')!;
  const project = app.querySelector<HTMLElement>('.project')!;
  const languageSwitcher = createLanguageSwitcher();
  const titlebarActions = document.createElement('div');
  titlebarActions.className = 'titlebar-actions';
  titlebarActions.append(languageSwitcher, createThemeSwitcher());
  app.querySelector<HTMLElement>('#version-status')!.append(createAboutButton());
  titlebar.append(titlebarActions);

  // Move the same elements so their state survives viewport changes: the project
  // name into the assistant header, and the ad slot below the assistant panel.
  const mobileViewport = window.matchMedia('(max-width: 768px)');
  const placeForViewport = (): void => {
    if (mobileViewport.matches) {
      assistantHeader.prepend(project);
      llmPane.after(adSlot);
    } else {
      titlebar.insertBefore(project, titlebarActions);
      bottomStrip.append(adSlot);
    }
  };
  placeForViewport();
  mobileViewport.addEventListener('change', placeForViewport);
  removeViewportListener = () => mobileViewport.removeEventListener('change', placeForViewport);
  eventBus.publish('presentation.main.layout.loaded', 'layout');
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  removeViewportListener?.();
  removeLocaleListener?.();
  disposePythonStatus?.();
});
