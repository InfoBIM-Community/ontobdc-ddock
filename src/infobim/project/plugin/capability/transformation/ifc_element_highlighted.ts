import { IfcViewRepository } from '@/infobim/shared/adapter/ifc-view-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Highlights the picked element in the view, or clears the highlight when there is none. */
export class IfcElementHighlightedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.ifc_element_highlighted',
    description: 'Highlight the picked element in the 3D view.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const view = IfcViewRepository.getInstance().get(context.parameters.item ?? '');
    if (!view) throw new Error('The 3D view is no longer open.');
    const identified = context.etl.read('ifc_element_selection', context.requestId, 'ifc_element_identified');
    const element = (identified?.result as { element: { expressID: number } | null } | undefined)?.element ?? null;
    view.highlight(element?.expressID ?? null);

    context.etl.write('ifc_element_selection', context.requestId, context.state, { phase: 'done', entity: { highlighted: element !== null }, result: null });
  }
}
