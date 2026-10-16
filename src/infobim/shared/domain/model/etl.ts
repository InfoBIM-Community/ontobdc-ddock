/** What one state of one execution leaves for the states after it. */
export type EtlRecord = {
  state: string;
  phase: string;
  entity: unknown;
  result: unknown;
};

/** A state writes structured data, a later state reads it, by machine, request and state. */
export interface EtlPort {
  write(machine: string, requestId: string, state: string, record: Omit<EtlRecord, 'state'>): void;
  read(machine: string, requestId: string, state: string): EtlRecord | undefined;
  clear(machine: string, requestId: string): void;
}
