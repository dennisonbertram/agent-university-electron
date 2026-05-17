/**
 * IPC argument validators + IpcValidationError class — Pulse capstone.
 *
 * Extends L5 with focus + journal-encrypted + new test seams:
 *   - focus:start         { durationMs }
 *   - focus:stop          {}
 *   - focus:state         {}
 *   - focus:extend        { bonusMs }
 *   - journal:append      { text }            (text-length cap: 10_000 per R-C-6)
 *   - journal:list        {}
 *   - journal:unlock-with-passphrase { passphrase }  (cap: 4_096 chars)
 *   - journal:set-passphrase         { passphrase }
 *   - test:advance-clock             { toMs }
 *   - test:trigger-notification-action { id, actionIndex }
 *   - test:fire-deep-link            { url }
 */

export class IpcValidationError extends Error {
  override readonly name = 'IpcValidationError' as const
  constructor(message: string) {
    super(message)
  }
}

export type Validator<T> = (value: unknown) => T

// ---- carry-forward shapes from L5 (used by L5 channels that remain) ----

export type TrayStateName = 'idle' | 'focus' | 'break' | 'paused'

export interface TraySetStateArgs {
  readonly state: TrayStateName
}

export interface NotificationButton {
  readonly type: 'button'
  readonly text: string
}

export interface NotificationShowArgs {
  readonly title: string
  readonly body: string
  readonly actions?: readonly NotificationButton[]
  readonly hasReply?: boolean
  readonly replyPlaceholder?: string
}

export interface AppSetAutoLaunchArgs {
  readonly enabled: boolean
}

export type ThemeSource = 'system' | 'light' | 'dark'

export interface AppSetThemeArgs {
  readonly source: ThemeSource
}

export interface DockSetBadgeArgs {
  readonly badge: string
}

export interface AppAddRecentArgs {
  readonly filePath: string
}

export interface TestFireShortcutArgs {
  readonly accelerator: string
}

export type PowerEvent =
  | 'suspend'
  | 'resume'
  | 'lock-screen'
  | 'unlock-screen'
  | 'on-ac'
  | 'on-battery'

export interface TestEmitPowerArgs {
  readonly event: PowerEvent
}

export interface TestEmitOpenUrlArgs {
  readonly url: string
}

export interface TestEmitSecondInstanceArgs {
  readonly argv: readonly string[]
}

// ---- new at capstone ----

export interface FocusStartArgs {
  readonly durationMs: number
}

export interface FocusExtendArgs {
  readonly bonusMs: number
}

export interface JournalAppendArgs {
  readonly text: string
}

export interface JournalUnlockArgs {
  readonly passphrase: string
}

export interface JournalSetPassphraseArgs {
  readonly passphrase: string
}

export interface TestAdvanceClockArgs {
  readonly toMs: number
}

export interface TestTriggerNotificationActionArgs {
  readonly id: string
  readonly actionIndex: number
}

export interface TestFireDeepLinkArgs {
  readonly url: string
}

export const JOURNAL_TEXT_MAX = 10_000
export const PASSPHRASE_MAX = 4_096

export interface Validators {
  ping: Validator<void>
  echo: Validator<unknown>
  // L4-carry
  traySetState: Validator<TraySetStateArgs>
  appGetTrayState: Validator<void>
  notificationShow: Validator<NotificationShowArgs>
  appSetAutoLaunch: Validator<AppSetAutoLaunchArgs>
  appGetAutoLaunch: Validator<void>
  appSetTheme: Validator<AppSetThemeArgs>
  appGetTheme: Validator<void>
  dockSetBadge: Validator<DockSetBadgeArgs>
  appAddRecent: Validator<AppAddRecentArgs>
  testFireShortcut: Validator<TestFireShortcutArgs>
  testEmitPower: Validator<TestEmitPowerArgs>
  testTriggerWillQuit: Validator<void>
  testEmitOpenUrl: Validator<TestEmitOpenUrlArgs>
  testEmitSecondInstance: Validator<TestEmitSecondInstanceArgs>
  // L5-carry
  testCheckForUpdates: Validator<void>
  testGetUpdaterState: Validator<void>
  testGetCrashReporterState: Validator<void>
  // Capstone new
  focusStart: Validator<FocusStartArgs>
  focusStop: Validator<void>
  focusState: Validator<void>
  focusExtend: Validator<FocusExtendArgs>
  journalAppend: Validator<JournalAppendArgs>
  journalList: Validator<void>
  journalUnlockWithPassphrase: Validator<JournalUnlockArgs>
  journalSetPassphrase: Validator<JournalSetPassphraseArgs>
  testAdvanceClock: Validator<TestAdvanceClockArgs>
  testTriggerNotificationAction: Validator<TestTriggerNotificationActionArgs>
  testFireDeepLink: Validator<TestFireDeepLinkArgs>
}

const TRAY_STATES = new Set<TrayStateName>(['idle', 'focus', 'break', 'paused'])
const THEME_SOURCES = new Set<ThemeSource>(['system', 'light', 'dark'])
const POWER_EVENTS = new Set<PowerEvent>([
  'suspend', 'resume', 'lock-screen', 'unlock-screen', 'on-ac', 'on-battery',
])

function asObj(value: unknown, channel: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new IpcValidationError(`${channel}: expected object payload, got ${value === null ? 'null' : typeof value}`)
  }
  return value as Record<string, unknown>
}

export const validators: Validators = {
  ping: (): void => {
    // permissive
  },
  echo: (value: unknown): unknown => {
    if (typeof value === 'undefined') {
      throw new IpcValidationError('echo: value must be defined')
    }
    return value
  },
  traySetState: (value): TraySetStateArgs => {
    const obj = asObj(value, 'tray:set-state')
    if (typeof obj.state !== 'string' || !TRAY_STATES.has(obj.state as TrayStateName)) {
      throw new IpcValidationError(`tray:set-state: unknown state "${String(obj.state)}"`)
    }
    return { state: obj.state as TrayStateName }
  },
  appGetTrayState: (): void => {},
  notificationShow: (value): NotificationShowArgs => {
    const obj = asObj(value, 'notification:show')
    if (typeof obj.title !== 'string' || obj.title.length === 0) {
      throw new IpcValidationError('notification:show: field "title" must be a non-empty string')
    }
    if (typeof obj.body !== 'string') {
      throw new IpcValidationError('notification:show: field "body" must be a string')
    }
    const out: {
      title: string
      body: string
      actions?: readonly NotificationButton[]
      hasReply?: boolean
      replyPlaceholder?: string
    } = { title: obj.title, body: obj.body }
    if (obj.actions !== undefined) {
      if (!Array.isArray(obj.actions)) {
        throw new IpcValidationError('notification:show: actions must be an array')
      }
      const parsed: NotificationButton[] = []
      for (const entry of obj.actions) {
        if (typeof entry !== 'object' || entry === null) {
          throw new IpcValidationError('notification:show: each action must be an object')
        }
        const a = entry as Record<string, unknown>
        if (a.type !== 'button') {
          throw new IpcValidationError('notification:show: action.type must be "button"')
        }
        if (typeof a.text !== 'string' || a.text.length === 0) {
          throw new IpcValidationError('notification:show: action.text must be a non-empty string')
        }
        parsed.push({ type: 'button', text: a.text })
      }
      out.actions = parsed
    }
    if (obj.hasReply !== undefined) {
      if (typeof obj.hasReply !== 'boolean') {
        throw new IpcValidationError('notification:show: hasReply must be a boolean')
      }
      out.hasReply = obj.hasReply
    }
    if (obj.replyPlaceholder !== undefined) {
      if (typeof obj.replyPlaceholder !== 'string') {
        throw new IpcValidationError('notification:show: replyPlaceholder must be a string')
      }
      out.replyPlaceholder = obj.replyPlaceholder
    }
    return out
  },
  appSetAutoLaunch: (value): AppSetAutoLaunchArgs => {
    const obj = asObj(value, 'app:set-autolaunch')
    if (typeof obj.enabled !== 'boolean') {
      throw new IpcValidationError('app:set-autolaunch: field "enabled" must be a boolean')
    }
    return { enabled: obj.enabled }
  },
  appGetAutoLaunch: (): void => {},
  appSetTheme: (value): AppSetThemeArgs => {
    const obj = asObj(value, 'app:set-theme')
    if (typeof obj.source !== 'string' || !THEME_SOURCES.has(obj.source as ThemeSource)) {
      throw new IpcValidationError(`app:set-theme: unknown source "${String(obj.source)}"`)
    }
    return { source: obj.source as ThemeSource }
  },
  appGetTheme: (): void => {},
  dockSetBadge: (value): DockSetBadgeArgs => {
    const obj = asObj(value, 'dock:set-badge')
    if (typeof obj.badge !== 'string') {
      throw new IpcValidationError('dock:set-badge: field "badge" must be a string')
    }
    return { badge: obj.badge }
  },
  appAddRecent: (value): AppAddRecentArgs => {
    const obj = asObj(value, 'app:add-recent')
    if (typeof obj.filePath !== 'string' || obj.filePath.length === 0) {
      throw new IpcValidationError('app:add-recent: field "filePath" must be a non-empty string')
    }
    return { filePath: obj.filePath }
  },
  testFireShortcut: (value): TestFireShortcutArgs => {
    const obj = asObj(value, 'test:fire-shortcut')
    if (typeof obj.accelerator !== 'string' || obj.accelerator.length === 0) {
      throw new IpcValidationError('test:fire-shortcut: field "accelerator" must be a non-empty string')
    }
    return { accelerator: obj.accelerator }
  },
  testEmitPower: (value): TestEmitPowerArgs => {
    const obj = asObj(value, 'test:emit-power-event')
    if (typeof obj.event !== 'string' || !POWER_EVENTS.has(obj.event as PowerEvent)) {
      throw new IpcValidationError(`test:emit-power-event: unknown event "${String(obj.event)}"`)
    }
    return { event: obj.event as PowerEvent }
  },
  testTriggerWillQuit: (): void => {},
  testEmitOpenUrl: (value): TestEmitOpenUrlArgs => {
    const obj = asObj(value, 'test:emit-open-url')
    if (typeof obj.url !== 'string' || obj.url.length === 0) {
      throw new IpcValidationError('test:emit-open-url: field "url" must be a non-empty string')
    }
    return { url: obj.url }
  },
  testEmitSecondInstance: (value): TestEmitSecondInstanceArgs => {
    const obj = asObj(value, 'test:emit-second-instance')
    if (!Array.isArray(obj.argv)) {
      throw new IpcValidationError('test:emit-second-instance: field "argv" must be an array')
    }
    for (const a of obj.argv) {
      if (typeof a !== 'string') {
        throw new IpcValidationError('test:emit-second-instance: every argv entry must be a string')
      }
    }
    return { argv: [...(obj.argv as readonly string[])] }
  },
  testCheckForUpdates: (): void => {},
  testGetUpdaterState: (): void => {},
  testGetCrashReporterState: (): void => {},
  // ---- capstone new ----
  focusStart: (value): FocusStartArgs => {
    const obj = asObj(value, 'focus:start')
    if (typeof obj.durationMs !== 'number' || !Number.isFinite(obj.durationMs) || obj.durationMs <= 0) {
      throw new IpcValidationError('focus:start: durationMs must be a positive finite number')
    }
    if (obj.durationMs > 24 * 60 * 60 * 1000) {
      throw new IpcValidationError('focus:start: durationMs exceeds 24h cap')
    }
    return { durationMs: obj.durationMs }
  },
  focusStop: (): void => {},
  focusState: (): void => {},
  focusExtend: (value): FocusExtendArgs => {
    const obj = asObj(value, 'focus:extend')
    if (typeof obj.bonusMs !== 'number' || !Number.isFinite(obj.bonusMs) || obj.bonusMs <= 0) {
      throw new IpcValidationError('focus:extend: bonusMs must be a positive finite number')
    }
    if (obj.bonusMs > 60 * 60 * 1000) {
      throw new IpcValidationError('focus:extend: bonusMs exceeds 60min cap')
    }
    return { bonusMs: obj.bonusMs }
  },
  journalAppend: (value): JournalAppendArgs => {
    const obj = asObj(value, 'journal:append')
    if (typeof obj.text !== 'string') {
      throw new IpcValidationError('journal:append: text must be a string')
    }
    if (obj.text.length === 0) {
      throw new IpcValidationError('journal:append: text must be non-empty')
    }
    if (obj.text.length > JOURNAL_TEXT_MAX) {
      throw new IpcValidationError(`journal:append: text length ${obj.text.length} exceeds cap ${JOURNAL_TEXT_MAX} (R-C-6)`)
    }
    return { text: obj.text }
  },
  journalList: (): void => {},
  journalUnlockWithPassphrase: (value): JournalUnlockArgs => {
    const obj = asObj(value, 'journal:unlock-with-passphrase')
    if (typeof obj.passphrase !== 'string') {
      throw new IpcValidationError('journal:unlock-with-passphrase: passphrase must be a string')
    }
    if (obj.passphrase.length === 0) {
      throw new IpcValidationError('journal:unlock-with-passphrase: passphrase must be non-empty')
    }
    if (obj.passphrase.length > PASSPHRASE_MAX) {
      throw new IpcValidationError(`journal:unlock-with-passphrase: passphrase length ${obj.passphrase.length} exceeds cap ${PASSPHRASE_MAX} (R-C-6)`)
    }
    return { passphrase: obj.passphrase }
  },
  journalSetPassphrase: (value): JournalSetPassphraseArgs => {
    const obj = asObj(value, 'journal:set-passphrase')
    if (typeof obj.passphrase !== 'string') {
      throw new IpcValidationError('journal:set-passphrase: passphrase must be a string')
    }
    if (obj.passphrase.length < 4) {
      throw new IpcValidationError('journal:set-passphrase: passphrase must be at least 4 chars')
    }
    if (obj.passphrase.length > PASSPHRASE_MAX) {
      throw new IpcValidationError(`journal:set-passphrase: passphrase length ${obj.passphrase.length} exceeds cap ${PASSPHRASE_MAX}`)
    }
    return { passphrase: obj.passphrase }
  },
  testAdvanceClock: (value): TestAdvanceClockArgs => {
    const obj = asObj(value, 'test:advance-clock')
    if (typeof obj.toMs !== 'number' || !Number.isFinite(obj.toMs) || obj.toMs < 0) {
      throw new IpcValidationError('test:advance-clock: toMs must be a non-negative finite number')
    }
    return { toMs: obj.toMs }
  },
  testTriggerNotificationAction: (value): TestTriggerNotificationActionArgs => {
    const obj = asObj(value, 'test:trigger-notification-action')
    if (typeof obj.id !== 'string' || obj.id.length === 0) {
      throw new IpcValidationError('test:trigger-notification-action: id must be a non-empty string')
    }
    if (typeof obj.actionIndex !== 'number' || !Number.isInteger(obj.actionIndex) || obj.actionIndex < 0) {
      throw new IpcValidationError('test:trigger-notification-action: actionIndex must be a non-negative integer')
    }
    return { id: obj.id, actionIndex: obj.actionIndex }
  },
  testFireDeepLink: (value): TestFireDeepLinkArgs => {
    const obj = asObj(value, 'test:fire-deep-link')
    if (typeof obj.url !== 'string' || obj.url.length === 0) {
      throw new IpcValidationError('test:fire-deep-link: url must be a non-empty string')
    }
    return { url: obj.url }
  },
}
