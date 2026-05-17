/**
 * IPC argument validators + IpcValidationError class. Extended from L3.
 *
 * New validators at L4:
 *   - traySetState:        { state: 'idle' | 'focused' | 'break' | 'paused' }
 *   - appGetTrayState:     no args
 *   - notificationShow:    { title: string, body: string, actions?: NotificationButton[],
 *                            hasReply?: boolean, replyPlaceholder?: string }
 *   - appSetAutoLaunch:    { enabled: boolean }
 *   - appGetAutoLaunch:    no args
 *   - appSetTheme:         { source: 'system' | 'light' | 'dark' }
 *   - appGetTheme:         no args
 *   - dockSetBadge:        { badge: string }
 *   - appAddRecent:        { filePath: string }
 *   - testFireShortcut:    { accelerator: string }
 *   - testEmitPower:       { event: PowerEvent }
 *   - testTriggerWillQuit: no args
 *   - testEmitOpenUrl:     { url: string }
 *   - testEmitSecondInstance: { argv: readonly string[] }
 */

export class IpcValidationError extends Error {
  override readonly name = 'IpcValidationError' as const
  constructor(message: string) {
    super(message)
  }
}

export type Validator<T> = (value: unknown) => T

export interface DialogFilter {
  readonly name: string
  readonly extensions: readonly string[]
}

export interface DialogOpenArgs {
  readonly defaultPath?: string
  readonly filters?: readonly DialogFilter[]
  readonly properties?: readonly string[]
}

export interface DialogSaveArgs {
  readonly defaultPath?: string
  readonly filters?: readonly DialogFilter[]
}

export type TrayStateName = 'idle' | 'focused' | 'break' | 'paused'

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

export interface Validators {
  ping: Validator<void>
  echo: Validator<unknown>
  journalAppend: Validator<{ text: string }>
  journalList: Validator<void>
  dialogOpen: Validator<DialogOpenArgs>
  dialogSave: Validator<DialogSaveArgs>
  filesDropped: Validator<readonly string[]>
  appGetMenu: Validator<void>
  // L4-new
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
}

function validateFilters(value: unknown, fieldName: string): readonly DialogFilter[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(`${fieldName}: filters must be an array`)
  }
  return value.map((entry, idx) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}] must be an object`)
    }
    const obj = entry as Record<string, unknown>
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}].name must be a non-empty string`)
    }
    if (!Array.isArray(obj.extensions)) {
      throw new IpcValidationError(`${fieldName}: filters[${idx}].extensions must be an array of strings`)
    }
    for (const ext of obj.extensions) {
      if (typeof ext !== 'string' || ext.length === 0) {
        throw new IpcValidationError(`${fieldName}: filters[${idx}].extensions must contain non-empty strings`)
      }
    }
    return { name: obj.name, extensions: [...(obj.extensions as readonly string[])] }
  })
}

const TRAY_STATES = new Set<TrayStateName>(['idle', 'focused', 'break', 'paused'])
const THEME_SOURCES = new Set<ThemeSource>(['system', 'light', 'dark'])
const POWER_EVENTS = new Set<PowerEvent>([
  'suspend',
  'resume',
  'lock-screen',
  'unlock-screen',
  'on-ac',
  'on-battery',
])

export const validators: Validators = {
  ping: (): void => {
    // Permissive — liveness probe.
  },

  echo: (value: unknown): unknown => {
    if (typeof value === 'undefined') {
      throw new IpcValidationError('echo: value must be defined')
    }
    return value
  },

  journalAppend: (value: unknown): { text: string } => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`journal:append: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (!('text' in obj)) {
      throw new IpcValidationError('journal:append: missing required field "text"')
    }
    if (typeof obj.text !== 'string') {
      throw new IpcValidationError(`journal:append: field "text" must be string, got ${typeof obj.text}`)
    }
    if (obj.text.length === 0) {
      throw new IpcValidationError('journal:append: field "text" must not be empty')
    }
    return { text: obj.text }
  },

  journalList: (): void => {
    // No args.
  },

  dialogOpen: (value: unknown): DialogOpenArgs => {
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object') {
      throw new IpcValidationError(`dialog:open: expected object payload, got ${typeof value}`)
    }
    const obj = value as Record<string, unknown>
    const out: { defaultPath?: string; filters?: readonly DialogFilter[]; properties?: readonly string[] } = {}
    if (obj.defaultPath !== undefined) {
      if (typeof obj.defaultPath !== 'string') {
        throw new IpcValidationError('dialog:open: defaultPath must be a string')
      }
      out.defaultPath = obj.defaultPath
    }
    if (obj.filters !== undefined) {
      out.filters = validateFilters(obj.filters, 'dialog:open')
    }
    if (obj.properties !== undefined) {
      if (!Array.isArray(obj.properties)) {
        throw new IpcValidationError('dialog:open: properties must be an array of strings')
      }
      for (const p of obj.properties) {
        if (typeof p !== 'string') {
          throw new IpcValidationError('dialog:open: properties must contain only strings')
        }
      }
      out.properties = [...(obj.properties as readonly string[])]
    }
    return out
  },

  dialogSave: (value: unknown): DialogSaveArgs => {
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object') {
      throw new IpcValidationError(`dialog:save: expected object payload, got ${typeof value}`)
    }
    const obj = value as Record<string, unknown>
    const out: { defaultPath?: string; filters?: readonly DialogFilter[] } = {}
    if (obj.defaultPath !== undefined) {
      if (typeof obj.defaultPath !== 'string') {
        throw new IpcValidationError('dialog:save: defaultPath must be a string')
      }
      out.defaultPath = obj.defaultPath
    }
    if (obj.filters !== undefined) {
      out.filters = validateFilters(obj.filters, 'dialog:save')
    }
    return out
  },

  filesDropped: (value: unknown): readonly string[] => {
    if (!Array.isArray(value)) {
      throw new IpcValidationError(`files:dropped: expected array of paths, got ${typeof value}`)
    }
    for (const p of value) {
      if (typeof p !== 'string') {
        throw new IpcValidationError('files:dropped: every path must be a string')
      }
      if (p.length === 0) {
        throw new IpcValidationError('files:dropped: paths must be non-empty strings')
      }
    }
    return [...(value as readonly string[])]
  },

  appGetMenu: (): void => {
    // No args.
  },

  traySetState: (value: unknown): TraySetStateArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`tray:set-state: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.state !== 'string') {
      throw new IpcValidationError('tray:set-state: field "state" must be a string')
    }
    if (!TRAY_STATES.has(obj.state as TrayStateName)) {
      throw new IpcValidationError(`tray:set-state: unknown state "${obj.state}"`)
    }
    return { state: obj.state as TrayStateName }
  },

  appGetTrayState: (): void => {
    // No args.
  },

  notificationShow: (value: unknown): NotificationShowArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`notification:show: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
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

  appSetAutoLaunch: (value: unknown): AppSetAutoLaunchArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`app:set-autolaunch: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.enabled !== 'boolean') {
      throw new IpcValidationError('app:set-autolaunch: field "enabled" must be a boolean')
    }
    return { enabled: obj.enabled }
  },

  appGetAutoLaunch: (): void => {
    // No args.
  },

  appSetTheme: (value: unknown): AppSetThemeArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`app:set-theme: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.source !== 'string' || !THEME_SOURCES.has(obj.source as ThemeSource)) {
      throw new IpcValidationError(`app:set-theme: unknown source "${String(obj.source)}"`)
    }
    return { source: obj.source as ThemeSource }
  },

  appGetTheme: (): void => {
    // No args.
  },

  dockSetBadge: (value: unknown): DockSetBadgeArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`dock:set-badge: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.badge !== 'string') {
      throw new IpcValidationError('dock:set-badge: field "badge" must be a string')
    }
    return { badge: obj.badge }
  },

  appAddRecent: (value: unknown): AppAddRecentArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`app:add-recent: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.filePath !== 'string' || obj.filePath.length === 0) {
      throw new IpcValidationError('app:add-recent: field "filePath" must be a non-empty string')
    }
    return { filePath: obj.filePath }
  },

  testFireShortcut: (value: unknown): TestFireShortcutArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`test:fire-shortcut: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.accelerator !== 'string' || obj.accelerator.length === 0) {
      throw new IpcValidationError('test:fire-shortcut: field "accelerator" must be a non-empty string')
    }
    return { accelerator: obj.accelerator }
  },

  testEmitPower: (value: unknown): TestEmitPowerArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`test:emit-power-event: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.event !== 'string' || !POWER_EVENTS.has(obj.event as PowerEvent)) {
      throw new IpcValidationError(`test:emit-power-event: unknown event "${String(obj.event)}"`)
    }
    return { event: obj.event as PowerEvent }
  },

  testTriggerWillQuit: (): void => {
    // No args.
  },

  testEmitOpenUrl: (value: unknown): TestEmitOpenUrlArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`test:emit-open-url: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.url !== 'string' || obj.url.length === 0) {
      throw new IpcValidationError('test:emit-open-url: field "url" must be a non-empty string')
    }
    return { url: obj.url }
  },

  testEmitSecondInstance: (value: unknown): TestEmitSecondInstanceArgs => {
    if (typeof value !== 'object' || value === null) {
      throw new IpcValidationError(`test:emit-second-instance: expected object payload, got ${value === null ? 'null' : typeof value}`)
    }
    const obj = value as Record<string, unknown>
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
}
