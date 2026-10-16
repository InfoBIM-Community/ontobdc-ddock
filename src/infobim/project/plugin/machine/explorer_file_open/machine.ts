import { createActor, createMachine } from 'xstate';
import { Etl } from '@/infobim/shared/adapter/etl';
import type { NamedCall } from '@/infobim/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/infobim/shared/domain/model/capability';
import type { ExplorerFileOpenHandlerPort, ExplorerFileOpenRequest } from './port';
import { ExplorerFileOpenState, type ExplorerFileOpenStateValue } from './state';
import { ExplorerFileOpenStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'ExplorerFileOpenStatePort';

/** `ExplorerFileOpenStatePort.FILE_METADATA_EXTRACTED` into the state it names. */
const stateOf = (constant: string): ExplorerFileOpenStateValue => {
  const [port, name] = constant.split('.');
  const value = (ExplorerFileOpenState as Record<string, ExplorerFileOpenStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

/**
 * Drives the explorer file-open statechart.
 *
 * The statechart decides which state comes next, and its guard asks whether
 * the state is the one that follows the current one. The capability of a state
 * is not listed anywhere: its id is the prefix plus the name of the state, and
 * the driver runs it before it lets the machine enter that state. A capability that
 * fails throws, and so does the machine: a state is only reached when it makes
 * sense to go on.
 */
export class ExplorerFileOpenMachine implements ExplorerFileOpenHandlerPort {
  static readonly NAME = 'explorer_file_open';
  static readonly CAPABILITY_ID_PREFIX = 'org.infobim.project.plugin.capability.transformation.target.';
  static readonly FINAL_STATE = ExplorerFileOpenState.FILE_OPENING_STRATEGY_FOUND;

  private active: ExplorerFileOpenStateValue = ExplorerFileOpenState.UNDEFINED;

  constructor(
    private readonly request: ExplorerFileOpenRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: ExplorerFileOpenStateValue): boolean {
    const sequence = ExplorerFileOpenStatechart.sequence();
    return sequence[sequence.indexOf(this.active) + 1] === state;
  }

  performStateTransition(state: ExplorerFileOpenStateValue): void {
    this.active = state;
  }

  /** Walks the statechart to its final state and returns it. */
  async execute(): Promise<ExplorerFileOpenStateValue> {
    const requestId = crypto.randomUUID();
    const config = ExplorerFileOpenStatechart.config();
    const sequence = ExplorerFileOpenStatechart.sequence();

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

        await this.runCapability(requestId, next as ExplorerFileOpenStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} after the capability of ${next} ran.`);
        }
      }
    } finally {
      actor.stop();
      this.etl.clear(ExplorerFileOpenMachine.NAME, requestId);
    }

    return this.active;
  }

  private async runCapability(requestId: string, state: ExplorerFileOpenStateValue): Promise<void> {
    const id = `${ExplorerFileOpenMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId,
      state,
      etl: this.etl,
      parameters: { item: this.request.item },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`Explorer file open capability not found: ${id}`);
  }
}
