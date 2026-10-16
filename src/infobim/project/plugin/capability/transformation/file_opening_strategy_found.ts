import chainSource from '../../machine/explorer_file_open/standard_explorer_file_open_chain.yaml?raw';
import { ChainOfResponsibilityWorkerAdapter } from '@/infobim/shared/adapter/chain-worker';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import type { ChainResponsibilityClass } from '@/infobim/shared/domain/model/chain';

type CapabilityModule = Record<string, unknown>;

/** Discover the capabilities of this folder without executing them yet. */
const capabilityImports = import.meta.glob<CapabilityModule>('./*.ts');

/**
 * Determines how the activated file should be opened by running the open-file
 * chain: each responsibility is an ordinary capability of this folder that
 * also implements `canHandle`, declared as a region of the chain's YAML.
 */
export class FileOpeningStrategyFoundCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.file_opening_strategy_found',
    description: 'Determine how the activated file should be opened.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const candidates = await this.chainCandidates();
    const worker = new ChainOfResponsibilityWorkerAdapter(chainSource, candidates, context);
    const handled = await worker.work();

    context.etl.write('explorer_file_open', context.requestId, context.state, {
      phase: 'done',
      entity: {},
      result: { handled },
    });
  }

  private async chainCandidates(): Promise<ChainResponsibilityClass[]> {
    const candidates: ChainResponsibilityClass[] = [];
    for (const load of Object.values(capabilityImports)) {
      for (const exported of Object.values(await load())) {
        if (typeof exported !== 'function') continue;
        const canHandle = (exported.prototype as { canHandle?: unknown } | undefined)?.canHandle;
        if (typeof canHandle !== 'function') continue;
        candidates.push(exported as ChainResponsibilityClass);
      }
    }
    return candidates;
  }
}
