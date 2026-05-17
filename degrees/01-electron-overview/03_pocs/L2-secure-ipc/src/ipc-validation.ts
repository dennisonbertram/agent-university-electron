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
 * NOTE on Error name: `name = 'IpcValidationError'` is what the renderer
 * sees on a rejected `ipcRenderer.invoke` promise. Electron's structured
 * cloning preserves Error name + message across the IPC boundary; the
 * renderer matches on `err.name === 'IpcValidationError'` (BT-L2-5).
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

/**
 * Validators per channel. Keep these as pure synchronous functions: they run
 * in the main process before any I/O. Throw IpcValidationError with a
 * descriptive message — the message is the only thing that survives
 * serialization to the renderer (see 01_research/04-ipc-patterns.md).
 */
export const validators: Validators = {
  /** ping takes no arguments — anything is accepted and ignored. */
  ping: (): void => {
    // Intentionally permissive: ping is a liveness probe.
  },

  /** echo accepts any structured-clone-able value, including null, but NOT undefined
   *  (structured clone treats undefined as "absent" inside objects; for the top-level
   *  IPC value we mirror that rule to keep the contract explicit). */
  echo: (value: unknown): unknown => {
    if (typeof value === 'undefined') {
      throw new IpcValidationError('echo: value must be defined (undefined is not structured-cloneable as a top-level arg)')
    }
    return value
  },

  /** journal:append expects { text: string } with a non-empty string. */
  journalAppend: (value: unknown): { text: string } => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`journal:append: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (!('text' in obj)) {
      throw new IpcValidationError('journal:append: missing required field "text"')
    }
    if (typeof obj.text !== 'string') {
      throw new IpcValidationError(`journal:append: field "text" must be string, got ${typeof obj.text}`)
    }
    if (obj.text.length === 0) {
      throw new IpcValidationError('journal:append: field "text" must not be empty')
    }
    return { text: obj.text }
  },
}
