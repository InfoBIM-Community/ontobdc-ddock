import { eventBus } from '@/infobim/shared/adapter/event-bus';

/** Mount a runtime indicator; return cleanup for all its subscriptions. */
export function mountPythonStatus(host: HTMLElement): () => void {
  const indicator = document.createElement('span');
  indicator.className = 'python-status';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  const update = (connected: boolean): void => {
    const label = `Pyodide: ${connected ? 'connected' : 'disconnected'}`;
    indicator.dataset.state = connected ? 'connected' : 'unplugged';
    indicator.title = label;
    indicator.setAttribute('aria-label', label);
    const paths = connected
      ? '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0ZM12 17v5"/>'
      : '<path d="m3 3 18 18M9 3v3M15 3v5M12 8h5v4M7 8v4a5 5 0 0 0 5 5M12 17v5"/>';
    indicator.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  };
  update(false);
  host.prepend(indicator);
  const unsubscribe = [
    eventBus.subscribe('presentation.python.state.reported', ({ payload }) => update(payload?.ready ?? false)),
    eventBus.subscribe('presentation.python.ready', () => update(true)),
    eventBus.subscribe('presentation.python.loading', () => update(false)),
    eventBus.subscribe('presentation.python.failed', () => update(false)),
    eventBus.subscribe('presentation.python.disconnected', () => update(false)),
  ];
  eventBus.publish('presentation.python.state.requested', 'python-status');
  return () => {
    unsubscribe.forEach((dispose) => dispose());
    indicator.remove();
  };
}
