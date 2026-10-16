import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { fileMetadataOf, openFileTabRequest } from '@/infobim/shared/adapter/file-metadata';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const EXTENSIONS = new Set(['txt']);

/**
 * A responsibility of `file_opening_strategy_found` (see
 * `standard_explorer_file_open_chain.yaml`, region `txt`). `canHandle`
 * claims a file by its extension. `execute` asks the surface to open a
 * tab with id `txt:<path>`; the `txt` panel (`web/plugin/panel/txt.ts`)
 * renders it and publishes `presentation.main.txt.closed` when the tab is closed.
 */
export class TxtTabOpenedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.strategy.txt_tab_opened',
    description: 'Open a tab showing the activated file as text.',
  };

  canHandle(context: CapabilityContext): boolean {
    const metadata = fileMetadataOf(context);
    if (!metadata) return false;
    return EXTENSIONS.has(metadata.extension ?? '');
  }

  async execute(context: CapabilityContext): Promise<void> {
    eventBus.publish('presentation.main.panel.open.requested', 'txt_tab_opened', openFileTabRequest(context, 'txt', 'txt'));
  }
}
