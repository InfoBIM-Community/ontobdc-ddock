import type { IfcElementSelectionStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface IfcElementSelectionHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: IfcElementSelectionStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: IfcElementSelectionStateValue): void;
}

/** What selecting an element is asked with. */
export type IfcElementSelectionRequest = {
  /** The path of the IFC file whose tab was clicked. */
  item: string;
  /** Where the click was, in normalized device coordinates (-1 to 1, y up). */
  x: number;
  y: number;
};
