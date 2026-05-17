/**
 * IPC argument validators + IpcValidationError class.
 *
 * Hand-rolled (no Zod) so the L2 POC stays dependency-light. Each validator
 * is a function that throws an IpcValidationError if the input is malformed,
 * otherwise returns the (narrowed/typed) parsed value.
 *
 * Pattern:
 *   const value = validators.journalAppend(raw) // throws on bad input
 *   // value is { text: string }
 *
 * Used by src/ipc.ts to gate every IPC handler.
 *
 * SKELETON (RED commit): all functions throw "not implemented" so the
 * unit tests fail with a real failure (not a module-not-found error).
 */

export class IpcValidationError extends Error {
  override readonly name = 'IpcValidationError' as const
  constructor(message: string) {
    super(message)
  }
}

export type Validator<T> = (value: unknown) => T

export interface Validators {
  ping: Validator<void>
  echo: Validator<unknown>
  journalAppend: Validator<{ text: string }>
}

// RED skeleton — every validator throws so the failing tests fail
// on real assertions, not import errors. Replaced in GREEN.
const NOT_IMPL = 'validator not implemented (RED skeleton)'

export const validators: Validators = {
  ping: () => {
    throw new IpcValidationError(NOT_IMPL)
  },
  echo: () => {
    throw new IpcValidationError(NOT_IMPL)
  },
  journalAppend: () => {
    throw new IpcValidationError(NOT_IMPL)
  },
}
