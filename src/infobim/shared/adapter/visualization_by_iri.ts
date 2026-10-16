const FACADE = 'http://datacenter.app.br/ontology/tool/ontobdc/facade/ns.ttl#';

/** What a visualization is given to draw the values of a field. */
export type VisualizationContext = {
  /** The values of the field, each one a document IRI. */
  values: string[];
  /** The files the visualization shows, as its file profile accepts them. */
  accepts: { mime_types: string[]; extensions: string[] };
};

export type VisualizationResult = {
  element: HTMLElement;
  /** The values it shows; the others are left for the caller to show. */
  handled: string[];
  /** Frees what the visualization holds. */
  dispose(): void;
};

export type Visualization = (context: VisualizationContext) => VisualizationResult;

/**
 * The file that draws each visualization the ontology can ask for. A file is
 * loaded when it is first needed, so a visualization nobody asks for costs
 * nothing. A visualization with no entry cannot be drawn, and the field is shown
 * as text.
 */
export const VISUALIZATION_BY_IRI: Readonly<Record<string, () => Promise<{ default: Visualization }>>> = {
  [`${FACADE}ImageCarousel`]: () => import('@/infobim/shared/adapter/image-carousel'),
};

/** The visualization of an IRI, loaded; none if the table has no entry. */
export async function visualizationFor(iri: string | undefined): Promise<Visualization | undefined> {
  if (iri === undefined || !Object.hasOwn(VISUALIZATION_BY_IRI, iri)) return undefined;
  return (await VISUALIZATION_BY_IRI[iri]()).default;
}
