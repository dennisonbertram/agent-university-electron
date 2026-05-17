/**
 * Unit tests for the pure URL-parser `parseDeepLink`.
 *
 * Covers the happy path (scheme + action + params) and the boundary cases
 * referenced by R-L4-4: malformed URLs must return `[null, error]`, not a
 * partial parse.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({}))

import { parseDeepLink, DEEP_LINK_SCHEME } from '../../src/protocol'

describe('parseDeepLink — happy path', () => {
  it('Given electron-l5://action?x=1, returns scheme/action/params', () => {
    const [parsed, err] = parseDeepLink('electron-l5://action?x=1')
    expect(err).toBe(null)
    expect(parsed).not.toBe(null)
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.scheme).toBe(DEEP_LINK_SCHEME)
    expect(parsed.action).toBe('action')
    expect(parsed.params).toEqual({ x: '1' })
  })

  it('Given electron-l5://log?text=hello+world, returns space-decoded text', () => {
    const [parsed] = parseDeepLink('electron-l5://log?text=hello+world')
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.action).toBe('log')
    expect(parsed.params.text).toBe('hello world')
  })

  it('Given electron-l5://stop with no params, returns empty params', () => {
    const [parsed] = parseDeepLink('electron-l5://stop')
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.action).toBe('stop')
    expect(parsed.params).toEqual({})
  })

  it('Given multiple params, returns all', () => {
    const [parsed] = parseDeepLink('electron-l5://focus?duration=25&label=deep')
    if (!parsed) throw new Error('expected parsed value')
    expect(parsed.params).toEqual({ duration: '25', label: 'deep' })
  })
})

describe('parseDeepLink — boundary cases (R-L4-4)', () => {
  it('Given electron-l5://, returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('electron-l5://')
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

  it('Given a different scheme (https://example.com), returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('https://example.com')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })

  it('Given a totally malformed URL (electron-l5:/oops), returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('electron-l5:/oops')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })

  it('Given an unparseable URL ("electron-l5://%"), returns [null, Error]', () => {
    const [parsed, err] = parseDeepLink('electron-l5://%')
    expect(parsed).toBe(null)
    expect(err).toBeInstanceOf(Error)
  })
})
