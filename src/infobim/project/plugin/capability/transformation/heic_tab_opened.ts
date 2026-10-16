import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { fileMetadataOf, openFileTabRequest } from '@/infobim/shared/adapter/file-metadata';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const EXTENSIONS = new Set(['heic', 'heif']);
const MIME_TYPES = new Set(['image/heic', 'image/heif']);

/**
 * A responsibility of `file_opening_strategy_found` (see
 * `standard_explorer_file_open_chain.yaml`, region `heic`). `canHandle`
 * claims a file by its MIME type or extension. `execute` asks the surface to open a
 * tab with id `heic:<path>`; the `heic` panel (`web/plugin/panel/heic.ts`)
 * renders it and publishes `presentation.main.heic.closed` when the tab is closed.
 */
export class HeicTabOpenedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.strategy.heic_tab_opened',
    description: 'Open a tab showing the activated file as a photo converted from HEIC.',
  };

  canHandle(context: CapabilityContext): boolean {
    const metadata = fileMetadataOf(context);
    if (!metadata) return false;
    if (metadata.type && MIME_TYPES.has(metadata.type)) return true;
    return EXTENSIONS.has(metadata.extension ?? '');
  }

  async execute(context: CapabilityContext): Promise<void> {
    eventBus.publish('presentation.main.panel.open.requested', 'heic_tab_opened', openFileTabRequest(context, 'heic', 'heic'));
  }
}
