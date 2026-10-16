import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { translate, timeFormatter } from '@/infobim/shared/plugin/i18n';

// The plugin keeps listening after Dockview disposes the mounted panel.
let reopenScheduled = false;
let pluginDisposed = false;
const unsubscribeReopening = eventBus.subscribe('presentation.main.panel.closed', ({ payload }) => {
  if (payload?.id !== 'debug' || reopenScheduled) return;
  reopenScheduled = true;
  // Reopen after Dockview finishes removing the old tab, regardless of project state.
  queueMicrotask(() => {
    reopenScheduled = false;
    if (pluginDisposed) return;
    eventBus.publish('presentation.main.panel.open.requested', 'debug', {
      container: 'bottom',
      id: 'debug',
      component: 'debug',
      title: translate('events.tab'),
    });
  });
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  pluginDisposed = true;
  unsubscribeReopening();
});

export default function makeDebug() {
  const root = document.createElement('div');
  root.className = 'panel-content system-events-panel';
  root.innerHTML = `
    <div class="system-events-output" id="system-events-output"></div>
  `;

  const output = root.querySelector<HTMLDivElement>('#system-events-output');

  const append = (text: string, tone: 'info' | 'warn' = 'info') => {
    if (!output) return;
    const line = document.createElement('div');
    line.className = `system-event ${tone}`;
    const ts = timeFormatter().format(new Date());
    line.innerHTML = `<span class="evt-time">[${ts}]</span> ${text}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  };

  append(translate('events.ready'));

  const unsub = eventBus.subscribe('*', (event: AppEvent) => {
    if (event.source === 'debug' || QUIET_EVENT_TYPES.has(event.type)) return;
    const meta = event.payload !== undefined
      ? ` <span class="evt-payload">${escapeHtml(truncate(JSON.stringify(event.payload), MAX_LOGGED_PAYLOAD_CHARS))}</span>`
      : '';
    append(`<span class="evt-type">${escapeHtml(event.type)}</span> ← <span class="evt-source">${escapeHtml(event.source)}</span>${meta}`);
  });

  return { element: root, dispose: unsub };
}

// Per-line terminal output already shows in the terminal; logging it would flood the log.
const QUIET_EVENT_TYPES = new Set(['terminal.output']);

// Large payloads (e.g. a whole project tree) are cut so the log stays readable.
const MAX_LOGGED_PAYLOAD_CHARS = 120;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
