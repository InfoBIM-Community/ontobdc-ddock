import type { Facade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext } from '@/infobim/shared/domain/model/capability';

/** The machine that sets the table of a group up, and the state that found the facade it reads. */
export const GROUP_TABLE_MACHINE = 'set_up_group_table';

/** The mounted table panel of the request, and the facade a previous state found for it. */
export function tableAndFacade(context: CapabilityContext): { panel: HTMLElement; facade: Facade } {
  const { id, panelId } = context.parameters;
  if (!id || !panelId) throw new Error('Group table setup requires group and panel ids.');
  const panel = document.getElementById(panelId);
  if (!panel?.isConnected) throw new Error(`The table panel ${panelId} is not mounted.`);
  const record = context.etl.read(GROUP_TABLE_MACHINE, context.requestId, 'table_facade_found');
  const facade = (record?.result as { facade?: Facade } | undefined)?.facade;
  if (!facade || !Array.isArray(facade.fields)) throw new Error(`The group ${id} has no facade to set its table up with.`);
  return { panel, facade };
}

/** The cells of a column of the table, by the identifier of its field, without the header. */
export function bodyCells(panel: HTMLElement, field: string): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('tbody td[data-field]')].filter((cell) => cell.dataset.field === field);
}
