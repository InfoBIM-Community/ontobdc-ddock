import { IfcViewRepository } from '@/infobim/shared/adapter/ifc-view-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Finds the 3D view of the IFC tab that was clicked. */
export class IfcViewFoundCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.ifc_view_found',
    description: 'Find the 3D view of the clicked IFC tab.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const item = context.parameters.item;
    if (!item) throw new Error('No IFC file was clicked.');
    if (!IfcViewRepository.getInstance().get(item)) throw new Error(`There is no 3D view open for ${item}.`);

    context.etl.write('ifc_element_selection', context.requestId, context.state, { phase: 'done', entity: { item }, result: null });
  }
}
