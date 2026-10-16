import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { AppEventType } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

/**
 * A registrable listener: a class with a static METADATA. Each time one of the
 * events in METADATA's `listen` is published, it is built with that event and
 * its `run` is called.
 */
export type ListenerClass = {
  METADATA: ListenerMetadata;
  new (event: AppEvent): { run(): void | Promise<void> };
};

type ListenerModule = Record<string, unknown>;
type ListenerImports = Record<string, () => Promise<ListenerModule>>;

/** Discover every <module>/plugin/listener file without executing it yet. */
const listenerImports = import.meta.glob<ListenerModule>([
  '../../*/plugin/listener/*.ts',
  '!../../*/plugin/listener/*.d.ts',
]);

const isRegistrable = (value: unknown): value is ListenerClass => {
  if (typeof value !== 'function') return false;
  const metadata: unknown = (value as unknown as { METADATA?: unknown }).METADATA;
  return typeof metadata === 'object' && metadata !== null
    && Array.isArray((metadata as { arguments?: unknown }).arguments);
};

/** A failing listener never stops the application: log it and publish the exception. */
const reportException = (message: string, error?: unknown): void => {
  console.error(message, ...(error === undefined ? [] : [error]));
  const reason = error instanceof Error ? error.message : error === undefined ? '' : String(error);
  eventBus.publish('presentation.exception.listener.raised', 'listener-loader', { message: reason ? `${message} ${reason}` : message });
};

/**
 * Scans the listener folders of all modules, picks the exported classes that
 * carry a METADATA, and subscribes each one to the events its `listen` names.
 * Files are read in ascending path order, independent of filesystem order.
 * A file that cannot be loaded, or a class without run(), is reported as an
 * exception and skipped; the others are still registered.
 */
export class ListenerLoader {
  constructor(private readonly imports: ListenerImports = listenerImports) {}

  /** Registers every listener found; the result unsubscribes them all. */
  async load(): Promise<() => void> {
    const unsubscribe: Array<() => void> = [];

    for (const filePath of Object.keys(this.imports).sort()) {
      let listenerModule: ListenerModule;
      try {
        listenerModule = await this.imports[filePath]();
      } catch (error) {
        reportException(`Listener file ${filePath} could not be loaded.`, error);
        continue;
      }

      for (const exported of Object.values(listenerModule)) {
        if (!isRegistrable(exported)) continue;
        if (typeof exported.prototype.run !== 'function') {
          reportException(`Listener ${exported.METADATA.id} in ${filePath} must implement run().`);
          continue;
        }
        unsubscribe.push(...this.register(exported));
      }
    }

    return () => unsubscribe.forEach((dispose) => dispose());
  }

  private register(listener: ListenerClass): Array<() => void> {
    const events = new Set(listener.METADATA.arguments.flatMap((argument) => argument.listen));

    return [...events].map((name) =>
      // METADATA names are strings; the bus accepts a name that is not in the catalog.
      eventBus.subscribe(name as AppEventType, (event) => {
        Promise.resolve()
          .then(() => new listener(event).run())
          .catch((error: unknown) => reportException(`Listener ${listener.METADATA.id} failed on ${name}.`, error));
      }),
    );
  }
}
