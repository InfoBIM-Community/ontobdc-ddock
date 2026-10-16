import type { CapabilityContext, CapabilityMetadata } from './capability';

/** What a capability implements to participate in a chain of responsibility. */
export interface ChainResponsibilityPort {
  /** Whether this capability can handle the current responsibility. */
  canHandle(context: CapabilityContext): boolean;
}

/** A capability class that also implements a chain's responsibility contract. */
export type ChainResponsibilityClass = {
  METADATA: CapabilityMetadata;
  new (): ChainResponsibilityPort & { execute(context: CapabilityContext): Promise<void> };
};
