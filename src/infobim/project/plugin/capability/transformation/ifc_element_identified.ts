import { IfcViewRepository } from '@/infobim/shared/adapter/ifc-view-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Reads what the IFC says about the picked element, from the table the view keeps. */
export class IfcElementIdentifiedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.ifc_element_identified',
    description: 'Identify the picked element by its express ID, global ID, type and name.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const view = IfcViewRepository.getInstance().get(context.parameters.item ?? '');
    if (!view) throw new Error('The 3D view is no longer open.');
    const picked = context.etl.read('ifc_element_selection', context.requestId, 'ifc_mesh_picked');
    const expressID = (picked?.result as { expressID: number | null } | undefined)?.expressID ?? null;

    context.etl.write('ifc_element_selection', context.requestId, context.state, {
      phase: 'done',
      entity: { expressID },
      result: { element: expressID === null ? null : view.describe(expressID) ?? null },
    });
  }
}
