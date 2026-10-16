import type { CommandExecutionResult } from '@/infobim/shared/domain/model/command-execution';

/**
 * Runs a command somewhere (the Python runtime in the browser, ttyd, a remote
 * API) and says how it went. It only runs: it does not choose where a command
 * goes, and it does not know the event bus or the terminal.
 */
export abstract class CommandExecutionAdapter {
  /**
   * Runs the command. The adapter fills `success`: the caller and the machines
   * only read it. A run that did not work is a result with `success: false`;
   * an error is for when the command could not run at all.
   */
  abstract execute(requestId: string, command: string, argv: string[]): Promise<CommandExecutionResult>;
}
