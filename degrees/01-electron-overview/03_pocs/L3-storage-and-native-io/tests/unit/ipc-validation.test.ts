/**
 * Unit tests for the hand-rolled L3 IPC validators.
 *
 * Covers per-channel positive and negative cases. Validators added at L3 are
 * exercised here so a new channel cannot ship without validation. Registry
 * coverage (every channel has a validator) is in ipc-registry-coverage.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { IpcValidationError, validators } from '../../src/ipc-validation'

describe('IpcValidationError', () => {
  it('has name === "IpcValidationError"', () => {
    const err = new IpcValidationError('hi')
    expect(err.name).toBe('IpcValidationError')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('hi')
  })
})

describe('validators.ping (no-arg)', () => {
  it('Given anything, when called, then returns void', () => {
    expect(() => validators.ping(undefined)).not.toThrow()
    expect(() => validators.ping(null)).not.toThrow()
    expect(() => validators.ping({ anything: true })).not.toThrow()
  })
})

describe('validators.echo', () => {
  it('Given any JSON-cloneable value, when called, then returns it verbatim', () => {
    expect(validators.echo('hello')).toBe('hello')
    expect(validators.echo({ x: 1 })).toEqual({ x: 1 })
    expect(validators.echo([1, 2, 3])).toEqual([1, 2, 3])
    expect(validators.echo(0)).toBe(0)
    expect(validators.echo(null)).toBe(null)
  })

  it('Given undefined, when called, then throws IpcValidationError', () => {
    expect(() => validators.echo(undefined)).toThrow(IpcValidationError)
  })
})

describe('validators.journalAppend', () => {
  it('Given { text: string }, returns parsed shape', () => {
    expect(validators.journalAppend({ text: 'hello' })).toEqual({ text: 'hello' })
  })

  it('Given non-object input, throws', () => {
    expect(() => validators.journalAppend('string')).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(42)).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(null)).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(undefined)).toThrow(IpcValidationError)
  })

  it('Given { text: number }, throws with "text" in message', () => {
    let caught: unknown = null
    try {
      validators.journalAppend({ text: 123 })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(IpcValidationError)
    expect((caught as Error).message.toLowerCase()).toContain('text')
  })

  it('Given { text: "" }, throws', () => {
    expect(() => validators.journalAppend({ text: '' })).toThrow(IpcValidationError)
  })

  it('Given missing text, throws', () => {
    expect(() => validators.journalAppend({})).toThrow(IpcValidationError)
  })
})

describe('validators.journalList', () => {
  it('Given anything, returns void', () => {
    expect(() => validators.journalList(undefined)).not.toThrow()
    expect(() => validators.journalList({})).not.toThrow()
  })
})

describe('validators.dialogOpen', () => {
  it('Given undefined/null, returns {}', () => {
    expect(validators.dialogOpen(undefined)).toEqual({})
    expect(validators.dialogOpen(null)).toEqual({})
  })

  it('Given a valid object, returns the parsed args', () => {
    const arg = {
      defaultPath: '/tmp/foo',
      filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
      properties: ['openFile'],
    }
    const parsed = validators.dialogOpen(arg)
    expect(parsed.defaultPath).toBe('/tmp/foo')
    expect(parsed.filters?.[0]).toEqual({ name: 'Text', extensions: ['txt', 'md'] })
    expect(parsed.properties).toEqual(['openFile'])
  })

  it('Given non-object, throws', () => {
    expect(() => validators.dialogOpen('foo')).toThrow(IpcValidationError)
  })

  it('Given { defaultPath: 5 }, throws', () => {
    expect(() => validators.dialogOpen({ defaultPath: 5 })).toThrow(IpcValidationError)
  })

  it('Given { filters: "nope" }, throws', () => {
    expect(() => validators.dialogOpen({ filters: 'nope' })).toThrow(IpcValidationError)
  })

  it('Given { filters: [{ name: "", extensions: ["txt"] }] }, throws', () => {
    expect(() =>
      validators.dialogOpen({ filters: [{ name: '', extensions: ['txt'] }] }),
    ).toThrow(IpcValidationError)
  })

  it('Given { filters: [{ name: "Text", extensions: [42] }] }, throws', () => {
    expect(() =>
      validators.dialogOpen({ filters: [{ name: 'Text', extensions: [42] }] }),
    ).toThrow(IpcValidationError)
  })

  it('Given { properties: [42] }, throws', () => {
    expect(() => validators.dialogOpen({ properties: [42] })).toThrow(IpcValidationError)
  })
})

describe('validators.dialogSave', () => {
  it('Given undefined/null, returns {}', () => {
    expect(validators.dialogSave(undefined)).toEqual({})
    expect(validators.dialogSave(null)).toEqual({})
  })

  it('Given a valid object, returns the parsed args', () => {
    const arg = { defaultPath: '/tmp/foo.txt', filters: [{ name: 'T', extensions: ['txt'] }] }
    const parsed = validators.dialogSave(arg)
    expect(parsed.defaultPath).toBe('/tmp/foo.txt')
    expect(parsed.filters?.[0]).toEqual({ name: 'T', extensions: ['txt'] })
  })

  it('Given { defaultPath: 5 }, throws', () => {
    expect(() => validators.dialogSave({ defaultPath: 5 })).toThrow(IpcValidationError)
  })
})

describe('validators.filesDropped', () => {
  it('Given an array of non-empty strings, returns the array', () => {
    expect(validators.filesDropped(['/a', '/b/c'])).toEqual(['/a', '/b/c'])
  })

  it('Given an empty array, returns []', () => {
    expect(validators.filesDropped([])).toEqual([])
  })

  it('Given non-array, throws', () => {
    expect(() => validators.filesDropped('not-an-array')).toThrow(IpcValidationError)
    expect(() => validators.filesDropped({})).toThrow(IpcValidationError)
  })

  it('Given array containing non-string, throws', () => {
    expect(() => validators.filesDropped(['/a', 42])).toThrow(IpcValidationError)
  })

  it('Given array containing empty string, throws', () => {
    expect(() => validators.filesDropped(['/a', ''])).toThrow(IpcValidationError)
  })
})

describe('validators.appGetMenu', () => {
  it('Given anything, returns void', () => {
    expect(() => validators.appGetMenu(undefined)).not.toThrow()
  })
})
