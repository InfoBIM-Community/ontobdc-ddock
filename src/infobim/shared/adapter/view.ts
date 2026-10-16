
import type { createDockview } from 'dockview';
import { eventBus } from '@/infobim/shared/adapter/event-bus';

/** Observe native removals so all tabs in this container publish the same event. */
export function observePanelClosures(
  dockview: ReturnType<typeof createDockview>,
  container: string,
): () => void {
  const listener = dockview.onDidRemovePanel((panel) => {
    eventBus.publish('presentation.main.panel.closed', container, {
      container,
      id: panel.id,
      title: panel.title,
    });
  });
  // Unsubscribe before disposing the layout to avoid reporting teardown as user closure.
  return () => listener.dispose();
}

/** What a panel factory returns: its element, and how to tear it down. */
export type Mountable = {
  element: HTMLElement;
  /** Called after Dockview initializes and attaches the panel element. */
  mounted?: () => void;
  dispose?: () => void;
};

/** Builds a panel; `id` is the Dockview panel id (e.g. which file a viewer shows). */
export type PanelFactory = (panel: { id: string }) => HTMLElement | Mountable;

export function toMountable(result: HTMLElement | Mountable): Mountable {
  if (result instanceof HTMLElement) return { element: result, dispose: () => result.remove() };
  return result;
}

export function createDockComponentFactory(
  factories: Record<string, PanelFactory>,
): DockviewComponentFactory {
  return ({ id, name }) => {
    const factory = factories[name];
    if (!factory) throw new Error(`Unknown Dockview component: ${name}`);
    const mountable = toMountable(factory({ id }));
    let disposed = false;
    return {
      get element() { return mountable.element; },
      init: () => {
        queueMicrotask(() => {
          if (!disposed && mountable.element.isConnected) mountable.mounted?.();
        });
      },
      dispose: () => { disposed = true; mountable.dispose?.(); },
    };
  };
}

type DockviewComponentFactory = NonNullable<Parameters<typeof createDockview>[1]> extends never
  ? never
  : Exclude<Parameters<typeof createDockview>[1], undefined>['createComponent'];
