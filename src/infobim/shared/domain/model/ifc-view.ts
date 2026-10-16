import type { IfcElementInfo } from './ifc-mesh';

/** A point of the 3D view, in normalized device coordinates: x and y from -1 to 1, y up. */
export type IfcViewPoint = { x: number; y: number };

/** What the machine of an element selection asks of the 3D view of a model. */
export interface IfcViewPort {
  /** The express ID of the element drawn at the point, or null when there is none. */
  pick(point: IfcViewPoint): number | null;
  /** What the IFC says about the element, from the table kept when the model was converted. */
  describe(expressID: number): IfcElementInfo | undefined;
  /** Highlights the element, and clears the highlight of any other; null clears it. */
  highlight(expressID: number | null): void;
}
