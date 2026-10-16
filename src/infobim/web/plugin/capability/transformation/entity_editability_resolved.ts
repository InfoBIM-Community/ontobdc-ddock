import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { keepApplied, panelAndFacade } from '@/infobim/shared/adapter/facade-labels';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

const SOURCE = 'entity_editability_resolved';

/** Per entity panel: what stops the editable fields from being marked, replaced when the tab is set up again. */
const marking = new WeakMap<HTMLElement, () => void>();
/** Per entity panel: what takes the Edit button back to how the tab drew it, replaced when the tab is set up again. */
const enabled = new WeakMap<HTMLElement, () => void>();

/**
 * An entity is editable when its facade declares at least one editable field;
 * a facade that declares none makes it read-only. When it is editable, the Edit
 * button of the tab is enabled, and pressing it publishes
 * `presentation.entity.edit.requested` with the id of the entity. The fields it
 * can change are marked in the tab (`data-editable`, with their datatype, whether
 * they are required and the values they take), for whoever edits them, and again
 * whenever the tab draws its fields again.
 */
export class EntityEditabilityResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_editability_resolved',
    description: 'Enable the Edit button of the entity tab when the facade declares an editable field, and request the edit when it is pressed.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const id = context.parameters.id as string;
    const editable = facade.fields.filter((field) => field.editable === true).map((field) => field.identifier);
    const button = panel.querySelector<HTMLButtonElement>('button[data-action="edit"]');
    if (!button) throw new Error(`The entity panel of ${id} has no Edit button.`);

    const fields = new Map(facade.fields.filter((field) => field.editable === true).map((field) => [field.identifier, field]));
    await keepApplied(panel, marking, () => {
      for (const term of panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-field]')) {
        const field = fields.get(term.dataset.field ?? '');
        if (!field) continue;
        term.dataset.editable = 'true';
        term.dataset.datatype = field.datatype ?? '';
        term.dataset.required = String(field.required === true);
        term.dataset.multivalued = String(field.multivalued === true);
        term.dataset.documents = String(field.resource_facade?.fields.some((resource) => resource.identifier === 'title') === true);
        if (field.options?.length) term.dataset.options = JSON.stringify(field.options);
        if (field.option_labels) term.dataset.optionLabels = JSON.stringify(field.option_labels);
      }
    });

    enabled.get(panel)?.();
    if (editable.length > 0) {
      const request = (): void => { eventBus.publish('presentation.entity.edit.requested', SOURCE, { id }); };
      button.disabled = false;
      button.addEventListener('click', request);
      enabled.set(panel, () => {
        button.removeEventListener('click', request);
        button.disabled = true;
      });
    }

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id, panelId: context.parameters.panelId },
      result: { editable: editable.length > 0, fields: editable },
    });
  }
}
