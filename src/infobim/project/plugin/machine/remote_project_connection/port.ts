import type { RemoteProjectConnectionStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface RemoteProjectConnectionHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: RemoteProjectConnectionStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: RemoteProjectConnectionStateValue): void;
}

/** What a connection is asked with. */
export type RemoteProjectConnectionRequest = {
  url: string;
  apiToken?: string;
};
