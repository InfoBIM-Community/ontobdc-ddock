import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { fileMetadataOf, openFileTabRequest } from '@/infobim/shared/adapter/file-metadata';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const EXTENSIONS = new Set(['md', 'markdown']);

/**
 * A responsibility of `file_opening_strategy_found` (see
 * `standard_explorer_file_open_chain.yaml`, region `md`). `canHandle`
 * claims a file by its extension. `execute` asks the surface to open a
 * tab with id `md:<path>`; the `md` panel (`web/plugin/panel/md.ts`)
 * renders it and publishes `presentation.main.md.closed` when the tab is closed.
 */
export class MdTabOpenedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.strategy.md_tab_opened',
    description: 'Open a tab showing the activated file as Markdown.',
  };

  canHandle(context: CapabilityContext): boolean {
    const metadata = fileMetadataOf(context);
    if (!metadata) return false;
    return EXTENSIONS.has(metadata.extension ?? '');
  }

  async execute(context: CapabilityContext): Promise<void> {
    eventBus.publish('presentation.main.panel.open.requested', 'md_tab_opened', openFileTabRequest(context, 'md', 'md'));
  }
}
