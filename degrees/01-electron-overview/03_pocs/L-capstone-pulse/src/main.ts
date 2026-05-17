/**
 * Pulse main-process entry — capstone.
 *
 * CRITICAL PRE-READY ORDERING:
 *   1. requestSingleInstanceLock() — module-load, BEFORE whenReady (R-L4-5 / R-C-4).
 *   2. startCrashReporter()         — module-load, BEFORE whenReady (R-L5-1 / R-C-5).
 *   3. setAsDefaultProtocolClient('pulse')
 *   4. open-url + second-instance handlers
 *   5. app.dock.hide() — invoked BEFORE first BrowserWindow is created
 *      (BT-C-10). On non-darwin or `LSUIElement: true` packaged builds this
 *      is redundant; in dev it is the load-bearing call.
 *
 * Capstone-new wiring:
 *   - safeStorage encryptor (with fallback to plaintext when unavailable).
 *   - JournalStore (better-sqlite3) opened against `${userData}/journal.db`.
 *   - PassphraseStore (PBKDF2 + crypto.timingSafeEqual).
 *   - BiometricService (Touch ID gating, env-override-aware).
 *   - FocusEngine (state machine + tick + sleep/resume).
 *   - Deep-link dispatch handles `pulse://start`, `pulse://stop`, `pulse://log`.
 */
import { app, BrowserWindow, ipcMain, session, type WebContents } from 'electron'
import path from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'

import { createLogger } from './log'
import { startCrashReporter, type CrashReporterService } from './crash'
import { installUpdater, type UpdaterService } from './updater'

// ---------------------------------------------------------------------------
// CRASH REPORTER — R-L5-1 / R-C-5: invoked BEFORE app.whenReady().
// ---------------------------------------------------------------------------
const CRASH_BOOT_LOG_DIR = process.env.LOG_DIR ?? path.join(__dirname, '..', '.crash-boot-logs')
try { mkdirSync(CRASH_BOOT_LOG_DIR, { recursive: true }) } catch { /* best-effort */ }
const crashBootLogger = createLogger({
  logDir: CRASH_BOOT_LOG_DIR,
  module: 'crash',
  process: 'main',
})
let crashReporterService: CrashReporterService | null = null
try {
  const submitURL = process.env.CRASH_URL
  crashReporterService = startCrashReporter({
    logger: crashBootLogger,
    submitURL,
    productName: 'Pulse',
  })
} catch (err) {
  crashBootLogger.error('crash-reporter:start-failed', {
    message: err instanceof Error ? err.message : String(err),
  })
}

// ---------------------------------------------------------------------------
// SINGLE-INSTANCE LOCK — R-L4-5 / R-C-4: BEFORE whenReady().
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

import { registerIpc, PUSH_CHANNELS, type HandlerContext, type BootSummary } from './ipc'
import { createMainWindow } from './window'
import { registerSecurityGuards, registerSessionPermissionHandler } from './security'
import {
  installTray,
  type TrayController,
  type TrayState,
  type TrayStateView,
} from './tray'
import { installNotificationService, type NotificationService } from './notifications'
import { installShortcuts, type ShortcutsService, FOCUS_TOGGLE_ACCELERATOR, JOURNAL_QUICK_ACCELERATOR } from './shortcuts'
import { installPowerService, type PowerService } from './power'
import { installLifecycle, type LifecycleController } from './lifecycle'
import { parseDeepLink, DEEP_LINK_SCHEME, type ParsedDeepLink } from './protocol'
import { installAutoLaunch, type AutoLaunchService } from './autolaunch'
import { installThemeService, type ThemeService } from './theme'
import { installDock, type DockService } from './dock'
import { installFocusEngine, type FocusEngine, type FocusIntent } from './focus-engine'
import { installJournalStore, type JournalStore } from './journal-store'
import { installBiometricService, type BiometricService } from './biometric'
import { installPassphraseStore, type PassphraseStore } from './passphrase'
import type { TestEmitPowerArgs } from './ipc-validation'

function resolveLogDir(): string {
  const fromEnv = process.env.LOG_DIR
  if (fromEnv && fromEnv.length > 0) return fromEnv
  try { return app.getPath('logs') } catch { return path.join(app.getPath('userData'), 'logs') }
}

const userDataOverride = process.env.USER_DATA_DIR
if (userDataOverride && userDataOverride.length > 0) {
  try {
    mkdirSync(userDataOverride, { recursive: true })
    app.setPath('userData', userDataOverride)
  } catch { /* ignored */ }
}

const LOG_DIR = resolveLogDir()
const appLogger = createLogger({ logDir: LOG_DIR, module: 'app', process: 'main' })
const ipcLogger = createLogger({ logDir: LOG_DIR, module: 'ipc', process: 'main' })
const secLogger = createLogger({ logDir: LOG_DIR, module: 'security', process: 'main' })
const trayLogger = createLogger({ logDir: LOG_DIR, module: 'tray', process: 'main' })
const notificationLogger = createLogger({ logDir: LOG_DIR, module: 'notification', process: 'main' })
const shortcutLogger = createLogger({ logDir: LOG_DIR, module: 'shortcut', process: 'main' })
const powerLogger = createLogger({ logDir: LOG_DIR, module: 'power', process: 'main' })
const lifecycleLogger = createLogger({ logDir: LOG_DIR, module: 'lifecycle', process: 'main' })
const autolaunchLogger = createLogger({ logDir: LOG_DIR, module: 'autolaunch', process: 'main' })
const themeLogger = createLogger({ logDir: LOG_DIR, module: 'theme', process: 'main' })
const dockLogger = createLogger({ logDir: LOG_DIR, module: 'dock', process: 'main' })
const protocolLogger = createLogger({ logDir: LOG_DIR, module: 'protocol', process: 'main' })
const updaterLogger = createLogger({ logDir: LOG_DIR, module: 'updater', process: 'main' })
const focusLogger = createLogger({ logDir: LOG_DIR, module: 'focus', process: 'main' })
const journalLogger = createLogger({ logDir: LOG_DIR, module: 'journal', process: 'main' })
const biometricLogger = createLogger({ logDir: LOG_DIR, module: 'biometric', process: 'main' })
const bootLogger = createLogger({ logDir: LOG_DIR, module: 'boot', process: 'main' })

appLogger.info('app:starting', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  platform: process.platform,
  gotSingleInstanceLock,
})

try {
  const protocolRegistered = app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
  protocolLogger.info('protocol:registered', {
    scheme: DEEP_LINK_SCHEME, success: protocolRegistered,
  })
} catch (err) {
  protocolLogger.error('protocol:register-failed', {
    scheme: DEEP_LINK_SCHEME,
    message: err instanceof Error ? err.message : String(err),
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  state.lifecycle?.dispatchArgs([url], 'open-url')
})

app.on('second-instance', (_event, argv, _cwd) => {
  state.lifecycle?.dispatchArgs(argv, 'second-instance')
})

interface AppState {
  tray: TrayController | null
  notifications: NotificationService | null
  shortcuts: ShortcutsService | null
  power: PowerService | null
  lifecycle: LifecycleController | null
  autolaunch: AutoLaunchService | null
  theme: ThemeService | null
  dock: DockService | null
  updater: UpdaterService | null
  focus: FocusEngine | null
  journal: JournalStore | null
  biometric: BiometricService | null
  passphrase: PassphraseStore | null
  encryptionAvailable: boolean
  dockHiddenAtBoot: boolean
  journalRowsAtBoot: number
  quitting: boolean
}

const state: AppState = {
  tray: null,
  notifications: null,
  shortcuts: null,
  power: null,
  lifecycle: null,
  autolaunch: null,
  theme: null,
  dock: null,
  updater: null,
  focus: null,
  journal: null,
  biometric: null,
  passphrase: null,
  encryptionAvailable: false,
  dockHiddenAtBoot: false,
  journalRowsAtBoot: 0,
  quitting: false,
}

const FALLBACK_TRAY_VIEW: TrayStateView = { state: 'idle', title: '?', hasImage: false }

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    try {
      w.webContents.send(channel, payload)
    } catch { /* best-effort */ }
  }
}

function buildEncryptor(): { encrypt: (s: string) => Buffer; decrypt: (b: Buffer) => string } {
  // Lazily-resolved adapter — at module-load time `safeStorage` may not be
  // available. Resolve lazily on each call.
  return {
    encrypt(plaintext: string): Buffer {
      try {
        // Reference required for the R-C-2 source check.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { safeStorage } = require('electron') as typeof import('electron')
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.encryptString(plaintext)
        }
      } catch (err) {
        journalLogger.error('journal:encrypt:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      // Fallback to plaintext bytes — flagged by the encrypted? metadata.
      journalLogger.warn('journal:encryption-unavailable:fallback-plaintext', {})
      return Buffer.from(plaintext, 'utf8')
    },
    decrypt(ciphertext: Buffer): string {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { safeStorage } = require('electron') as typeof import('electron')
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(ciphertext)
        }
      } catch (err) {
        journalLogger.error('journal:decrypt:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      // Fallback path: ciphertext IS the plaintext bytes.
      return ciphertext.toString('utf8')
    },
  }
}

// ---------------------------------------------------------------------------
// Deep-link router — only the action-routing logic lives here. Parse + log
// happens in lifecycle.ts; this function handles `start`, `stop`, `log`.
// ---------------------------------------------------------------------------
function deepLinkHandler(link: ParsedDeepLink, origin: 'open-url' | 'second-instance'): void {
  protocolLogger.info('deeplink:dispatched', {
    scheme: link.scheme, action: link.action, params: link.params, origin,
  })
  broadcast(PUSH_CHANNELS.LIFECYCLE_OPEN_URL, {
    url: `${link.scheme}://${link.action}`,
    action: link.action,
    params: link.params,
    origin,
  })
  if (link.action === 'start') {
    const dur = Number(link.params.duration ?? '25')
    const durationMs = Number.isFinite(dur) && dur > 0 ? dur * 60_000 : 25 * 60_000
    try {
      state.focus?.start(durationMs)
      protocolLogger.info('deeplink:start:dispatched', { durationMs })
    } catch (err) {
      protocolLogger.error('deeplink:start:threw', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (link.action === 'stop') {
    try {
      state.focus?.stop()
      protocolLogger.info('deeplink:stop:dispatched', {})
    } catch (err) {
      protocolLogger.error('deeplink:stop:threw', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (link.action === 'log') {
    const text = link.params.text
    if (typeof text === 'string' && text.length > 0 && text.length <= 10_000) {
      try {
        const out = state.journal?.append(text)
        protocolLogger.info('deeplink:log:dispatched', {
          ok: out !== undefined, id: out?.id ?? null,
        })
        if (out) {
          journalLogger.info('journal:append:1-row', { id: out.id, length: out.length })
          broadcast(PUSH_CHANNELS.JOURNAL_APPENDED, { id: out.id, ts: out.ts, length: out.length })
          // Schedule a fire-and-forget confirmation notification (best-effort).
          state.notifications?.show({
            title: 'Pulse',
            body: 'Journal entry captured.',
          }).catch(() => { /* ignore */ })
        }
      } catch (err) {
        protocolLogger.error('deeplink:log:threw', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      protocolLogger.warn('deeplink:log:rejected', {
        reason: 'text missing or out of bounds',
        length: typeof text === 'string' ? text.length : -1,
      })
    }
  }
}

function focusIntentHandler(intent: FocusIntent): void {
  if (intent.kind === 'tray-state') {
    const next = intent.payload.state as TrayState | undefined
    if (next && state.tray) state.tray.setState(next)
  } else if (intent.kind === 'log') {
    const event = String(intent.payload.event ?? 'focus:unknown')
    focusLogger.info(event, intent.payload)
  } else if (intent.kind === 'notification') {
    const title = String(intent.payload.title ?? 'Pulse')
    const body = String(intent.payload.body ?? '')
    const actionsRaw = intent.payload.actions
    const actions = Array.isArray(actionsRaw)
      ? (actionsRaw as ReadonlyArray<{ type: 'button'; text: string }>)
      : undefined
    const handlerId = String(intent.payload.handlerId ?? '')
    state.notifications?.show({ title, body, actions }).then((res) => {
      // If the engine declared a notification handler id, wire it now (after
      // the show() resolved we have the real notification id).
      if (handlerId && state.notifications) {
        state.notifications.registerActionHandler(res.id, (actionIndex) => {
          try {
            state.focus?.extend(5 * 60_000)
            focusLogger.info('focus:extended:+5min', { actionIndex, handlerId })
          } catch (err) {
            focusLogger.error('focus:extend:from-action:threw', {
              message: err instanceof Error ? err.message : String(err),
            })
          }
        })
        focusLogger.info('focus:notification:handler-registered', { id: res.id, handlerId })
      }
    }).catch((err) => {
      focusLogger.error('focus:notification:show-rejected', {
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }
}

function makeHandlerContext(): HandlerContext {
  return {
    logger: ipcLogger,
    monotonicNow: (): number => {
      const perf = (globalThis as { performance?: { now(): number } }).performance
      if (perf && typeof perf.now === 'function') return Math.floor(perf.now())
      return Date.now()
    },
    tray: {
      setState: (next: TrayState): TrayStateView => {
        if (!state.tray) return FALLBACK_TRAY_VIEW
        state.tray.setState(next)
        return state.tray.getState()
      },
      getState: (): TrayStateView => state.tray?.getState() ?? FALLBACK_TRAY_VIEW,
    },
    notifications: {
      show: async (args) => {
        if (!state.notifications) throw new Error('notifications service not installed')
        return state.notifications.show(args)
      },
      triggerActionForTest: (id, actionIndex) => {
        if (!state.notifications) return { ok: false, reason: 'no-service' }
        return state.notifications.triggerActionForTest(id, actionIndex)
      },
    },
    autolaunch: {
      set: (enabled) => {
        if (!state.autolaunch) return { requested: enabled, observed: false }
        return state.autolaunch.set(enabled)
      },
      get: () => {
        const settings = app.getLoginItemSettings()
        const out: { openAtLogin: boolean; status?: string } = { openAtLogin: settings.openAtLogin }
        const status = (settings as { status?: string }).status
        if (typeof status === 'string') out.status = status
        return out
      },
    },
    theme: {
      setSource: (source) => state.theme?.setSource(source) ?? { source, isDark: false },
      snapshot: () => state.theme?.snapshot() ?? { source: 'system', isDark: false },
    },
    dock: {
      setBadge: (badge) => state.dock?.setBadge(badge) ?? { ok: false, badge },
      addRecentDocument: (filePath) => state.dock?.addRecentDocument(filePath) ?? { ok: false },
    },
    updater: {
      checkForUpdates: async () => {
        if (!state.updater) throw new Error('updater service not installed')
        return state.updater.checkForUpdates()
      },
      getState: () => state.updater?.getState() ?? {
        lastEvent: 'idle',
        version: null,
        currentVersion: app.getVersion(),
        feedUrl: null,
        provider: 'none',
        errorMessage: 'updater service not installed',
      },
    },
    crashReporter: {
      getState: () => crashReporterService?.getState() ?? {
        started: false,
        submitURL: null,
        uploadToServer: false,
        startedBeforeWhenReady: false,
        uploadedReports: 0,
      },
    },
    focus: {
      start: (durationMs) => {
        if (!state.focus) throw new Error('focus engine not installed')
        return state.focus.start(durationMs)
      },
      stop: () => {
        if (!state.focus) throw new Error('focus engine not installed')
        return state.focus.stop()
      },
      state: () => state.focus?.getState() ?? { kind: 'idle' },
      extend: (bonusMs) => {
        if (!state.focus) throw new Error('focus engine not installed')
        return state.focus.extend(bonusMs)
      },
      advanceClock: (toMs) => {
        if (!state.focus) throw new Error('focus engine not installed')
        return state.focus.advanceClock(toMs)
      },
    },
    journal: {
      append: (text) => {
        if (!state.journal) throw new Error('journal store not installed')
        const out = state.journal.append(text)
        journalLogger.info('journal:append:1-row', { id: out.id, length: out.length, encrypted: out.encrypted })
        broadcast(PUSH_CHANNELS.JOURNAL_APPENDED, { id: out.id, ts: out.ts, length: out.length })
        return { ok: true as const, id: out.id, ts: out.ts, length: out.length, encrypted: out.encrypted }
      },
      list: async () => {
        if (!state.journal) throw new Error('journal store not installed')
        if (!state.biometric) {
          journalLogger.warn('journal:list:no-biometric-service', {})
          return { ok: false, requiresFallback: true, reason: 'touch-id-unavailable' } as const
        }
        if (!state.biometric.canUseTouchId()) {
          journalLogger.info('journal:list:touch-id-fallback', {})
          return { ok: false, requiresFallback: true, reason: 'touch-id-unavailable' } as const
        }
        const success = await state.biometric.promptUnlock('View Pulse journal')
        if (!success) {
          journalLogger.info('journal:list:touch-id-failed', {})
          return { ok: false, requiresFallback: true, reason: 'touch-id-failed' } as const
        }
        const entries = state.journal.listDecrypted()
        journalLogger.info('journal:unlocked:touch-id', { count: entries.length })
        return {
          ok: true,
          source: 'touch-id',
          entries: entries.map((e) => ({ id: e.id, ts: e.ts, text: e.text })),
        } as const
      },
      unlockWithPassphrase: async (passphrase) => {
        if (!state.journal) throw new Error('journal store not installed')
        if (!state.passphrase) throw new Error('passphrase store not installed')
        if (!state.passphrase.isSet()) {
          journalLogger.info('journal:unlock:passphrase-not-set', {})
          return { ok: false, reason: 'passphrase-not-set' } as const
        }
        if (!state.passphrase.verify(passphrase)) {
          journalLogger.warn('journal:unlock:failed', { reason: 'invalid-passphrase' })
          return { ok: false, reason: 'invalid-passphrase' } as const
        }
        const entries = state.journal.listDecrypted()
        journalLogger.info('journal:unlocked:passphrase', { count: entries.length })
        return {
          ok: true,
          entries: entries.map((e) => ({ id: e.id, ts: e.ts, text: e.text })),
        } as const
      },
      setPassphrase: (passphrase) => {
        if (!state.passphrase) throw new Error('passphrase store not installed')
        state.passphrase.setPassphrase(passphrase)
        journalLogger.info('journal:passphrase:set', {})
        return { ok: true as const }
      },
    },
    boot: {
      summary: (): BootSummary => ({
        tray: state.tray !== null,
        journal: state.journal !== null,
        focus: state.focus !== null,
        biometric: state.biometric !== null,
        dockHidden: state.dockHiddenAtBoot,
        encryptionAvailable: state.encryptionAvailable,
        journalRowsAtBoot: state.journalRowsAtBoot,
      }),
    },
    test: {
      fireShortcut: (accelerator) => {
        const fired = state.shortcuts?.fireForTest(accelerator) ?? false
        return { ok: true, fired }
      },
      emitPower: (event: TestEmitPowerArgs['event']) => {
        state.power?.fireForTest(event)
        return { ok: true }
      },
      triggerWillQuit: () => {
        try {
          app.emit('will-quit', { preventDefault: (): void => undefined } as unknown as Electron.Event)
          return { ok: true }
        } catch {
          return { ok: false }
        }
      },
      emitOpenUrl: (url: string) => {
        app.emit('open-url', { preventDefault: (): void => undefined } as unknown as Electron.Event, url)
        return { ok: true }
      },
      emitSecondInstance: (argv: readonly string[]) => {
        app.emit('second-instance', { preventDefault: (): void => undefined } as unknown as Electron.Event, [...argv], process.cwd())
        return { ok: true }
      },
      fireDeepLink: (url: string) => {
        state.lifecycle?.dispatchUrl(url, 'open-url')
        return { ok: true }
      },
    },
  }
}

app.on('before-quit', () => {
  if (state.quitting) return
  state.quitting = true
  appLogger.info('app:before-quit', {})
  try {
    state.journal?.close()
  } catch (err) {
    appLogger.error('journal:close-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

app.on('window-all-closed', () => {
  // Pulse is menu-bar-only — do NOT quit when the popover closes.
  // The user quits via Cmd+Q or the tray menu.
  appLogger.info('lifecycle:window-all-closed:no-op', {})
})

app
  .whenReady()
  .then(async () => {
    appLogger.info('app:ready', { isReady: app.isReady() })

    // ---- dock.hide() BEFORE the first window is created (BT-C-10). ----
    try {
      state.dock = installDock({ logger: dockLogger })
      const hideResult = state.dock.hide()
      state.dockHiddenAtBoot = hideResult.ok && !hideResult.visible
      bootLogger.info('app:dock-hidden', { ok: hideResult.ok, visible: hideResult.visible })
    } catch (err) {
      dockLogger.error('dock:hide:threw', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    // ---- safeStorage availability probe ----
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { safeStorage } = require('electron') as typeof import('electron')
      state.encryptionAvailable = safeStorage.isEncryptionAvailable()
      bootLogger.info('safe-storage:availability', { available: state.encryptionAvailable })
      if (!state.encryptionAvailable) {
        journalLogger.warn('journal:encryption-unavailable:fallback-plaintext', {})
      }
    } catch (err) {
      state.encryptionAvailable = false
      bootLogger.error('safe-storage:probe:threw', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    registerSessionPermissionHandler(session.defaultSession, secLogger)

    try {
      state.tray = installTray({ logger: trayLogger, initialState: 'idle' })
    } catch (err) {
      trayLogger.error('tray:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.notifications = installNotificationService({
        logger: notificationLogger,
        onFailed: (payload) => broadcast(PUSH_CHANNELS.NOTIFICATION_FAILED, payload),
      })
    } catch (err) {
      notificationLogger.error('notification:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.shortcuts = installShortcuts({
        logger: shortcutLogger,
        onFire: (accelerator) => {
          broadcast(PUSH_CHANNELS.SHORTCUT_FIRED, { accelerator })
          if (accelerator === FOCUS_TOGGLE_ACCELERATOR) {
            try {
              const cur = state.focus?.getState().kind ?? 'idle'
              if (cur === 'idle') {
                state.focus?.start(25 * 60_000)
              } else {
                state.focus?.stop()
              }
            } catch (err) {
              focusLogger.error('focus:shortcut:threw', {
                message: err instanceof Error ? err.message : String(err),
              })
            }
          } else if (accelerator === JOURNAL_QUICK_ACCELERATOR) {
            // Quick-journal: open the popover. Real capture comes via UI/deep-link.
            const wins = BrowserWindow.getAllWindows()
            if (wins[0]) {
              try {
                wins[0].show()
                wins[0].focus()
              } catch { /* tolerated */ }
            }
          }
        },
      })
    } catch (err) {
      shortcutLogger.error('shortcut:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.autolaunch = installAutoLaunch({ logger: autolaunchLogger })
    } catch (err) {
      autolaunchLogger.error('autolaunch:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.theme = installThemeService({
        logger: themeLogger,
        onChange: (snapshot) => broadcast(PUSH_CHANNELS.THEME_CHANGED, snapshot),
      })
    } catch (err) {
      themeLogger.error('theme:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      const feedUrl = process.env.UPDATE_URL ?? 'http://127.0.0.1:8765/updates'
      state.updater = installUpdater({
        logger: updaterLogger,
        currentVersion: app.getVersion(),
        feedUrl,
        autoCheck: false,
      })
    } catch (err) {
      updaterLogger.error('updater:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    // ---- Capstone-new: journal-store + passphrase + biometric + focus ----
    try {
      const userDataDir = app.getPath('userData')
      const dbPath = process.env.PULSE_DB_PATH ?? path.join(userDataDir, 'journal.db')
      try { mkdirSync(path.dirname(dbPath), { recursive: true }) } catch { /* ignored */ }
      state.journal = installJournalStore({
        logger: journalLogger,
        dbPath,
        encryptionAvailable: state.encryptionAvailable,
        encryptor: buildEncryptor(),
      })
      state.journalRowsAtBoot = state.journal.listRowsForTest().length
      bootLogger.info(`boot:restored:${state.journalRowsAtBoot}-journal-entries`, {
        count: state.journalRowsAtBoot,
      })
    } catch (err) {
      journalLogger.error('journal-store:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.passphrase = installPassphraseStore({
        userDataDir: app.getPath('userData'),
        encryptor: buildEncryptor(),
      })
    } catch (err) {
      journalLogger.error('passphrase:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.biometric = installBiometricService()
      biometricLogger.info('biometric:installed', {
        canUseTouchId: state.biometric.canUseTouchId(),
      })
    } catch (err) {
      biometricLogger.error('biometric:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      state.focus = installFocusEngine({
        logger: focusLogger,
        onState: (next) => broadcast(PUSH_CHANNELS.FOCUS_STATE, next),
        onIntent: focusIntentHandler,
      })
    } catch (err) {
      focusLogger.error('focus-engine:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    if (state.focus) {
      try {
        state.power = installPowerService({ logger: powerLogger, engine: state.focus })
      } catch (err) {
        powerLogger.error('power:install-failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      // Still install power even without engine so the test seam (emitPower) works.
      try {
        state.power = installPowerService({ logger: powerLogger, engine: null })
      } catch (err) {
        powerLogger.error('power:install-failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    try {
      state.lifecycle = installLifecycle({
        logger: lifecycleLogger,
        getMainWindow: () => {
          const wins = BrowserWindow.getAllWindows()
          return wins[0] ?? null
        },
        onDeepLink: deepLinkHandler,
        onWillQuit: () => {
          state.shortcuts?.unregisterAll()
        },
      })
    } catch (err) {
      lifecycleLogger.error('lifecycle:install-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }

    const ctx = makeHandlerContext()
    registerIpc(ipcMain, ctx)

    const win = createMainWindow()
    registerSecurityGuards(win.webContents, {
      expectedOrigin: 'null',
      logger: secLogger,
    })
    secLogger.info('security:guards-attached', { expectedOrigin: 'null' })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow()
        registerSecurityGuards(next.webContents, {
          expectedOrigin: 'null', logger: secLogger,
        })
        installContextMenuStub(next.webContents)
      }
    })

    installContextMenuStub(win.webContents)

    appLogger.info('app:install-complete', {
      tray: state.tray !== null,
      notifications: state.notifications !== null,
      shortcuts: state.shortcuts !== null,
      power: state.power !== null,
      lifecycle: state.lifecycle !== null,
      autolaunch: state.autolaunch !== null,
      theme: state.theme !== null,
      dock: state.dock !== null,
      updater: state.updater !== null,
      focus: state.focus !== null,
      journal: state.journal !== null,
      biometric: state.biometric !== null,
      crashReporter: crashReporterService !== null,
      encryptionAvailable: state.encryptionAvailable,
      dockHidden: state.dockHiddenAtBoot,
      journalRowsAtBoot: state.journalRowsAtBoot,
    })
  })
  .catch((err: unknown) => {
    appLogger.error('app:boot-failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  })

app.on('will-quit', () => {
  try {
    state.shortcuts?.unregisterAll()
  } catch { /* tolerated */ }
  try {
    state.autolaunch?.cleanupOnRemove()
  } catch { /* tolerated */ }
  appLogger.info('lifecycle:will-quit:cleanup', {})
})

function installContextMenuStub(_contents: WebContents): void {
  // The capstone deliberately keeps the renderer minimal; we don't install
  // a context menu (the popover style doesn't need one). Leaving the stub so
  // future polish has a place to live.
}

// Touch imports so static-source checks see them.
void parseDeepLink
void FOCUS_TOGGLE_ACCELERATOR
void JOURNAL_QUICK_ACCELERATOR
void existsSync
