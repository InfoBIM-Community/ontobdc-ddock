import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import type { IfcElementInfo } from '@/infobim/shared/domain/model/ifc-mesh';

/** Publishes the selection: the element, or null when the click cleared it. */
export class IfcElementSelectedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.ifc_element_selected',
    description: 'Publish the element selected in the 3D view.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const item = context.parameters.item;
    if (!item) throw new Error('No IFC file was clicked.');
    const identified = context.etl.read('ifc_element_selection', context.requestId, 'ifc_element_identified');
    const element = (identified?.result as { element: IfcElementInfo | null } | undefined)?.element ?? null;

    eventBus.publish('presentation.ifc.element.selected', 'ifc_element_selected', { item, element });
    context.etl.write('ifc_element_selection', context.requestId, context.state, { phase: 'done', entity: { item }, result: { element } });
  }
}
