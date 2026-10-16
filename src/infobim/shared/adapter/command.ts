import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type {
  PythonCommandResult,
  PythonFeatureDevice,
  PythonFeatureEnvironment,
  PythonFeatureMessageResult,
  PythonMount,
  PythonPackageVersionsResult,
} from '@/infobim/shared/domain/model/python-command';

/** Run one CLI command in the runtime and wait for its correlated reply. */
export function runPythonCommand(source: string, argv: string[], mount: PythonMount): Promise<PythonCommandResult> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const stop = (): void => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
    const unsubscribeCompleted = eventBus.subscribe('presentation.python.command.completed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      resolve(event.payload);
    });
    const unsubscribeFailed = eventBus.subscribe('presentation.python.command.failed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      reject(new Error(event.payload.message));
    });
    eventBus.publish('presentation.python.command.requested', source, { requestId, argv, mount });
  });
}

/** Look up a feature's first message and wait for its correlated reply. */
export function runFeatureMessageQuery(
  source: string,
  identifier: string,
  device: PythonFeatureDevice,
  environment: PythonFeatureEnvironment,
  language: string,
  parameters?: Record<string, string>,
): Promise<PythonFeatureMessageResult> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const stop = (): void => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
    const unsubscribeCompleted = eventBus.subscribe('presentation.brasidatacenter.message.completed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      resolve(event.payload);
    });
    const unsubscribeFailed = eventBus.subscribe('presentation.brasidatacenter.message.failed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      reject(new Error(event.payload.message));
    });
    eventBus.publish('presentation.brasidatacenter.message.requested', source, {
      requestId, identifier, device, environment, language, parameters,
    });
  });
}

/** Resolves once the Python runtime is ready; rejects if it fails to start. */
export function waitForPythonReady(): Promise<void> {
  let currentlyReady = false;
  const unsubscribeReported = eventBus.subscribe('presentation.python.state.reported', ({ payload }) => {
    currentlyReady = Boolean(payload?.ready);
  });
  eventBus.publish('presentation.python.state.requested', 'wait-for-python-ready');
  unsubscribeReported();
  if (currentlyReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const stop = (): void => {
      unsubscribeReady();
      unsubscribeFailed();
    };
    const unsubscribeReady = eventBus.subscribe('presentation.python.ready', () => {
      stop();
      resolve();
    });
    const unsubscribeFailed = eventBus.subscribe('presentation.python.failed', ({ payload }) => {
      stop();
      reject(new Error(payload?.message ?? 'The Python runtime failed to start.'));
    });
  });
}

/** Ask the runtime which versions of the packages are installed in it, and wait for its correlated reply. */
export function runPackageVersionsQuery(source: string, packages: string[]): Promise<PythonPackageVersionsResult> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const stop = (): void => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
    const unsubscribeCompleted = eventBus.subscribe('presentation.python.packages.completed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      resolve(event.payload);
    });
    const unsubscribeFailed = eventBus.subscribe('presentation.python.packages.failed', (event) => {
      if (event.payload?.requestId !== requestId) return;
      stop();
      reject(new Error(event.payload.message));
    });
    eventBus.publish('presentation.python.packages.requested', source, { requestId, packages });
  });
}
