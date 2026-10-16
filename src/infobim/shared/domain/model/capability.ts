import type { EtlPort } from './etl';

/** What a capability of a connection FSM works on. */
export type CapabilityContext = {
  /** Identifies this execution in the ETL. */
  requestId: string;
  /** The name of the state whose capability is running. */
  state: string;
  etl: EtlPort;
  /** The parameters the execution was asked with. */
  parameters: Readonly<Record<string, string | undefined>>;
};

export type CapabilityMetadata = {
  id: string;
  description: string;
};

/**
 * Does the work of one state. A capability that cannot do it throws: a state
 * is only reached when it makes sense to go on.
 */
export type CapabilityClass = {
  METADATA: CapabilityMetadata;
  new (): { execute(context: CapabilityContext): Promise<void> };
};
