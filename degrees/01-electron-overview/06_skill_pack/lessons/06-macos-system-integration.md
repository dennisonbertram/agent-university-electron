# Lesson 06 — macOS System Integration

**Prerequisites**: [07-app-lifecycle-and-single-instance.md](./07-app-lifecycle-and-single-instance.md)  
**Next**: [08-packaging-with-electron-forge.md](./08-packaging-with-electron-forge.md)

## Capability Map: What Works Unsigned vs. Signed

| Capability | API | Unsigned Dev? | Signed Packaged? |
|---|---|:---:|:---:|
| Tray icon | `Tray`, `nativeImage` | YES (title fallback) | YES |
| Context menu | `Menu.buildFromTemplate` | YES | YES |
| Notifications (basic) | `new Notification(...)` | NO — silent fail | YES |
| Notification actions | `Notification({ actions })` | NO | YES |
| globalShortcut | `globalShortcut.register` | YES | YES |
| Custom URL scheme (`open-url`) | `setAsDefaultProtocolClient` | NO | YES |
| `second-instance` (Win/Linux) | `requestSingleInstanceLock` | YES | YES |
| powerMonitor events | `powerMonitor.on('suspend')` | YES | YES |
| Auto-launch round-trip | `app.setLoginItemSettings` | Flaky macOS 13+ | YES |
| Touch ID | `systemPreferences.promptTouchID` | Hangs without enrolled finger | YES |
| Dock badge/hide | `app.dock.setBadge` / `hide()` | YES | YES |
| nativeTheme | `nativeTheme.on('updated')` | YES | YES |

## Tray

The tray icon lives in the macOS menu bar. Critical rule: **the Tray instance must live at module scope** — if it's a function-local variable, V8 GC collects it within seconds and the icon disappears with no error (G-06).

```typescript
// src/tray.ts
import { Tray, nativeImage } from 'electron'

// MUST be module scope — not function local
let trayInstance: Tray | null = null

export function installTray(opts: { logger: Logger }): TrayController {
  const icon = nativeImage.createFromPath(
    path.join(process.resourcesPath ?? __dirname, 'assets', 'tray-idle-Template.png')
  )
  trayInstance = new Tray(icon)
  trayInstance.setToolTip('My App')

  return {
    setState(state: string) { /* update menu or image */ },
    destroy() {
      trayInstance?.destroy()
      trayInstance = null
    },
  }
}
```

Template images: name the asset `iconTemplate.png` (and `iconTemplate@2x.png` for retina). macOS inverts template images for dark/light mode automatically. The bundler MUST preserve the `Template` suffix — do not hash filenames.

## Notifications

Three hard rules:
1. Notifications fail silently on unsigned dev macOS. The `failed` event is the only observable.
2. Wire the `failed` listener BEFORE calling `.show()` — it can fire before show() returns on a slow OS.
3. Action buttons require a signed build on macOS 12+.

```typescript
export function showNotification(title: string, body: string): Promise<void> {
  return new Promise((resolve) => {
    const n = new Notification({ title, body })
    // CRITICAL ORDER: failed BEFORE show()
    n.on('failed', (_event, error) => {
      logger.warn('notification:failed', { error })
      resolve()
    })
    n.on('show', () => {
      logger.info('notification:shown', {})
      resolve()
    })
    n.show()
  })
}
```

For test coverage without a signed build, use an IPC test seam that calls the notification handler logic directly.

## Global Shortcuts

```typescript
import { app, globalShortcut } from 'electron'

export function installShortcuts(opts: { logger: Logger }) {
  const registered = globalShortcut.register('CmdOrCtrl+Shift+P', () => {
    opts.logger.info('shortcut:CmdOrCtrl+Shift+P:fired', {})
  })
  if (!registered) {
    opts.logger.warn('shortcut:register:failed', { accelerator: 'CmdOrCtrl+Shift+P' })
  }

  // MANDATORY: unregister on quit — or shortcuts stay reserved across restarts
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    opts.logger.info('shortcut:cleanup:will-quit', {})
  })
}
```

`globalShortcut.register` returns `false` if the accelerator is already claimed by another app or OS. Always check the return value and log it — there is no error thrown.

## powerMonitor

```typescript
import { powerMonitor } from 'electron'

powerMonitor.on('suspend', () => {
  logger.info('power:suspend:observed', {})
  // Pause timers, flush buffers
})
powerMonitor.on('resume', () => {
  logger.info('power:resume:observed', {})
  // Restart timers
})
powerMonitor.on('lock-screen', () => { /* ... */ })
powerMonitor.on('unlock-screen', () => { /* ... */ })
```

`powerMonitor` must be accessed AFTER `app.whenReady()`. Cannot be used at module-load scope.

For testing, register a test IPC channel that calls `powerMonitor.emit(eventName)` — real Playwright tests can't trigger OS sleep events.

## Deep Links

Custom URL scheme (`pulse://action?param=value`) routing. Three setup steps all required:

**1. Register at module scope (before `whenReady`)**:
```typescript
app.setAsDefaultProtocolClient('pulse')
app.on('open-url', (event, url) => {
  event.preventDefault()
  routeDeepLink(url)  // forward to router
})
```

**2. Parse strictly**:
```typescript
export function parseDeepLink(raw: string): { action: string; params: Record<string, string> } | null {
  if (!raw.startsWith('pulse://')) return null
  const url = new URL(raw)
  const action = url.hostname
  if (!action || !/^[a-z0-9][a-z0-9._-]*$/i.test(action)) return null
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })
  return { action, params }
}
```

**3. Declare in packager** (packaging REQUIRED for macOS `open-url` to fire):
```typescript
// forge.config.ts
packagerConfig: {
  protocols: [{ name: 'My App', schemes: ['pulse'] }],
}
```

GOTCHA (G-09): `packagerConfig.protocols` OVERRIDES `extendInfo.CFBundleURLTypes` — Forge does not merge them. Use one or the other, not both.

Testing deep links without packaging: use programmatic emission:
```typescript
app.emit('open-url', new Event('open-url'), 'pulse://start?duration=5')
```

## Dock Integration

```typescript
// app.dock.hide() BEFORE first BrowserWindow to avoid flash
app.dock.hide()

// Or for menu-bar-only apps, add to Info.plist / extendInfo:
// { LSUIElement: true }  — hides dock icon permanently
```

Dock badge:
```typescript
app.dock.setBadge('3')  // empty string clears it
```

## Auto-Launch

```typescript
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,  // launch without visible window
})

// Read current state:
const settings = app.getLoginItemSettings()
settings.openAtLogin  // boolean
```

Non-deterministic on unsigned dev on macOS 13+ (G-05). Assert the request side in tests; verify the round-trip only on a signed packaged build.

## nativeTheme

```typescript
import { nativeTheme } from 'electron'

nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors
  // Update tray icon, CSS variables, etc.
})

// Force theme for testing:
nativeTheme.themeSource = 'dark' | 'light' | 'system'
```

## Touch ID

```typescript
import { systemPreferences } from 'electron'

export function canUseTouchId(): boolean {
  if (process.env.TOUCH_ID_UNAVAILABLE === '1') return false
  if (process.env.TOUCH_ID_FORCE_AVAILABLE === '1') return true
  try { return systemPreferences.canPromptTouchID() } catch { return false }
}

export async function promptTouchId(reason: string): Promise<boolean> {
  if (!canUseTouchId()) return false
  try {
    await systemPreferences.promptTouchID(reason)
    return true
  } catch {
    return false
  }
}
```

Requires entitlement `com.apple.security.cs.disable-library-validation: true` in a signed build. Env-flag seams (`TOUCH_ID_FORCE_AVAILABLE`, `TOUCH_ID_UNAVAILABLE`) control test branches.

## Key Takeaways

1. Tray reference must be module-scope — function-local is GC'd.
2. Notifications fail silently unsigned — `failed` listener before `.show()` always.
3. Deep links require packaging on macOS — test with programmatic emission in dev.
4. `globalShortcut.register` can return false (conflict) — check it; unregister in `will-quit`.
5. `packagerConfig.protocols` and `extendInfo.CFBundleURLTypes` do not merge — use one.
6. `powerMonitor` is available only after `whenReady`.

Evidence: `../../05_distillation/patterns/P-05-module-scoped-tray-instance.md`, `../../05_distillation/patterns/P-09-notification-always-attach-failed-listener.md`, `../../05_distillation/patterns/P-10-globalshortcut-register-and-will-quit-unregister.md`, `../../05_distillation/patterns/P-11-deep-link-router-via-protocol-and-second-instance.md`, `../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`
