import { IfcViewRepository } from '@/infobim/shared/adapter/ifc-view-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Asks the view which element is drawn at the click; there may be none. */
export class IfcMeshPickedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.ifc_mesh_picked',
    description: 'Pick the element drawn at the click.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const view = IfcViewRepository.getInstance().get(context.parameters.item ?? '');
    if (!view) throw new Error('The 3D view is no longer open.');
    const x = Number(context.parameters.x);
    const y = Number(context.parameters.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('The click has no position.');

    context.etl.write('ifc_element_selection', context.requestId, context.state, {
      phase: 'done',
      entity: { x, y },
      result: { expressID: view.pick({ x, y }) },
    });
  }
}
