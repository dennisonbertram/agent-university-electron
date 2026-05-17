/**
 * Sanity tests for the IPC channel name registry.
 * The channel string values are the contract between main, preload, and renderer.
 * Renaming any of these must break the test until all three sides are updated.
 */
import { describe, it, expect, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/ipc'

// Preload calls contextBridge.exposeInMainWorld at module top level. Under
// vitest (Node, no Electron runtime) the real 'electron' module returns a
// binary path, not an API object. Mock just enough to let preload import.
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn(), invoke: vi.fn() },
}))

// Imported AFTER the mock above is declared.
// eslint-disable-next-line import/first
import { PRELOAD_INLINE_CHANNELS } from '../../src/preload'

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

  it('preload inline channel constants do not drift from IPC_CHANNELS', () => {
    // Sandbox preload cannot import ./ipc at runtime — preload inlines the
    // strings. This test fails if anyone renames a channel in ipc.ts without
    // updating preload.ts. See preload.ts header comment for the gotcha.
    expect(PRELOAD_INLINE_CHANNELS.RENDERER_READY).toBe(IPC_CHANNELS.RENDERER_READY)
    expect(PRELOAD_INLINE_CHANNELS.APP_PING).toBe(IPC_CHANNELS.APP_PING)
    expect(PRELOAD_INLINE_CHANNELS.LOG_PATH).toBe(IPC_CHANNELS.LOG_PATH)
  })
})
