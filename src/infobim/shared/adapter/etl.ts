import type { EtlPort, EtlRecord } from '@/infobim/shared/domain/model/etl';

/**
 * In-memory ETL: a state writes structured data, a later state reads it, by
 * machine, request and state. Nothing is shared between machines or requests.
 */
export class Etl implements EtlPort {
  private readonly records = new Map<string, Map<string, Map<string, EtlRecord>>>();

  write(machine: string, requestId: string, state: string, record: Omit<EtlRecord, 'state'>): void {
    const requests = this.records.get(machine) ?? new Map<string, Map<string, EtlRecord>>();
    const states = requests.get(requestId) ?? new Map<string, EtlRecord>();
    states.set(state, { state, ...record });
    requests.set(requestId, states);
    this.records.set(machine, requests);
  }

  read(machine: string, requestId: string, state: string): EtlRecord | undefined {
    return this.records.get(machine)?.get(requestId)?.get(state);
  }

  clear(machine: string, requestId: string): void {
    this.records.get(machine)?.delete(requestId);
  }
}
