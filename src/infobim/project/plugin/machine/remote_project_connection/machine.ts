import { createActor, createMachine } from 'xstate';
import { AccessTokenRepository } from '@/infobim/shared/adapter/access-token';
import { Etl } from '@/infobim/shared/adapter/etl';
import type { NamedCall } from '@/infobim/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/infobim/shared/domain/model/capability';
import type {
  RemoteProjectConnectionHandlerPort,
  RemoteProjectConnectionRequest,
} from './port';
import { RemoteProjectConnectionState, type RemoteProjectConnectionStateValue } from './state';
import { RemoteProjectConnectionStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'RemoteProjectConnectionStatePort';

/** `RemoteProjectConnectionStatePort.CONTEXT_INITIALIZED` into the state it names. */
const stateOf = (constant: string): RemoteProjectConnectionStateValue => {
  const [port, name] = constant.split('.');
  const value = (RemoteProjectConnectionState as Record<string, RemoteProjectConnectionStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

/**
 * Drives the remote project connection statechart.
 *
 * The statechart decides which state comes next, and its guard asks whether
 * the state is the one that follows the current one. The capability of a state
 * is not listed anywhere: its id is the prefix plus the name of the state, and
 * the driver runs it before it lets the machine enter that state. A capability that
 * fails throws, and so does the machine: a state is only reached when it makes
 * sense to go on.
 */
export class RemoteProjectConnectionMachine implements RemoteProjectConnectionHandlerPort {
  static readonly NAME = 'remote_project_connection';
  static readonly CAPABILITY_ID_PREFIX = 'org.infobim.project.plugin.capability.transformation.target.';
  static readonly FINAL_STATE = RemoteProjectConnectionState.ACCESS_TOKEN_REMEMBERED;

  private active: RemoteProjectConnectionStateValue = RemoteProjectConnectionState.UNDEFINED;

  constructor(
    private readonly request: RemoteProjectConnectionRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: RemoteProjectConnectionStateValue): boolean {
    const sequence = RemoteProjectConnectionStatechart.sequence();
    return sequence[sequence.indexOf(this.active) + 1] === state;
  }

  performStateTransition(state: RemoteProjectConnectionStateValue): void {
    this.active = state;
  }

  /** Walks the statechart to its final state and returns it. */
  async execute(): Promise<RemoteProjectConnectionStateValue> {
    const requestId = crypto.randomUUID();
    const config = RemoteProjectConnectionStatechart.config();
    const sequence = RemoteProjectConnectionStatechart.sequence();

    const implement = (call: NamedCall): (() => boolean) | (() => void) => {
      const state = stateOf(call.params.to_state);
      if (call.type === 'handler.can_transit_to') return () => this.canTransitTo(state) !== call.negated;
      if (call.type === 'handler.perform_state_transition') return () => this.performStateTransition(state);
      throw new Error(`Unknown statechart call: ${call.type}`);
    };

    const machine = createMachine({
      id: config.id,
      initial: config.initial,
      states: Object.fromEntries(Object.entries(config.states).map(([name, node]) => [name, {
        ...(node.type ? { type: node.type } : {}),
        meta: node.meta,
        ...(node.on ? { on: { STEP: node.on.STEP.map((transition) => ({
          target: transition.target,
          ...(transition.guard ? { guard: implement(transition.guard) as () => boolean } : {}),
          ...(transition.actions ? { actions: transition.actions.map((action) => implement(action) as () => void) } : {}),
        })) } } : {}),
      }])),
    });

    const actor = createActor(machine);
    actor.start();
    try {
      while (actor.getSnapshot().status !== 'done') {
        const current = String(actor.getSnapshot().value);
        const next = sequence[sequence.indexOf(current) + 1];
        if (next === undefined) throw new Error(`The statechart has no state after ${current}.`);

        await this.runCapability(requestId, next as RemoteProjectConnectionStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} after the capability of ${next} ran.`);
        }
      }
    } catch (error) {
      await this.discardFolder(requestId);
      new AccessTokenRepository().forget(this.request.url);
      throw error;
    } finally {
      actor.stop();
      this.etl.clear(RemoteProjectConnectionMachine.NAME, requestId);
    }

    return this.active;
  }

  /** A connection that failed leaves nothing behind; a finished one keeps its folder. */
  private async discardFolder(requestId: string): Promise<void> {
    const record = this.etl.read(
      RemoteProjectConnectionMachine.NAME, requestId, RemoteProjectConnectionState.TEMPORARY_FOLDER_AVAILABLE,
    );
    const result = record?.result as { storage?: FileSystemDirectoryHandle; name?: string } | undefined;
    if (result?.storage && result.name) {
      try {
        await result.storage.removeEntry(result.name, { recursive: true });
      } catch {
        // The cleanup must not hide why the connection failed.
      }
    }
  }

  private async runCapability(requestId: string, state: RemoteProjectConnectionStateValue): Promise<void> {
    const id = `${RemoteProjectConnectionMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId,
      state,
      etl: this.etl,
      parameters: { url: this.request.url, apiToken: this.request.apiToken },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`Remote project connection capability not found: ${id}`);
  }
}
