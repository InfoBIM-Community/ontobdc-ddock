
import type { AppEventMap, AppEventType } from '@/infobim/shared/domain/model/event';

export type AppEvent<T = unknown> = {
  type: string;
  source: string;
  payload?: T;
  timestamp: number;
};

/** The event a handler of `type` receives; `'*'` receives every event, untyped. */
export type EventOf<K extends AppEventType | '*'> = K extends AppEventType
  ? AppEvent<AppEventMap[K]> & { type: K }
  : AppEvent;

type EventHandler<K extends AppEventType | '*'> = (event: EventOf<K>) => void;

/** Events without a payload take none; the others require theirs. */
type PayloadArgs<K extends AppEventType> = AppEventMap[K] extends undefined ? [] : [payload: AppEventMap[K]];

class EventBus {
  private readonly handlers = new Map<string, Set<(event: AppEvent) => void>>();

  subscribe<K extends AppEventType | '*'>(type: K, handler: EventHandler<K>): () => void {
    const handlers = this.handlers.get(type) ?? new Set<(event: AppEvent) => void>();
    const wrapped = handler as (event: AppEvent) => void;
    handlers.add(wrapped);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(wrapped);
      if (handlers.size === 0) this.handlers.delete(type);
    };
  }

  publish<K extends AppEventType>(type: K, source: string, ...[payload]: PayloadArgs<K>): EventOf<K> {
    const event = {
      type,
      source,
      payload,
      timestamp: Date.now(),
    } as EventOf<K>;

    this.handlers.get(type)?.forEach((handler) => handler(event));
    this.handlers.get('*')?.forEach((handler) => handler(event));
    return event;
  }
}

export const eventBus = new EventBus();
