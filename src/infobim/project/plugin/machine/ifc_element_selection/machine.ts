import { createActor, createMachine } from 'xstate';
import { Etl } from '@/infobim/shared/adapter/etl';
import type { NamedCall } from '@/infobim/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/infobim/shared/domain/model/capability';
import type { IfcElementSelectionHandlerPort, IfcElementSelectionRequest } from './port';
import { IfcElementSelectionState, type IfcElementSelectionStateValue } from './state';
import { IfcElementSelectionStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'IfcElementSelectionStatePort';

/** `IfcElementSelectionStatePort.IFC_VIEW_FOUND` into the state it names. */
const stateOf = (constant: string): IfcElementSelectionStateValue => {
  const [port, name] = constant.split('.');
  const value = (IfcElementSelectionState as Record<string, IfcElementSelectionStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

/**
 * Drives the statechart that selects the element clicked in the 3D view of an IFC tab.
 *
 * The statechart decides which state comes next, and its guard asks whether
 * the state is the one that follows the current one. The capability of a state
 * is not listed anywhere: its id is the prefix plus the name of the state, and
 * the driver runs it before it lets the machine enter that state. A capability that
 * fails throws, and so does the machine: a state is only reached when it makes
 * sense to go on.
 */
export class IfcElementSelectionMachine implements IfcElementSelectionHandlerPort {
  static readonly NAME = 'ifc_element_selection';
  static readonly CAPABILITY_ID_PREFIX = 'org.infobim.project.plugin.capability.transformation.target.';
  static readonly FINAL_STATE = IfcElementSelectionState.IFC_ELEMENT_SELECTED;

  private active: IfcElementSelectionStateValue = IfcElementSelectionState.UNDEFINED;

  constructor(
    private readonly request: IfcElementSelectionRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: IfcElementSelectionStateValue): boolean {
    const sequence = IfcElementSelectionStatechart.sequence();
    return sequence[sequence.indexOf(this.active) + 1] === state;
  }

  performStateTransition(state: IfcElementSelectionStateValue): void {
    this.active = state;
  }

  /** Walks the statechart to its final state and returns it. */
  async execute(): Promise<IfcElementSelectionStateValue> {
    const requestId = crypto.randomUUID();
    const config = IfcElementSelectionStatechart.config();
    const sequence = IfcElementSelectionStatechart.sequence();

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

        await this.runCapability(requestId, next as IfcElementSelectionStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} after the capability of ${next} ran.`);
        }
      }
    } finally {
      actor.stop();
      this.etl.clear(IfcElementSelectionMachine.NAME, requestId);
    }

    return this.active;
  }

  private async runCapability(requestId: string, state: IfcElementSelectionStateValue): Promise<void> {
    const id = `${IfcElementSelectionMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId,
      state,
      etl: this.etl,
      parameters: { item: this.request.item, x: String(this.request.x), y: String(this.request.y) },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`IFC element selection capability not found: ${id}`);
  }
}
