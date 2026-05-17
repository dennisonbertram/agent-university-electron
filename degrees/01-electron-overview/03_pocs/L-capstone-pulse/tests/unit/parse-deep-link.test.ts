/**
 * Pure URL-parser tests for `parseDeepLink`. Covers happy path + R-L4-4
 * boundary cases (carried forward from L4/L5 with scheme renamed to `pulse`).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({}))

import { parseDeepLink, DEEP_LINK_SCHEME } from '../../src/protocol'

describe('parseDeepLink — happy path', () => {
  it('Given pulse://start?duration=25, returns scheme/action/params', () => {
    const [parsed, err] = parseDeepLink('pulse://start?duration=25')
    expect(err).toBe(null)
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.scheme).toBe(DEEP_LINK_SCHEME)
    expect(parsed.action).toBe('start')
    expect(parsed.params).toEqual({ duration: '25' })
  })

  it('Given pulse://log?text=hello+world, returns space-decoded text', () => {
    const [parsed] = parseDeepLink('pulse://log?text=hello+world')
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.action).toBe('log')
    expect(parsed.params.text).toBe('hello world')
  })

  it('Given pulse://stop with no params, returns empty params', () => {
    const [parsed] = parseDeepLink('pulse://stop')
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.action).toBe('stop')
    expect(parsed.params).toEqual({})
  })
})

describe('parseDeepLink — boundary cases (R-L4-4)', () => {
  it('Given pulse://, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('pulse://')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given an empty string, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given a non-string input, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink(undefined)
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given a different scheme, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('https://example.com')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given electron-l5:// (the OLD scheme), returns [null, Error]', () => {
    // Sanity: the capstone explicitly renamed the scheme.
    const [parsed, err] = parseDeepLink('electron-l5://start')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given pulse:/oops, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('pulse:/oops')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
  it('Given pulse://%, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('pulse://%')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
})
