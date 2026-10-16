/** The states of running a command in the Python runtime of the browser. */
export const LocalCommandExecutionState = {
  UNDEFINED: 'undefined',
  COMMAND_RECEIVED: 'command_received',
  COMMAND_RUNNABLE_ON_PYODIDE: 'command_runnable_on_pyodide',
  COMMAND_FINISHED_SUCCESSFULLY: 'command_finished_successfully',
  COMMAND_FINISHED_WITH_FAILURE: 'command_finished_with_failure',
} as const;

export type LocalCommandExecutionStateValue =
  (typeof LocalCommandExecutionState)[keyof typeof LocalCommandExecutionState];
