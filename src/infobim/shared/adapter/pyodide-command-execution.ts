import { runPythonCommand, waitForPythonReady } from '@/infobim/shared/adapter/command';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import type { CommandExecutionResult, Json } from '@/infobim/shared/domain/model/command-execution';
import { CommandExecutionAdapter } from '@/infobim/shared/domain/port/command-execution';

const JSON_FLAG = '--json';

/** The output of the CLI as JSON when it is, as the text it printed when it is not; empty output is null. */
const jsonOf = (text: string): Json => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    return trimmed;
  }
};

/** Runs InfoBIM commands in the Python runtime of the browser (Pyodide), in the opened project. */
export class PyodideCommandExecutionAdapter extends CommandExecutionAdapter {
  async execute(requestId: string, command: string, argv: string[]): Promise<CommandExecutionResult> {
    const folder = ProjectRepository.getInstance().get()?.folder;
    if (!folder) throw new Error('No project is open, so there is nowhere to run the command.');

    await waitForPythonReady();
    const run = await runPythonCommand('run', [...argv, JSON_FLAG], { path: `/storage/${folder.name}`, handle: folder });
    const stderr = jsonOf(run.stderr);
    return {
      requestId,
      // A run worked when the CLI exited with 0 and wrote nothing to stderr.
      success: run.code === 0 && stderr === null,
      code: run.code,
      stdin: command,
      stdout: jsonOf(run.stdout),
      stderr,
    };
  }
}
