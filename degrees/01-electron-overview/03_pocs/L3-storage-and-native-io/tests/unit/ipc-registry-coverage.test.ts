/**
 * Regression-class check that doubles as a unit test: every channel registered
 * in IPC_REGISTRY must declare a validator. Carried forward from L2 and
 * extended to enforce that the L3-new channels (journal:list, dialog:open,
 * dialog:save, files:dropped, app:get-menu-tree) are present.
 *
 * Used by R-L3-1 at the regression-commit stage (extends L2's R-L2-2).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: { getPathForFile: vi.fn(() => '/tmp/unit-stub') },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn(), getApplicationMenu: vi.fn(() => null) },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  app: { on: vi.fn(), getPath: vi.fn(() => '/tmp/l3-unit-stub') },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
}))

import { IPC_REGISTRY, IPC_CHANNELS, type IpcRegistryEntry } from '../../src/ipc'

describe('IPC_REGISTRY coverage', () => {
  it('Given the registry, when enumerated, then every entry has a validator + handler', () => {
    const channels = Object.keys(IPC_REGISTRY)
    expect(channels.length).toBeGreaterThan(0)
    for (const ch of channels) {
      const entry = IPC_REGISTRY[ch as keyof typeof IPC_REGISTRY] as IpcRegistryEntry
      expect(typeof entry.validator, `channel "${ch}" must declare a validator`).toBe('function')
      expect(typeof entry.handler, `channel "${ch}" must declare a handler`).toBe('function')
      expect(typeof entry.channel).toBe('string')
      expect(entry.channel.length).toBeGreaterThan(0)
    }
  })

  it('Given the registry, when iterated, then channel names use verb:noun naming', () => {
    for (const entry of Object.values(IPC_REGISTRY)) {
      const channel = (entry as IpcRegistryEntry).channel
      expect(channel).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*$/)
    }
  })

  it('Given the registry, when listing channel names, then there are no duplicates', () => {
    const names = Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel)
    expect(new Set(names).size).toBe(names.length)
  })

  it('Given the registry, when checked for L3 additions, then all L3 channels are present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.JOURNAL_APPEND)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_LIST)).toBe(true)
    expect(names.has(IPC_CHANNELS.DIALOG_OPEN)).toBe(true)
    expect(names.has(IPC_CHANNELS.DIALOG_SAVE)).toBe(true)
    expect(names.has(IPC_CHANNELS.FILES_DROPPED)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_GET_MENU)).toBe(true)
  })
})
