import { eventBus, type AppEvent } from '@/infobim/shared/adapter/event-bus';
import { CommandInvalidError } from '@/infobim/shared/domain/exception/command-execution';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { LocalCommandExecutionMachine } from '@/infobim/run/plugin/machine/local_command_execution/machine';
import { LocalCommandExecutionState } from '@/infobim/run/plugin/machine/local_command_execution/state';

const COMMAND_REQUESTED = 'presentation.main.command.requested';
type CommandRequested = AppEventMap[typeof COMMAND_REQUESTED];

const SOURCE = 'run_on_command_requested';

export class OnCommandRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'run',
    description: 'Runs a requested InfoBIM command in the Python runtime and publishes its result.',
    arguments: [
      {
        listen: [COMMAND_REQUESTED],
        valued: true,
        parameter: 'command',
        description: 'The command to run, such as "infobim project --refresh".',
        type: 'str',
      },
    ],
  };

  private readonly request: CommandRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as CommandRequested | undefined;
  }

  /**
   * Hands the command to the local execution machine and publishes exactly one
   * event: `code.success`, `code.failure`, or `command.invalid` when the
   * command is rejected before running. Only this listener publishes them.
   */
  async run(): Promise<void> {
    const request = this.request;
    if (!request?.requestId) throw new Error('The command request has no requestId.');

    try {
      const { state, result } = await new LocalCommandExecutionMachine(request).execute();
      if (state === LocalCommandExecutionState.COMMAND_FINISHED_SUCCESSFULLY) {
        eventBus.publish('presentation.main.code.success', SOURCE, { requestId: request.requestId, result });
      } else {
        eventBus.publish('presentation.main.code.failure', SOURCE, {
          requestId: request.requestId,
          result,
          message: `The command exited with code ${result.code}.`,
        });
      }
    } catch (error) {
      if (error instanceof CommandInvalidError) {
        eventBus.publish('presentation.main.command.invalid', SOURCE, { requestId: request.requestId, reason: error.reason });
        return;
      }
      eventBus.publish('presentation.main.code.failure', SOURCE, {
        requestId: request.requestId,
        result: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
