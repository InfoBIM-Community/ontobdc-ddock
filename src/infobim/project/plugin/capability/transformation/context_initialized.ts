import { runPythonCommand } from '@/infobim/shared/adapter/command';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import { folderOf } from './folder';

/** Runs `infobim init` in the temporary folder. */
export class ContextInitializedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.context_initialized',
    description: 'Run infobim init in the temporary folder.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { mount } = folderOf(context);
    const init = await runPythonCommand('project', ['infobim', 'init', '--json'], mount);
    if (init.code !== 0) throw new Error(init.stderr.trim() || `infobim init failed (exit ${init.code}).`);
    context.etl.write('remote_project_connection', context.requestId, context.state, {
      phase: 'done',
      entity: { argv: ['infobim', 'init'] },
      result: { code: init.code },
    });
  }
}
