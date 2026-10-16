import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { CommandExecutionResult } from '@/infobim/shared/domain/model/command-execution';

/**
 * A value as one word of a command line. The command parser supports quoting
 * but has no escape syntax, so a value with both quote characters cannot be given.
 */
export function quoted(value: string): string {
  const quote = !value.includes('"') ? '"' : !value.includes("'") ? "'" : null;
  if (!quote) throw new Error('A value of a command cannot contain both quote characters.');
  return `${quote}${value}${quote}`;
}

/**
 * Asks for a command to be run, through the event bus, and waits for its answer:
 * the result when it worked; an error when it failed or the line was invalid.
 * The answer is recognized by the request id, so other commands are not mistaken for it.
 */
export function requestCommand(command: string, source: string): Promise<CommandExecutionResult> {
  const requestId = crypto.randomUUID();
  return new Promise<CommandExecutionResult>((resolve, reject) => {
    const stop = (): void => unsubscribe.forEach((dispose) => dispose());
    const unsubscribe = [
      eventBus.subscribe('presentation.main.code.success', ({ payload }) => {
        if (payload?.requestId !== requestId) return;
        stop();
        resolve(payload.result);
      }),
      eventBus.subscribe('presentation.main.code.failure', ({ payload }) => {
        if (payload?.requestId !== requestId) return;
        stop();
        reject(new Error(payload.message));
      }),
      eventBus.subscribe('presentation.main.command.invalid', ({ payload }) => {
        if (payload?.requestId !== requestId) return;
        stop();
        reject(new Error(payload.reason));
      }),
    ];
    try {
      eventBus.publish('presentation.main.command.requested', source, { requestId, command });
    } catch (error) {
      stop();
      reject(error);
    }
  });
}
