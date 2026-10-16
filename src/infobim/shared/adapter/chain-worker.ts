import { createActor, createMachine } from 'xstate';
import type { CapabilityContext } from '@/infobim/shared/domain/model/capability';
import type { ChainResponsibilityClass } from '@/infobim/shared/domain/model/chain';
import { convertChainStatechart, type ChainStatechartConfig, type NamedCall } from './statechart-converter';

/**
 * Interprets a parallel chain-of-responsibility statechart declared entirely
 * in its YAML: each region names, in its guard and action, the id of the
 * capability it runs (`worker.can_handle('<id>')`, `worker.execute_responsibility('<id>')`).
 * The worker resolves that id against the given candidates, evaluates
 * can_handle and executes the capability; it never adds, removes or renames
 * regions, since those come entirely from the YAML.
 */
export class ChainOfResponsibilityWorkerAdapter {
  private readonly handled: string[] = [];
  private readonly instances = new Map<string, InstanceType<ChainResponsibilityClass>>();

  constructor(
    private readonly source: string,
    private readonly candidates: ChainResponsibilityClass[],
    private readonly context: CapabilityContext,
  ) {}

  async work(): Promise<string[]> {
    const config = convertChainStatechart(this.source);
    const pending: Array<Promise<void>> = [];

    const machine = createMachine({
      id: config.id,
      type: 'parallel',
      states: Object.fromEntries(Object.entries(config.regions).map(([name, region]) => [name, {
        initial: region.initial,
        states: Object.fromEntries(Object.entries(region.states).map(([stateName, node]) => [stateName, {
          ...(node.type ? { type: node.type } : {}),
          ...(node.on ? { on: { STEP: node.on.STEP.map((transition) => ({
            target: transition.target,
            ...(transition.guard ? { guard: this.guardOf(transition.guard) } : {}),
            ...(transition.actions ? { actions: transition.actions.map((action) => this.actionOf(action, pending)) } : {}),
          })) } } : {}),
        }])),
      }])),
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STEP' });
    await Promise.all(pending);
    actor.stop();

    this.ensureEveryRegionCompleted(config, actor.getSnapshot().value);
    return [...this.handled];
  }

  private guardOf(call: NamedCall): () => boolean {
    return () => this.responsibilityOf(call.params.id).canHandle(this.context) !== call.negated;
  }

  private actionOf(call: NamedCall, pending: Array<Promise<void>>): () => void {
    return () => {
      const id = call.params.id;
      pending.push(this.responsibilityOf(id).execute(this.context).then(() => { this.handled.push(id); }));
    };
  }

  private responsibilityOf(id: string): InstanceType<ChainResponsibilityClass> {
    const existing = this.instances.get(id);
    if (existing) return existing;
    const found = this.candidates.find((candidate) => candidate.METADATA.id === id);
    if (!found) throw new Error(`Chain declares responsibility '${id}', but no capability has that id.`);
    const instance = new found();
    this.instances.set(id, instance);
    return instance;
  }

  private ensureEveryRegionCompleted(config: ChainStatechartConfig, value: unknown): void {
    for (const [region, node] of Object.entries(config.regions)) {
      const finalState = Object.entries(node.states).find(([, state]) => state.type === 'final')?.[0];
      const active = typeof value === 'string' ? value : (value as Record<string, string> | undefined)?.[region];
      if (active !== finalState) {
        throw new Error(`Chain '${config.id}' is stuck: region '${region}' did not reach its final state.`);
      }
    }
  }
}
