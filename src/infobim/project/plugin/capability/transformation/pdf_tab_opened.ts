import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { fileMetadataOf, openFileTabRequest } from '@/infobim/shared/adapter/file-metadata';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const EXTENSIONS = new Set(['pdf']);
const MIME_TYPES = new Set(['application/pdf']);

/**
 * A responsibility of `file_opening_strategy_found` (see
 * `standard_explorer_file_open_chain.yaml`, region `pdf`). `canHandle`
 * claims a file by its MIME type or extension. `execute` asks the surface to open a
 * tab with id `pdf:<path>`; the `pdf` panel (`web/plugin/panel/pdf.ts`)
 * renders it and publishes `presentation.main.pdf.closed` when the tab is closed.
 */
export class PdfTabOpenedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.strategy.pdf_tab_opened',
    description: 'Open a tab showing the activated file as a PDF.',
  };

  canHandle(context: CapabilityContext): boolean {
    const metadata = fileMetadataOf(context);
    if (!metadata) return false;
    if (metadata.type && MIME_TYPES.has(metadata.type)) return true;
    return EXTENSIONS.has(metadata.extension ?? '');
  }

  async execute(context: CapabilityContext): Promise<void> {
    eventBus.publish('presentation.main.panel.open.requested', 'pdf_tab_opened', openFileTabRequest(context, 'pdf', 'pdf'));
  }
}
