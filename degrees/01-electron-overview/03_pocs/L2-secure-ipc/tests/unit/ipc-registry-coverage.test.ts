/**
 * Regression-class check that doubles as a unit test: every channel registered
 * in IPC_REGISTRY must declare a validator. This makes it impossible to add a
 * new IPC handler without also enrolling it in argument validation.
 *
 * Used by R-L2-2 at the regression-commit stage.
 */
import { describe, it, expect, vi } from 'vitest'

// ipc.ts imports `electron` for ipcMain — mock it so the module loads under
// vitest where Electron's binary entry point is unusable.
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  BrowserWindow: class {},
  app: { on: vi.fn(), getPath: vi.fn(() => '/tmp/l2-unit-stub') },
}))

import { IPC_REGISTRY, type IpcRegistryEntry } from '../../src/ipc'

describe('IPC_REGISTRY coverage', () => {
  it('Given the channel registry, when enumerated, then every entry exposes a validator function', () => {
    const channels = Object.keys(IPC_REGISTRY)
    expect(channels.length).toBeGreaterThan(0)
    for (const ch of channels) {
      const entry = IPC_REGISTRY[ch as keyof typeof IPC_REGISTRY] as IpcRegistryEntry
      expect(typeof entry.validator, `channel "${ch}" must declare a validator function`).toBe(
        'function',
      )
      expect(typeof entry.handler, `channel "${ch}" must declare a handler function`).toBe(
        'function',
      )
      expect(typeof entry.channel).toBe('string')
      expect(entry.channel.length).toBeGreaterThan(0)
    }
  })

  it('Given the registry, when iterated, then channel names use verb:noun naming convention', () => {
    for (const entry of Object.values(IPC_REGISTRY)) {
      const channel = (entry as IpcRegistryEntry).channel
      expect(channel).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*$/)
    }
  })

  it('Given the registry, when listing channel names, then there are no duplicates', () => {
    const names = Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel)
    expect(new Set(names).size).toBe(names.length)
  })
})
