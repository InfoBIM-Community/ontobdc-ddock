import { runPythonCommand } from '@/infobim/shared/adapter/command';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import { folderOf } from './folder';

/** Runs `infobim project --remote` in the temporary folder. */
export class RemoteProjectConnectedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.project.plugin.capability.transformation.target.remote_project_connected',
    description: 'Run infobim project --remote in the temporary folder.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const url = context.parameters.url;
    if (!url) throw new Error('The connection has no URL.');
    const { mount } = folderOf(context);
    const connect = await runPythonCommand('project', ['infobim', 'project', '--remote', url, '--json'], mount);
    if (connect.code !== 0) {
      throw new Error(connect.stdout.trim() || connect.stderr.trim() || `infobim project --remote failed (exit ${connect.code}).`);
    }
    context.etl.write('remote_project_connection', context.requestId, context.state, {
      phase: 'done',
      entity: { url },
      result: { code: connect.code, stdout: connect.stdout },
    });
  }
}
