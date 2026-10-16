import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { CapabilityContext } from '@/infobim/shared/domain/model/capability';

export type FacadeField = {
  identifier: string;
  order?: number;
  editable?: boolean;
  /** The IRI of the value generator that gives the field its value on creation when none was given. */
  default?: string | null;
  /** The field has to have a value. */
  required?: boolean;
  /** The field holds a list: its values are separated by `|`. */
  multivalued?: boolean;
  labels: Record<string, string>;
  /** The only values the field takes, when the facade lists them. */
  options?: string[];
  /** The names of the options, by option and lower-case language tag. */
  option_labels?: Record<string, Record<string, string>>;
  /** The datatype of the values, an IRI such as `http://www.w3.org/2001/XMLSchema#dateTime`. */
  datatype?: string;
  /** The masks the values are shown with, by language (`csvw:format`). */
  formats?: Record<string, string>;
  /** The visualization the field asks for in place of text, and the files it shows. */
  alternative_visualization?: { iri: string; accepts: { mime_types: string[]; extensions: string[] } } | null;
  /** The facade of the resources the values of the field point to; absent for a plain text field. */
  resource_facade?: { resource_iri: string | null; fields: FacadeField[] } | null;
};
export type Facade = {
  name?: string;
  labels?: Record<string, string>;
  /** An instance of the entity can be deleted; a facade that does not say so forbids it. */
  deletable?: boolean;
  /** An instance of the entity can be created; a facade that does not say so forbids it. */
  creatable?: boolean;
  fields: FacadeField[];
};

/** The name in the language, else in its base language, else English; none if there is none. */
export function nameIn(labels: Record<string, string> | undefined, locale: string): string | undefined {
  const tag = locale.toLowerCase();
  return labels?.[tag] ?? labels?.[tag.split('-')[0]] ?? labels?.en;
}

/** The mounted entity panel of the request, and the facade a previous state found for it. */
export function panelAndFacade(context: CapabilityContext): { panel: HTMLElement; facade: Facade } {
  const { id, panelId } = context.parameters;
  if (!id || !panelId) throw new Error('Entity label resolution requires entity and panel ids.');
  const panel = document.getElementById(panelId);
  if (!panel?.isConnected) throw new Error(`The entity panel ${panelId} is not mounted.`);
  const record = context.etl.read('set_up_entity_facade', context.requestId, 'entity_facade_found');
  const facade = (record?.result as { facade?: Facade } | undefined)?.facade;
  if (!facade || !Array.isArray(facade.fields)) throw new Error(`The entity ${id} has no facade whose labels can be resolved.`);
  return { panel, facade };
}

/**
 * Applies the facade's names to the panel now, and again whenever the tab draws
 * its own labels again (the language changed, or the project was read again),
 * for as long as the panel is in the page. Setting the same panel up again
 * replaces what was kept before. Returns the language it applied.
 */
export async function keepApplied(
  panel: HTMLElement,
  registry: WeakMap<HTMLElement, () => void>,
  apply: (locale: string) => void,
): Promise<string> {
  // Loaded here, not at the top: the i18n module sets the page language as it loads,
  // and the machine loads every capability of the module to find the one it runs.
  const { getLocale, onLocaleChange } = await import('@/infobim/shared/plugin/i18n');
  registry.get(panel)?.();
  const refresh = (locale: string = getLocale()): void => {
    if (!panel.isConnected) return stop();
    apply(locale);
  };
  const unsubscribers = [
    onLocaleChange(refresh),
    eventBus.subscribe('presentation.project.entities.found', () => refresh()),
  ];
  const stop = (): void => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    registry.delete(panel);
  };
  registry.set(panel, stop);
  refresh();
  return getLocale();
}
