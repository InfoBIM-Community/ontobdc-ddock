import { documentTitle } from '@/infobim/shared/adapter/document-iri';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { keepApplied, panelAndFacade, type FacadeField } from '@/infobim/shared/adapter/facade-labels';
import { visualizationFor, type Visualization } from '@/infobim/shared/adapter/visualization_by_iri';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';

/** Per entity panel: what stops the visualizations from being kept, replaced when the tab is set up again. */
const watching = new WeakMap<HTMLElement, () => void>();
/** Per entity panel: frees what the visualizations drawn hold. */
const drawn = new WeakMap<HTMLElement, Array<() => void>>();
/** Per entity panel: stops waiting for the tab to close. */
const closing = new WeakMap<HTMLElement, () => void>();

const SEPARATOR = '|';

/**
 * Draws the fields whose facade asks for an alternative visualization (such as
 * an image carousel) with it, in place of their text. The values of the field
 * come from the entity, not from the page. A value the visualization does not
 * show stays below it, by its title, so nothing is lost. The visualization is
 * drawn again when the tab draws its fields again, and freed when the tab
 * closes. A visualization the table does not know leaves the field as text.
 */
export class EntityVisualizationsResolvedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.web.plugin.capability.transformation.target.entity_visualizations_resolved',
    description: 'Draw the fields that ask for an alternative visualization with it, in place of their text.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { panel, facade } = panelAndFacade(context);
    const id = context.parameters.id as string;

    const requested = new Map<string, { field: FacadeField; draw: Visualization }>();
    for (const field of facade.fields) {
      const draw = await visualizationFor(field.alternative_visualization?.iri);
      if (draw) requested.set(field.identifier, { field, draw });
    }

    const free = (): void => {
      drawn.get(panel)?.forEach((dispose) => dispose());
      drawn.set(panel, []);
    };
    closing.get(panel)?.();
    const unsubscribe = eventBus.subscribe('presentation.main.entity.closed', ({ payload }) => {
      if (payload?.id !== id) return;
      free();
      unsubscribe();
      closing.delete(panel);
    });
    closing.set(panel, unsubscribe);

    await keepApplied(panel, watching, () => {
      free();
      const item = EntityRepository.getInstance().find(id)?.item;
      for (const term of panel.querySelectorAll<HTMLElement>('.entity-fields dt[data-field]')) {
        const found = requested.get(term.dataset.field ?? '');
        const detail = term.nextElementSibling as HTMLElement | null;
        if (!found || !detail) continue;

        const stored = item?.fields.find((candidate) => candidate.name === found.field.identifier)?.values ?? [];
        const values = (found.field.multivalued === true ? stored.flatMap((text) => text.split(SEPARATOR)) : stored)
          .map((text) => text.trim())
          .filter(Boolean);
        if (values.length === 0) continue;

        const visualization = found.draw({ values, accepts: found.field.alternative_visualization!.accepts });
        drawn.get(panel)!.push(visualization.dispose);
        const rest = values.filter((value) => !visualization.handled.includes(value));
        const parts: HTMLElement[] = [visualization.element];
        if (rest.length > 0) {
          const list = document.createElement('ul');
          list.append(...rest.map((value) => {
            const entry = document.createElement('li');
            entry.textContent = documentTitle(value) ?? value;
            entry.title = value;
            return entry;
          }));
          parts.push(list);
        }
        detail.replaceChildren(...parts);
      }
    });

    context.etl.write('set_up_entity_facade', context.requestId, context.state, {
      phase: 'done',
      entity: { id, panelId: context.parameters.panelId },
      result: { fields: [...requested.keys()] },
    });
  }
}
