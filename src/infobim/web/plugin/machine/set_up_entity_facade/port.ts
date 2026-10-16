import type { SetUpEntityFacadeStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface SetUpEntityFacadeHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: SetUpEntityFacadeStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: SetUpEntityFacadeStateValue): void;
}

/** What setting up the entity facade is asked with. */
export type SetUpEntityFacadeRequest = {
  /** Global entity id and DOM panel id. */
  id: string;
  panelId: string;
};
