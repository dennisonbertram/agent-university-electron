/**
 * Every channel in IPC_REGISTRY must have validator + handler. Pulse adds
 * focus + journal-encrypted + new test seams.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn(), getApplicationMenu: vi.fn(() => null) },
  app: {
    on: vi.fn(),
    emit: vi.fn(),
    getPath: vi.fn(() => '/tmp/pulse-unit-stub'),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    setLoginItemSettings: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(() => true),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    isReady: vi.fn(() => true),
    addRecentDocument: vi.fn(),
    getVersion: vi.fn(() => '1.0.0'),
    setPath: vi.fn(),
  },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  Tray: class {},
  Notification: class { on(): void {} show(): void {} },
  nativeImage: { createFromBuffer: vi.fn(), createFromPath: vi.fn() },
  nativeTheme: { themeSource: 'system', shouldUseDarkColors: false, on: vi.fn() },
  globalShortcut: {
    register: vi.fn(() => true),
    isRegistered: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  },
  powerMonitor: { on: vi.fn(), emit: vi.fn(), getSystemIdleTime: vi.fn(() => 0) },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString('utf8')),
  },
  systemPreferences: {
    canPromptTouchID: vi.fn(() => true),
    promptTouchID: vi.fn(async () => undefined),
  },
}))

import { IPC_REGISTRY, IPC_CHANNELS, type IpcRegistryEntry } from '../../src/ipc'

describe('IPC_REGISTRY coverage (Pulse)', () => {
  it('every entry has validator + handler', () => {
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

  it('channel names use verb:noun naming', () => {
    for (const entry of Object.values(IPC_REGISTRY)) {
      const channel = (entry as IpcRegistryEntry).channel
      expect(channel).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9:-]*$/)
    }
  })

  it('no duplicate channel names', () => {
    const names = Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel)
    expect(new Set(names).size).toBe(names.length)
  })

  it('capstone production channels present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.FOCUS_START)).toBe(true)
    expect(names.has(IPC_CHANNELS.FOCUS_STOP)).toBe(true)
    expect(names.has(IPC_CHANNELS.FOCUS_STATE)).toBe(true)
    expect(names.has(IPC_CHANNELS.FOCUS_EXTEND)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_APPEND)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_LIST)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_UNLOCK_WITH_PASSPHRASE)).toBe(true)
    expect(names.has(IPC_CHANNELS.JOURNAL_SET_PASSPHRASE)).toBe(true)
  })

  it('capstone test seams present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.TEST_ADVANCE_CLOCK)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_TRIGGER_NOTIFICATION_ACTION)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_FIRE_DEEP_LINK)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_GET_BOOT_SUMMARY)).toBe(true)
  })

  it('L4/L5 carry-forward channels still present', () => {
    const names = new Set(Object.values(IPC_REGISTRY).map((e) => (e as IpcRegistryEntry).channel))
    expect(names.has(IPC_CHANNELS.TRAY_SET_STATE)).toBe(true)
    expect(names.has(IPC_CHANNELS.NOTIFICATION_SHOW)).toBe(true)
    expect(names.has(IPC_CHANNELS.APP_SET_AUTOLAUNCH)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_FIRE_SHORTCUT)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_EMIT_POWER)).toBe(true)
    expect(names.has(IPC_CHANNELS.TEST_GET_CRASH_REPORTER_STATE)).toBe(true)
  })
})
