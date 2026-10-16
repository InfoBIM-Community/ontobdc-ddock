/** Any value JSON can carry. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** What running a command left: a serializable object, as the plan defines it. */
export type CommandExecutionResult = {
  requestId: string;
  /** Whether the run worked. The executor decides, not the caller. */
  success: boolean;
  /** Exit code when there is one. */
  code: number | null;
  /** The command as it was requested, without the `--json` flag the executor adds. */
  stdin: string;
  stdout: Json;
  stderr: Json;
};
