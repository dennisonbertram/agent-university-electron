/**
 * Regression-class check that doubles as a unit test: every channel registered
 * in IPC_REGISTRY must declare a validator + handler. Extended for L4 to
 * enforce that the new channels are present.
 *
 * Used by R-L4-1 (regression commit) — also referenced as carry-forward of
 * R-L2-2 / R-L3-1.
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
  app: {
    on: vi.fn(),
    emit: vi.fn(),
    getPath: vi.fn(() => '/tmp/l4-unit-stub'),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    setLoginItemSettings: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(() => true),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    isReady: vi.fn(() => true),
  },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  Tray: class {},
  Notification: class {
    on(): void {}
    show(): void {}
  },
  nativeImage: { createFromBuffer: vi.fn(), createFromPath: vi.fn() },
  nativeTheme: { themeSource: 'system', shouldUseDarkColors: false, on: vi.fn() },
  globalShortcut: {
    register: vi.fn(() => true),
    isRegistered: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  },
  powerMonitor: { on: vi.fn(), emit: vi.fn(), getSystemIdleTime: vi.fn(() => 0) },
}))

import { IPC_REGISTRY, IPC_CHANNELS, type IpcRegistryEntry } from '../../src/ipc'

describe('IPC_REGISTRY coverage (L4)', () => {
  it('Given the registry, every entry has a validator + handler', () => {
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

  it('Given the registry, channel names use verb:noun naming', () => {
    for (const entry of Object.values(IPC_REGISTRY)) {
      const channel = (entry as IpcRegistryEntry).channel
      expect(channel).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*$/)
    }
  })

  it('Given the registry, there are no duplicate channel names', () => {
    const names = Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel)
    expect(new Set(names).size).toBe(names.length)
  })

  it('Given the registry, L4 production channels are present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.TRAY_SET_STATE)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_GET_TRAY_STATE)).toBe(true)
    expect(names.has(IPC_CHANNELS.NOTIFICATION_SHOW)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_SET_AUTOLAUNCH)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_GET_AUTOLAUNCH)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_SET_THEME)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_GET_THEME)).toBe(true)
    expect(names.has(IPC_CHANNELS.DOCK_SET_BADGE)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_ADD_RECENT)).toBe(true)
  })

  it('Given the registry, L4 test seams are present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.TEST_FIRE_SHORTCUT)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_EMIT_POWER)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_TRIGGER_WILL_QUIT)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_EMIT_OPEN_URL)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_EMIT_SECOND_INSTANCE)).toBe(true)
  })

  it('Given the registry, L3 channels remain present (no regression)', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.JOURNAL_APPEND)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_LIST)).toBe(true)
    expect(names.has(IPC_CHANNELS.DIALOG_OPEN)).toBe(true)
    expect(names.has(IPC_CHANNELS.DIALOG_SAVE)).toBe(true)
    expect(names.has(IPC_CHANNELS.FILES_DROPPED)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_GET_MENU)).toBe(true)
  })
})
