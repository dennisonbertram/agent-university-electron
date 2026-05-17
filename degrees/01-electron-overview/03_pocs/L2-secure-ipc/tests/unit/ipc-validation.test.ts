/**
 * Unit tests for the hand-rolled IPC validator helpers and IpcValidationError.
 *
 * Covers per-channel positive and negative cases for every validator the
 * IPC registry exposes. The registry coverage check lives in
 * ipc-registry-coverage.test.ts.
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
  it('Given undefined/null/anything, when called, then returns void without throwing', () => {
    expect(() => validators.ping(undefined)).not.toThrow()
    expect(() => validators.ping(null)).not.toThrow()
    expect(() => validators.ping({ anything: true })).not.toThrow()
  })
})

describe('validators.echo', () => {
  it('Given any JSON-serializable value, when called, then returns it verbatim', () => {
    expect(validators.echo('hello')).toBe('hello')
    expect(validators.echo({ x: 1 })).toEqual({ x: 1 })
    expect(validators.echo([1, 2, 3])).toEqual([1, 2, 3])
    expect(validators.echo(0)).toBe(0)
    expect(validators.echo(null)).toBe(null)
  })

  it('Given undefined, when called, then throws IpcValidationError (must be passable through structured clone)', () => {
    expect(() => validators.echo(undefined)).toThrow(IpcValidationError)
  })
})

describe('validators.journalAppend', () => {
  it('Given { text: string }, when called, then returns the parsed shape', () => {
    expect(validators.journalAppend({ text: 'hello' })).toEqual({ text: 'hello' })
  })

  it('Given non-object input, when called, then throws IpcValidationError', () => {
    expect(() => validators.journalAppend('string')).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(42)).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(null)).toThrow(IpcValidationError)
    expect(() => validators.journalAppend(undefined)).toThrow(IpcValidationError)
  })

  it('Given { text: number }, when called, then throws IpcValidationError with "text" in message', () => {
    let caught: unknown = null
    try {
      validators.journalAppend({ text: 123 })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(IpcValidationError)
    expect((caught as Error).message.toLowerCase()).toContain('text')
  })

  it('Given { text: "" } (empty string), when called, then throws IpcValidationError', () => {
    expect(() => validators.journalAppend({ text: '' })).toThrow(IpcValidationError)
  })

  it('Given { } (missing text), when called, then throws IpcValidationError', () => {
    expect(() => validators.journalAppend({})).toThrow(IpcValidationError)
  })
})
