/**
 * IPC argument validators + IpcValidationError class. Extended from L2.
 *
 * New validators at L3:
 *   - journalAppend: { text: string } (kept from L2, same shape)
 *   - journalList:   no args
 *   - dialogOpen:    optional { defaultPath?, filters?, properties? }
 *   - dialogSave:    optional { defaultPath?, filters? }
 *   - filesDropped:  ReadonlyArray<string> (paths must be absolute non-empty strings)
 *   - appGetMenu:    no args
 *
 * Pattern is identical to L2: validators are pure synchronous functions that
 * throw IpcValidationError on bad input, returning the narrowed value otherwise.
 */

export class IpcValidationError extends Error {
  override readonly name = 'IpcValidationError' as const
  constructor(message: string) {
    super(message)
  }
}

export type Validator<T> = (value: unknown) => T

export interface DialogFilter {
  readonly name: string
  readonly extensions: readonly string[]
}

export interface DialogOpenArgs {
  readonly defaultPath?: string
  readonly filters?: readonly DialogFilter[]
  readonly properties?: readonly string[]
}

export interface DialogSaveArgs {
  readonly defaultPath?: string
  readonly filters?: readonly DialogFilter[]
}

export interface Validators {
  ping: Validator<void>
  echo: Validator<unknown>
  journalAppend: Validator<{ text: string }>
  journalList: Validator<void>
  dialogOpen: Validator<DialogOpenArgs>
  dialogSave: Validator<DialogSaveArgs>
  filesDropped: Validator<readonly string[]>
  appGetMenu: Validator<void>
}

function validateFilters(value: unknown, fieldName: string): readonly DialogFilter[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(`${fieldName}: filters must be an array`)
  }
  return value.map((entry, idx) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}] must be an object`)
    }
    const obj = entry as Record<string, unknown>
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}].name must be a non-empty string`)
    }
    if (!Array.isArray(obj.extensions)) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}].extensions must be an array of strings`)
    }
    for (const ext of obj.extensions) {
      if (typeof ext !== 'string' || ext.length === 0) {
        throw new IpcValidationError(`${fieldName}: filters[${idx}].extensions must contain non-empty strings`)
      }
    }
    return { name: obj.name, extensions: [...(obj.extensions as readonly string[])] }
  })
}

export const validators: Validators = {
  ping: (): void => {
    // Permissive — liveness probe.
  },

  echo: (value: unknown): unknown => {
    if (typeof value === 'undefined') {
      throw new IpcValidationError('echo: value must be defined')
    }
    return value
  },

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

  journalList: (): void => {
    // No args.
  },

  dialogOpen: (value: unknown): DialogOpenArgs => {
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object') {
      throw new IpcValidationError(`dialog:open: expected object payload, got ${typeof value}`)
    }
    const obj = value as Record<string, unknown>
    const out: { defaultPath?: string; filters?: readonly DialogFilter[]; properties?: readonly string[] } = {}
    if (obj.defaultPath !== undefined) {
      if (typeof obj.defaultPath !== 'string') {
        throw new IpcValidationError('dialog:open: defaultPath must be a string')
      }
      out.defaultPath = obj.defaultPath
    }
    if (obj.filters !== undefined) {
      out.filters = validateFilters(obj.filters, 'dialog:open')
    }
    if (obj.properties !== undefined) {
      if (!Array.isArray(obj.properties)) {
        throw new IpcValidationError('dialog:open: properties must be an array of strings')
      }
      for (const p of obj.properties) {
        if (typeof p !== 'string') {
          throw new IpcValidationError('dialog:open: properties must contain only strings')
        }
      }
      out.properties = [...(obj.properties as readonly string[])]
    }
    return out
  },

  dialogSave: (value: unknown): DialogSaveArgs => {
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object') {
      throw new IpcValidationError(`dialog:save: expected object payload, got ${typeof value}`)
    }
    const obj = value as Record<string, unknown>
    const out: { defaultPath?: string; filters?: readonly DialogFilter[] } = {}
    if (obj.defaultPath !== undefined) {
      if (typeof obj.defaultPath !== 'string') {
        throw new IpcValidationError('dialog:save: defaultPath must be a string')
      }
      out.defaultPath = obj.defaultPath
    }
    if (obj.filters !== undefined) {
      out.filters = validateFilters(obj.filters, 'dialog:save')
    }
    return out
  },

  filesDropped: (value: unknown): readonly string[] => {
    if (!Array.isArray(value)) {
      throw new IpcValidationError(`files:dropped: expected array of paths, got ${typeof value}`)
    }
    for (const p of value) {
      if (typeof p !== 'string') {
        throw new IpcValidationError('files:dropped: every path must be a string')
      }
      if (p.length === 0) {
        throw new IpcValidationError('files:dropped: paths must be non-empty strings')
      }
    }
    return [...(value as readonly string[])]
  },

  appGetMenu: (): void => {
    // No args.
  },
}
