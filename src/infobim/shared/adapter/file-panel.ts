import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { readProjectFile } from '@/infobim/shared/adapter/project-file';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import type { Mountable, PanelFactory } from '@/infobim/shared/adapter/view';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import { translate } from '@/infobim/shared/plugin/i18n';

/** The events published when the tab of a file is closed. */
export type FileClosedEvent = {
  [K in keyof AppEventMap]: AppEventMap[K] extends { item: string } ? (K extends `presentation.${string}.closed` ? K : never) : never;
}[keyof AppEventMap];

export type FilePanelOptions = {
  /** The Dockview panel id is `<prefix>:<path>`. */
  prefix: string;
  /** Extra CSS class of the panel, besides `file-panel`. */
  className: string;
  /** Published, with the path, when the tab is closed. */
  closedEvent: FileClosedEvent;
  /**
   * Shows the file in `element`. May return a function that releases what the
   * rendering holds (such as an object URL); it runs when the tab closes.
   */
  render(file: File, element: HTMLElement, item: string): Promise<(() => void) | void> | (() => void) | void;
};

/**
 * Builds the panel of a tab that shows one file of the opened project. The
 * factory cannot fail once Dockview added the tab, so every problem (no
 * project, unreadable file) is shown inside the tab.
 */
export function makeFilePanel(options: FilePanelOptions): PanelFactory {
  return ({ id }): Mountable => {
    const prefix = `${options.prefix}:`;
    const item = id.startsWith(prefix) ? id.slice(prefix.length) : id;

    const element = document.createElement('div');
    element.className = `panel-content file-panel ${options.className}`;

    const showStatus = (text: string, role?: 'alert'): HTMLElement => {
      const line = document.createElement('p');
      line.className = 'file-status';
      if (role) line.setAttribute('role', role);
      line.textContent = text;
      element.replaceChildren(line);
      return line;
    };

    let release: (() => void) | void;
    let disposed = false;

    const load = async (): Promise<void> => {
      const loading = showStatus(translate('file.loading'));
      const folder = ProjectRepository.getInstance().get()?.folder;
      if (!folder) {
        showStatus(translate('file.noProject'), 'alert');
        return;
      }
      try {
        const file = await readProjectFile(folder, item);
        if (disposed) return;
        // The loading line stays until the file is drawn; heavy files take a while.
        release = await options.render(file, element, item);
        loading.remove();
        if (disposed) release?.();
      } catch (error) {
        if (!disposed) {
          showStatus(translate('file.loadFailed', { message: error instanceof Error ? error.message : String(error) }), 'alert');
        }
      }
    };
    void load();

    return {
      element,
      dispose: () => {
        disposed = true;
        release?.();
        element.remove();
        eventBus.publish(options.closedEvent, options.prefix, { item });
      },
    };
  };
}
