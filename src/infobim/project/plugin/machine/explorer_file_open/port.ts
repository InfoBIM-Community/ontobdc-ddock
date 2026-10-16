import type { ExplorerFileOpenStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface ExplorerFileOpenHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: ExplorerFileOpenStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: ExplorerFileOpenStateValue): void;
}

/** What opening a file is asked with. */
export type ExplorerFileOpenRequest = {
  /** The path of the file selected in the explorer. */
  item: string;
};
