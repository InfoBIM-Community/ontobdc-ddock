import { splitCommandLine } from '@/infobim/shared/adapter/command-line';
import type { CapabilityContext, CapabilityMetadata } from '@/infobim/shared/domain/model/capability';
import { CommandInvalidError } from '@/infobim/shared/domain/exception/command-execution';

const PROGRAM = 'infobim';
const JSON_FLAG = '--json';

/** Accepts the command, or rejects it with the reason. */
export class CommandReceivedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.infobim.run.plugin.capability.transformation.target.command_received',
    description: 'Accept the requested command: only a plain InfoBIM command can run.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const command = context.parameters.command ?? '';
    let argv: string[];
    try {
      argv = splitCommandLine(command);
    } catch (error) {
      throw new CommandInvalidError(error instanceof Error ? error.message : String(error));
    }
    if (argv.length === 0) throw new CommandInvalidError('The command is empty.');
    if (argv[0] !== PROGRAM) throw new CommandInvalidError(`Only ${PROGRAM} commands can run here.`);
    if (argv.includes(JSON_FLAG)) throw new CommandInvalidError(`Do not pass ${JSON_FLAG}; it is added when the command runs.`);

    context.etl.write('local_command_execution', context.requestId, context.state, {
      phase: 'done',
      entity: { command },
      result: { argv },
    });
  }
}
