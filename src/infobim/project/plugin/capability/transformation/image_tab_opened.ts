import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { fileMetadataOf, openFileTabRequest } from '@/infobim/shared/adapter/file-metadata';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
/** HEIC has a region of its own (`heic_tab_opened`); some systems report it as `image/*`. */
const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

/**
 * A responsibility of `file_opening_strategy_found` (see
 * `standard_explorer_file_open_chain.yaml`, region `image`). `canHandle`
 * claims a file by its MIME type or extension. `execute` asks the surface to open a
 * tab with id `image:<path>`; the `image` panel (`web/plugin/panel/image.ts`)
 * renders it and publishes `presentation.main.image.closed` when the tab is closed.
 */
export class ImageTabOpenedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.strategy.image_tab_opened',
    description: 'Open a tab showing the activated file as an image.',
  };

  canHandle(context: CapabilityContext): boolean {
    const metadata = fileMetadataOf(context);
    if (!metadata) return false;
    if (HEIC_EXTENSIONS.has(metadata.extension ?? '') || HEIC_MIME_TYPES.has(metadata.type ?? '')) return false;
    if (metadata.type?.startsWith('image/')) return true;
    return EXTENSIONS.has(metadata.extension ?? '');
  }

  async execute(context: CapabilityContext): Promise<void> {
    eventBus.publish('presentation.main.panel.open.requested', 'image_tab_opened', openFileTabRequest(context, 'image', 'image'));
  }
}
