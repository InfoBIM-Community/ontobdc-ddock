import { createActor, createMachine } from 'xstate';
import { Etl } from '@/infobim/shared/adapter/etl';
import type { NamedCall } from '@/infobim/shared/adapter/statechart-converter';
import type { CapabilityClass } from '@/infobim/shared/domain/model/capability';
import type { CommandExecutionResult } from '@/infobim/shared/domain/model/command-execution';
import type { LocalCommandExecutionHandlerPort, LocalCommandExecutionRequest } from './port';
import { LocalCommandExecutionState, type LocalCommandExecutionStateValue } from './state';
import { LocalCommandExecutionStatechart } from './statechart';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of the module without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('../../capability/transformation/*.ts');

const PORT_NAME = 'LocalCommandExecutionStatePort';

/** `LocalCommandExecutionStatePort.COMMAND_RECEIVED` into the state it names. */
const stateOf = (constant: string): LocalCommandExecutionStateValue => {
  const [port, name] = constant.split('.');
  const value = (LocalCommandExecutionState as Record<string, LocalCommandExecutionStateValue>)[name];
  if (port !== PORT_NAME || value === undefined) throw new Error(`Unknown state constant: ${constant}`);
  return value;
};

export type LocalCommandExecutionOutcome = {
  /** The final state: finished successfully or finished with failure. */
  state: LocalCommandExecutionStateValue;
  /** What the run left, recorded by the Pyodide state. */
  result: CommandExecutionResult;
};

/**
 * Drives the statechart that runs a requested command in the Python runtime of
 * the browser.
 *
 * Each state has a capability, found by its id: the prefix plus the name of the
 * state. The driver runs the capability of the state it is about to enter
 * before it lets the machine enter it; the final states have none. The
 * statechart picks the next state: after the Pyodide state, the guards read
 * the recorded result and lead to success or to failure. A command that cannot
 * run at all (rejected, or no runtime) throws instead.
 */
export class LocalCommandExecutionMachine implements LocalCommandExecutionHandlerPort {
  static readonly NAME = 'local_command_execution';
  static readonly CAPABILITY_ID_PREFIX = 'org.infobim.run.plugin.capability.transformation.target.';

  private active: LocalCommandExecutionStateValue = LocalCommandExecutionState.UNDEFINED;
  private requestId = '';

  constructor(
    private readonly request: LocalCommandExecutionRequest,
    private readonly etl: Etl = new Etl(),
  ) {}

  canTransitTo(state: LocalCommandExecutionStateValue): boolean {
    const transitions = LocalCommandExecutionStatechart.config().states[this.active]?.on?.STEP ?? [];
    return transitions.some((transition) => transition.target === state);
  }

  performStateTransition(state: LocalCommandExecutionStateValue): void {
    this.active = state;
  }

  resultSucceeded(): boolean {
    return this.resultOf()?.success === true;
  }

  /** Walks the statechart to one of its final states and returns it with the result. */
  async execute(): Promise<LocalCommandExecutionOutcome> {
    this.requestId = crypto.randomUUID();
    const config = LocalCommandExecutionStatechart.config();

    const implement = (call: NamedCall): (() => boolean) | (() => void) => {
      if (call.type === 'handler.result_succeeded') return () => this.resultSucceeded() !== call.negated;
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
        const next = (config.states[current]?.on?.STEP ?? []).find((transition) =>
          !transition.guard || implement(transition.guard)() === true,
        )?.target;
        if (next === undefined) throw new Error(`The statechart has no way out of ${current}.`);

        if (config.states[next]?.type !== 'final') await this.runCapability(next as LocalCommandExecutionStateValue);
        actor.send({ type: 'STEP' });
        if (String(actor.getSnapshot().value) === current) {
          throw new Error(`The statechart stayed in ${current} when it should have entered ${next}.`);
        }
      }

      const result = this.resultOf();
      if (!result) throw new Error('The command finished without leaving a result.');
      return { state: this.active, result };
    } finally {
      actor.stop();
      this.etl.clear(LocalCommandExecutionMachine.NAME, this.requestId);
    }
  }

  /** What the Pyodide state recorded, if it ran. */
  private resultOf(): CommandExecutionResult | undefined {
    const record = this.etl.read(
      LocalCommandExecutionMachine.NAME, this.requestId, LocalCommandExecutionState.COMMAND_RUNNABLE_ON_PYODIDE,
    );
    return record?.result as CommandExecutionResult | undefined;
  }

  private async runCapability(state: LocalCommandExecutionStateValue): Promise<void> {
    const id = `${LocalCommandExecutionMachine.CAPABILITY_ID_PREFIX}${state}`;
    const capability = await this.capabilityFor(id);
    await new capability().execute({
      requestId: this.requestId,
      state,
      etl: this.etl,
      parameters: { requestId: this.request.requestId, command: this.request.command },
    });
  }

  private async capabilityFor(id: string): Promise<CapabilityClass> {
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        const metadata = (exported as { METADATA?: { id?: unknown } } | undefined)?.METADATA;
        if (typeof exported === 'function' && metadata?.id === id) return exported as CapabilityClass;
      }
    }
    throw new Error(`Local command execution capability not found: ${id}`);
  }
}
