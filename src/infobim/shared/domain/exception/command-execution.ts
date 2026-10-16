/** The command was rejected before it could run, such as an empty or foreign command. */
export class CommandInvalidError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'CommandInvalidError';
  }
}
