import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { PythonWorkerRequest, PythonWorkerResponse } from '@/infobim/shared/domain/model/python-message';

type PendingKind = 'command' | 'feature-message' | 'package-versions';

/** Register the runtime and command bridge; startup is triggered only by the layout event. */
export function initPython(): () => void {
  let ready = false;
  let worker: Worker | null = null;
  const pending = new Map<string, PendingKind>();

  const publishFailure = (kind: PendingKind, requestId: string, message: string): void => {
    if (kind === 'feature-message') {
      eventBus.publish('presentation.brasidatacenter.message.failed', 'python', { requestId, message });
    } else if (kind === 'package-versions') {
      eventBus.publish('presentation.python.packages.failed', 'python', { requestId, message });
    } else {
      eventBus.publish('presentation.python.command.failed', 'python', { requestId, message });
    }
  };
  const failPending = (message: string): void => {
    const requests = [...pending];
    pending.clear();
    requests.forEach(([requestId, kind]) => publishFailure(kind, requestId, message));
  };
  const fail = (message: string): void => {
    worker?.terminate();
    worker = null;
    ready = false;
    eventBus.publish('presentation.python.failed', 'python', { message });
    failPending(message);
  };

  const unsubscribe = [
    eventBus.subscribe('presentation.python.state.requested', () => {
      eventBus.publish('presentation.python.state.reported', 'python', { ready });
    }),
    eventBus.subscribe('presentation.python.command.requested', ({ payload }) => {
      if (!payload) return;
      if (!worker) {
        eventBus.publish('presentation.python.command.failed', 'python', {
          requestId: payload.requestId, message: 'Python is unavailable. Reload the page to start it.',
        });
        return;
      }
      if (pending.has(payload.requestId)) return;
      pending.set(payload.requestId, 'command');
      try {
        const request: PythonWorkerRequest = { type: 'run', ...payload };
        worker.postMessage(request);
      } catch (error) {
        pending.delete(payload.requestId);
        eventBus.publish('presentation.python.command.failed', 'python', {
          requestId: payload.requestId, message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
    eventBus.subscribe('presentation.brasidatacenter.message.requested', ({ payload }) => {
      if (!payload) return;
      if (!worker) {
        eventBus.publish('presentation.brasidatacenter.message.failed', 'python', {
          requestId: payload.requestId, message: 'Python is unavailable. Reload the page to start it.',
        });
        return;
      }
      if (pending.has(payload.requestId)) return;
      pending.set(payload.requestId, 'feature-message');
      try {
        const request: PythonWorkerRequest = { type: 'feature-message', ...payload };
        worker.postMessage(request);
      } catch (error) {
        pending.delete(payload.requestId);
        eventBus.publish('presentation.brasidatacenter.message.failed', 'python', {
          requestId: payload.requestId, message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
    eventBus.subscribe('presentation.python.packages.requested', ({ payload }) => {
      if (!payload) return;
      if (!worker) {
        eventBus.publish('presentation.python.packages.failed', 'python', {
          requestId: payload.requestId, message: 'Python is unavailable. Reload the page to start it.',
        });
        return;
      }
      if (pending.has(payload.requestId)) return;
      pending.set(payload.requestId, 'package-versions');
      try {
        const request: PythonWorkerRequest = { type: 'package-versions', ...payload };
        worker.postMessage(request);
      } catch (error) {
        pending.delete(payload.requestId);
        eventBus.publish('presentation.python.packages.failed', 'python', {
          requestId: payload.requestId, message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
    eventBus.subscribe('presentation.main.layout.loaded', () => {
      if (worker) return;
      eventBus.publish('presentation.python.loading', 'python');
      try {
        worker = new Worker(new URL('./python-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }: MessageEvent<PythonWorkerResponse>) => {
          if (data.type === 'failed') return fail(data.message);
          if (data.type === 'ready') {
            ready = true;
            eventBus.publish('presentation.python.ready', 'python', { infobimVersion: data.infobimVersion });
            return;
          }
          const kind = pending.get(data.requestId);
          if (kind === undefined) return;
          pending.delete(data.requestId);
          if (data.type === 'result') {
            eventBus.publish('presentation.python.command.completed', 'python', {
              requestId: data.requestId, code: data.code, stdout: data.stdout, stderr: data.stderr,
            });
          } else if (data.type === 'feature-message-result') {
            eventBus.publish('presentation.brasidatacenter.message.completed', 'python', {
              requestId: data.requestId, text: data.text,
            });
          } else if (data.type === 'package-versions-result') {
            eventBus.publish('presentation.python.packages.completed', 'python', {
              requestId: data.requestId, versions: data.versions,
            });
          } else {
            publishFailure(kind, data.requestId, data.message);
          }
        };
        worker.onerror = (event) => {
          event.preventDefault();
          fail(event.message || 'The Python worker failed to start.');
        };
        worker.onmessageerror = () => fail('Unable to read a message from the Python worker.');
        worker.postMessage({ type: 'start' } satisfies PythonWorkerRequest);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }),
  ];

  return () => {
    unsubscribe.forEach((dispose) => dispose());
    const wasActive = worker !== null;
    worker?.terminate();
    worker = null;
    ready = false;
    if (wasActive) eventBus.publish('presentation.python.disconnected', 'python');
    failPending('The Python runtime was stopped.');
  };
}
