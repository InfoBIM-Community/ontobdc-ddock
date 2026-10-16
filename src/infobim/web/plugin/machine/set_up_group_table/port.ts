import type { SetUpGroupTableStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface SetUpGroupTableHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: SetUpGroupTableStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: SetUpGroupTableStateValue): void;
}

/** What setting up the table of a group is asked with. */
export type SetUpGroupTableRequest = {
  /** The group (the dataset's path in the project) and the DOM id of its table panel. */
  id: string;
  panelId: string;
};
