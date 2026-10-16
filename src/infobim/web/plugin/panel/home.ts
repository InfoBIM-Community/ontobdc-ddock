import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { applyTranslations, translate as t, type MessageKey } from '@/infobim/shared/plugin/i18n';
import type { Mountable } from '@/infobim/shared/adapter/view';

export { makeHome as default };

// These listeners belong to the plugin, not the mounted panel: Dockview disposes
// the panel before publishing its removal, so instance subscriptions are gone.
let waitingForProjectState = false;
let reopenScheduled = false;
let pluginDisposed = false;
const unsubscribeReopening = [
  eventBus.subscribe('presentation.main.panel.closed', ({ payload }) => {
    if (payload?.id !== 'home' || reopenScheduled) return;
    reopenScheduled = true;
    // Wait until Dockview finishes removing the old tab before adding another.
    queueMicrotask(() => {
      reopenScheduled = false;
      if (pluginDisposed) return;
      waitingForProjectState = true;
      eventBus.publish('presentation.project.state.requested', 'home');
    });
  }),
  eventBus.subscribe('presentation.project.state.reported', ({ payload }) => {
    if (!waitingForProjectState || !payload) return;
    waitingForProjectState = false;
    if (payload.project) return;
    eventBus.publish('presentation.main.panel.open.requested', 'home', {
      container: 'surface',
      id: 'home',
      component: 'home',
      title: t('home.tab'),
    });
  }),
];

if (import.meta.hot) import.meta.hot.dispose(() => {
  pluginDisposed = true;
  unsubscribeReopening.forEach((unsubscribe) => unsubscribe());
});

const HOME_START_HTML = `
  <section class="home-start" aria-labelledby="home-start-title">
    <h1 id="home-start-title" data-i18n="home.start"></h1>
    <button type="button" class="home-action" data-action="new">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 27H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h9l7 8v4M15 2v8h8"/>
        <circle cx="22" cy="23" r="8" fill="currentColor" stroke="none"/>
        <path d="M22 18v10m-5-5h10" stroke="var(--background)"/>
      </svg>
      <span data-i18n="home.newProject"></span>
    </button>
    <button type="button" class="home-action" data-action="open">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 25V7a3 3 0 0 1 3-3h5l5 5h8a3 3 0 0 1 3 3v2M3 25l5-11h19a3 3 0 0 1 3 4l-4 8a4 4 0 0 1-3 2H6a3 3 0 0 1-3-3Z"/>
      </svg>
      <span data-i18n="home.openProject"></span>
    </button>
    <button type="button" class="home-action" data-action="connect">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 10H9a6 6 0 0 0 0 12h3m8-12h3a6 6 0 0 1 0 12h-3M10 16h12"/>
      </svg>
      <span data-i18n="home.connectTo"></span>
    </button>
  </section>
`;

const HOME_CREATE_HTML = `
  <form class="home-create" aria-labelledby="home-create-title">
    <h1 id="home-create-title" data-i18n="home.create.title"></h1>
    <label class="home-create-field">
      <span data-i18n="home.create.name"></span>
      <input name="name" required autocomplete="off" />
    </label>
    <p class="home-create-hint" data-i18n="home.create.hint"></p>
    <p class="home-create-error" role="alert" hidden></p>
    <div class="home-create-actions">
      <button type="submit" class="home-create-submit" data-i18n="home.create.submit"></button>
      <button type="button" class="home-create-cancel" data-i18n="home.create.cancel"></button>
    </div>
  </form>
`;

const HOME_CONNECT_HTML = `
  <form class="home-create" aria-labelledby="home-connect-title" novalidate>
    <h1 id="home-connect-title" data-i18n="home.connect.title"></h1>
    <label class="home-create-field">
      <span data-i18n="home.connect.url"></span>
      <input name="url" type="url" required autocomplete="off" inputmode="url" />
    </label>
    <label class="home-create-field">
      <span data-i18n="home.connect.accessCode"></span>
      <input name="accessCode" type="password" autocomplete="off" />
    </label>
    <p class="home-create-hint" data-i18n="home.connect.hint"></p>
    <p class="home-create-error" role="alert" hidden></p>
    <div class="home-create-actions">
      <button type="submit" class="home-create-submit" data-i18n="home.connect.submit"></button>
      <button type="button" class="home-create-cancel" data-i18n="home.create.cancel"></button>
    </div>
  </form>
`;

/** Creating needs the File System Access API; the read-only fallback cannot write. */
const canCreate = (): boolean => 'showDirectoryPicker' in window;

/** The normalized URL when `value` is an http(s) address, otherwise null. */
const parseHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * Home shows Start until a project is being opened or created. New Project
 * asks for the project's name and then publishes `presentation.project.new.requested`
 * (the folder is picked next); a cancelled picker or a failed creation keeps
 * the form, with the error. While Python creates or inspects the project it
 * shows a loading indicator, and nothing once `presentation.project.local.opened` or
 * `presentation.project.remote.opened` arrives. A failed open brings Start back so the
 * user can try again.
 */
export function makeHome(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content home';
  let pythonReady = false;
  let state: 'start' | 'form' | 'loading' | 'cleared' = 'start';
  /** The name typed in the form, kept while the folder is picked and if creating fails. */
  let projectName = '';
  /** What the loading indicator is waiting for, once Python is ready. */
  let loadingKey: MessageKey = 'home.loading.project';

  const renderStart = (error?: string): void => {
    state = 'start';
    root.innerHTML = HOME_START_HTML;
    applyTranslations(root);
    if (error) {
      const message = document.createElement('p');
      message.className = 'home-create-error';
      message.setAttribute('role', 'alert');
      message.textContent = error;
      root.append(message);
    }
    const newButton = root.querySelector<HTMLButtonElement>('.home-action[data-action="new"]');
    if (newButton && !canCreate()) {
      newButton.disabled = true;
      newButton.dataset.i18nTitle = 'home.newProject.unsupported';
      newButton.title = t('home.newProject.unsupported');
    }
    newButton?.addEventListener('click', () => renderForm());
    root.querySelector('.home-action[data-action="connect"]')?.addEventListener('click', () => renderConnectForm());
    root.querySelector('.home-action[data-action="open"]')?.addEventListener('click', () => {
      eventBus.publish('presentation.project.open.requested', 'home');
    });
  };

  const renderForm = (error: string | null = null): void => {
    state = 'form';
    root.innerHTML = HOME_CREATE_HTML;
    applyTranslations(root);
    const form = root.querySelector<HTMLFormElement>('.home-create');
    const input = root.querySelector<HTMLInputElement>('input[name="name"]');
    const errorLine = root.querySelector<HTMLParagraphElement>('.home-create-error');
    if (!form || !input || !errorLine) return;
    input.value = projectName;
    if (error) {
      errorLine.hidden = false;
      errorLine.textContent = error;
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      projectName = input.value.trim();
      if (!projectName) return;
      // Published inside the submit, so the folder picker keeps the user gesture.
      eventBus.publish('presentation.project.new.requested', 'home', { name: projectName });
    });
    root.querySelector('.home-create-cancel')?.addEventListener('click', () => {
      projectName = '';
      renderStart();
    });
    input.focus();
  };

  const renderConnectForm = (): void => {
    state = 'form';
    root.innerHTML = HOME_CONNECT_HTML;
    applyTranslations(root);
    const form = root.querySelector<HTMLFormElement>('.home-create');
    const input = root.querySelector<HTMLInputElement>('input[name="url"]');
    const accessCode = root.querySelector<HTMLInputElement>('input[name="accessCode"]');
    const errorLine = root.querySelector<HTMLParagraphElement>('.home-create-error');
    if (!form || !input || !accessCode || !errorLine) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const url = parseHttpUrl(input.value.trim());
      if (!url) {
        errorLine.hidden = false;
        errorLine.textContent = t('home.connect.invalidUrl');
        return;
      }
      errorLine.hidden = true;
      const apiToken = accessCode.value.trim();
      eventBus.publish('presentation.project.connect.requested', 'home', apiToken ? { url, apiToken } : { url });
    });
    root.querySelector('.home-create-cancel')?.addEventListener('click', () => renderStart());
    input.focus();
  };

  const renderLoading = (key: MessageKey): void => {
    state = 'loading';
    loadingKey = key;
    const box = document.createElement('div');
    box.className = 'home-loading';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('span');
    spinner.className = 'home-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'home-loading-label';
    label.dataset.i18n = pythonReady ? key : 'home.loading.python';
    box.append(spinner, label);
    root.replaceChildren(box);
    applyTranslations(root);
  };

  const setLoadingLabel = (key: MessageKey): void => {
    const label = root.querySelector<HTMLElement>('.home-loading-label');
    if (!label) return;
    label.dataset.i18n = key;
    label.textContent = t(key);
  };

  const updatePython = (ready: boolean): void => {
    pythonReady = ready;
    if (state === 'loading') setLoadingLabel(ready ? loadingKey : 'home.loading.python');
  };
  const clearProject = (): void => {
    state = 'cleared';
    projectName = '';
    root.replaceChildren();
  };
  const unsubscribe = [
    eventBus.subscribe('presentation.python.state.reported', ({ payload }) => updatePython(payload?.ready ?? false)),
    eventBus.subscribe('presentation.python.loading', () => updatePython(false)),
    eventBus.subscribe('presentation.python.failed', () => updatePython(false)),
    eventBus.subscribe('presentation.python.disconnected', () => updatePython(false)),
    eventBus.subscribe('presentation.project.state.reported', ({ payload }) => {
      if (payload?.project) clearProject();
    }),
    eventBus.subscribe('presentation.project.create.started', () => renderLoading('home.loading.create')),
    eventBus.subscribe('presentation.project.create.failed', (event) => {
      const failure = event.payload;
      if (!failure) return;
      const message = failure.reason === 'permission-denied'
        ? t('home.create.permissionDenied')
        : t('home.create.error', { message: failure.message ?? failure.reason });
      renderForm(message);
    }),
    eventBus.subscribe('presentation.project.inspect.started', () => renderLoading('home.loading.project')),
    eventBus.subscribe('presentation.python.ready', () => updatePython(true)),
    eventBus.subscribe('presentation.project.local.opened', clearProject),
    eventBus.subscribe('presentation.project.remote.opened', clearProject),
    eventBus.subscribe('presentation.project.open.failed', ({ payload }) => {
      const reason = payload?.reason;
      const key: MessageKey = reason === 'unsupported' ? 'home.open.unsupported'
        : reason === 'permission-denied' ? 'home.open.permissionDenied'
        : reason === 'crate-not-found' || reason === 'crate-invalid' || reason === 'location-not-found' ? 'home.open.invalidProject'
        : reason === 'inspect-failed' ? 'home.open.inspectFailed' : 'home.open.readError';
      const message = payload?.message ?? t(key);
      renderStart(t('home.open.error', { message }));
    }),
  ];

  renderStart();
  eventBus.publish('presentation.python.state.requested', 'home');
  eventBus.publish('presentation.project.state.requested', 'home');
  return {
    element: root,
    dispose: () => {
      unsubscribe.forEach((unsub) => unsub());
      root.remove();
    },
  };
}
