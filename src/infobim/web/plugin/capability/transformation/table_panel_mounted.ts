import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import { GROUP_TABLE_MACHINE } from '@/infobim/shared/adapter/facade-table';

/** Confirms the table panel of a group is mounted and drew its columns before the setup. */
export class TablePanelMountedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.table_panel_mounted',
    description: 'Locate the mounted table panel of a group and its addressable columns.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { id, panelId } = context.parameters;
    if (!id || !panelId) throw new Error('Group table setup requires group and panel ids.');
    const panel = document.getElementById(panelId);
    if (!panel?.isConnected) throw new Error(`The table panel ${panelId} is not mounted.`);
    if (panel.dataset.state !== 'ready') throw new Error(`The group ${id} has no rendered table.`);

    context.etl.write(GROUP_TABLE_MACHINE, context.requestId, context.state, {
      phase: 'done',
      entity: { id, panelId },
      result: { columns: Array.from(panel.querySelectorAll('thead th[data-field]'), (column) => (column as HTMLElement).dataset.field) },
    });
  }
}
