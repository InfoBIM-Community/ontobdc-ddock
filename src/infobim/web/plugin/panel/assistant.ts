import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { translate } from '@/infobim/shared/plugin/i18n';
import type { Mountable } from '@/infobim/shared/adapter/view';

// The plugin keeps listening after Dockview disposes the mounted panel.
let reopenScheduled = false;
let pluginDisposed = false;
const unsubscribeReopening = eventBus.subscribe('presentation.main.panel.closed', ({ payload }) => {
  if (payload?.id !== 'assistant' || reopenScheduled) return;
  reopenScheduled = true;
  // Reopen after Dockview finishes removing the old tab, regardless of project state.
  queueMicrotask(() => {
    reopenScheduled = false;
    if (pluginDisposed) return;
    eventBus.publish('presentation.main.panel.open.requested', 'assistant', {
      container: 'assistant',
      id: 'assistant',
      component: 'assistant',
      title: translate('assistant.tab'),
    });
  });
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  pluginDisposed = true;
  unsubscribeReopening();
});

/** Content host for the Assistant tab, discovered by the panel plugin loader. */
export default function makeAssistant(): Mountable {
  const element = document.createElement('div');
  element.className = 'panel-content assistant-panel';

  const chat = document.createElement('div');
  chat.className = 'assistant-chat';
  element.appendChild(chat);

  const unsubscribeMessage = eventBus.subscribe('presentation.assistant.message.sent', ({ payload }) => {
    if (!payload) return;
    const bubble = document.createElement('p');
    bubble.className = 'assistant-bubble';
    bubble.textContent = payload.text;
    chat.appendChild(bubble);
  });

  return {
    element,
    dispose: () => {
      unsubscribeMessage();
      element.remove();
    },
  };
}
