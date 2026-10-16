import type { LocalCommandExecutionStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface LocalCommandExecutionHandlerPort {
  /** Whether the statechart has a transition from the current state to this one. */
  canTransitTo(state: LocalCommandExecutionStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: LocalCommandExecutionStateValue): void;
  /** Whether the run left a result that says it worked; the adapter decided that, not the machine. */
  resultSucceeded(): boolean;
}

/** What running a command is asked with. */
export type LocalCommandExecutionRequest = {
  requestId: string;
  /** The command as typed, such as `infobim project --refresh`. */
  command: string;
};
