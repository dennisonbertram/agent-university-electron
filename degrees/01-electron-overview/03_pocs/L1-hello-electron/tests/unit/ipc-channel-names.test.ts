/**
 * Sanity tests for the IPC channel name registry.
 * The channel string values are the contract between main, preload, and renderer.
 * Renaming any of these must break the test until all three sides are updated.
 */
import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../src/ipc'

describe('IPC_CHANNELS', () => {
  it('exposes the L1 channels with the documented string values', () => {
    expect(IPC_CHANNELS.RENDERER_READY).toBe('renderer:ready')
    expect(IPC_CHANNELS.APP_PING).toBe('app:ping')
    expect(IPC_CHANNELS.LOG_PATH).toBe('log:path')
  })

  it('every channel name uses the verb:noun namespacing convention (contains exactly one colon)', () => {
    for (const value of Object.values(IPC_CHANNELS)) {
      expect(value.split(':')).toHaveLength(2)
      expect(value).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/)
    }
  })

  it('channel name values are unique', () => {
    const values = Object.values(IPC_CHANNELS)
    expect(new Set(values).size).toBe(values.length)
  })
})
