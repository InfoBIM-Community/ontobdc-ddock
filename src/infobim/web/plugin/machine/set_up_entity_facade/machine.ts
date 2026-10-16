import { createActor, createMachine } from 'xstate';
import { Etl } from '@/infobim/shared/adapter/etl';
import type { NamedCall } from '@/infobim/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/infobim/shared/domain/model/capability';
import type { SetUpEntityFacadeHandlerPort, SetUpEntityFacadeRequest } from './port';
import { SetUpEntityFacadeState, type SetUpEntityFacadeStateValue } from './state';
import { SetUpEntityFacadeStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'SetUpEntityFacadeStatePort';

/** `SetUpEntityFacadeStatePort.ENTITY_PANEL_MOUNTED` into the state it names. */
const stateOf = (constant: string): SetUpEntityFacadeStateValue => {
  const [port, name] = constant.split('.');
  const value = (SetUpEntityFacadeState as Record<string, SetUpEntityFacadeStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

/**
 * Drives the entity facade setup statechart.
 *
 * The statechart decides which state comes next, and its guard asks whether
 * the state is the one that follows the current one. The capability of a state
 * is not listed anywhere: its id is the prefix plus the name of the state, and
 * the driver runs it before it lets the machine enter that state. A capability that
 * fails throws, and so does the machine: a state is only reached when it makes
 * sense to go on.
 */
export class SetUpEntityFacadeMachine implements SetUpEntityFacadeHandlerPort {
  static readonly NAME = 'set_up_entity_facade';
  static readonly CAPABILITY_ID_PREFIX = 'org.infobim.web.plugin.capability.transformation.target.';
  static readonly FINAL_STATE = SetUpEntityFacadeState.ENTITY_SUBCLASSES_RESOLVED;

  private active: SetUpEntityFacadeStateValue = SetUpEntityFacadeState.UNDEFINED;

  constructor(
    private readonly request: SetUpEntityFacadeRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: SetUpEntityFacadeStateValue): boolean {
    const sequence = SetUpEntityFacadeStatechart.sequence();
    return sequence[sequence.indexOf(this.active) + 1] === state;
  }

  performStateTransition(state: SetUpEntityFacadeStateValue): void {
    this.active = state;
  }

  /** Walks the statechart to its final state and returns it. */
  async execute(): Promise<SetUpEntityFacadeStateValue> {
    const requestId = crypto.randomUUID();
    const config = SetUpEntityFacadeStatechart.config();
    const sequence = SetUpEntityFacadeStatechart.sequence();

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

        await this.runCapability(requestId, next as SetUpEntityFacadeStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} after the capability of ${next} ran.`);
        }
      }
    } finally {
      actor.stop();
      this.etl.clear(SetUpEntityFacadeMachine.NAME, requestId);
    }

    return this.active;
  }

  private async runCapability(requestId: string, state: SetUpEntityFacadeStateValue): Promise<void> {
    const id = `${SetUpEntityFacadeMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId,
      state,
      etl: this.etl,
      parameters: { id: this.request.id, panelId: this.request.panelId },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`Entity facade setup capability not found: ${id}`);
  }
}
