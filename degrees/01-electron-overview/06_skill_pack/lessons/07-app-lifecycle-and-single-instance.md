# Lesson 07 — App Lifecycle and Single Instance

**Prerequisites**: [03-ipc-patterns-and-validation.md](./03-ipc-patterns-and-validation.md)  
**Next**: [06-macos-system-integration.md](./06-macos-system-integration.md)

## The Boot Sequence

Electron's app lifecycle has a critical ordering constraint. Some operations MUST run synchronously at module-load scope — BEFORE `app.whenReady()`. Getting this order wrong silently breaks deep links, crash capture, and single-instance routing.

```
┌────────────────────────────────────────────────────────────────────┐
│ MODULE-LOAD SCOPE (synchronous)                                    │
│                                                                    │
│  1. crashReporter.start()      ← BEFORE any BrowserWindow         │
│  2. requestSingleInstanceLock()← BEFORE whenReady                 │
│  3. setAsDefaultProtocolClient()← BEFORE whenReady                │
│  4. app.on('open-url', ...)    ← BEFORE whenReady (cold launch)   │
│  5. app.on('second-instance',) ← BEFORE whenReady                 │
│                                                                    │
└──────────────────┬─────────────────────────────────────────────────┘
                   │ app.whenReady().then(...)
┌──────────────────▼─────────────────────────────────────────────────┐
│ WHEN READY (async)                                                 │
│                                                                    │
│  6. app.dock.hide()            ← BEFORE first BrowserWindow       │
│  7. Install services (tray, notifications, shortcuts, ...)        │
│  8. registerIpc(ipcMain, ctx)                                     │
│  9. createMainWindow()                                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## The Canonical main.ts Template

```typescript
// src/main.ts
import { app, ipcMain } from 'electron'
import { createLogger } from './log'
import { startCrashReporter } from './crash'
import { createMainWindow } from './window'
import { registerIpc } from './ipc'

// Bootstrap logger (available before app.getPath('logs'))
const logger = createLogger('main')

// ── STEP 1: crashReporter — BEFORE any window creation ──────────────
let crashService
try {
  crashService = startCrashReporter({
    logger,
    submitURL: process.env.CRASH_URL,
    productName: 'MyApp',
  })
} catch (err) {
  logger.error('crash-reporter:start-failed', { message: String(err) })
}

// ── STEP 2: Single instance lock ─────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // Second instance: quit immediately, first instance handles the request
  app.quit()
}

// ── STEP 3: Protocol client registration ─────────────────────────────
try {
  app.setAsDefaultProtocolClient('myapp')
} catch (err) {
  logger.error('protocol:register:failed', { message: String(err) })
}

// ── STEP 4 + 5: Pre-ready event listeners ────────────────────────────
app.on('open-url', (event, url) => {
  event.preventDefault()
  // Store URL for after-ready routing
  state.pendingUrl = url
})
app.on('second-instance', (_event, argv) => {
  // argv may contain the deep-link URL on Windows/Linux
  const url = argv.find(a => a.startsWith('myapp://'))
  if (url) state.pendingUrl = url
  // Bring existing window to foreground
  state.mainWindow?.show()
  state.mainWindow?.focus()
})

// ── WHEN READY ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  logger.info('app:ready', {})

  // Step 6: Dock hide BEFORE first BrowserWindow
  if (process.platform === 'darwin') {
    app.dock.hide()  // prevents Dock icon flash for menu-bar-only apps
  }

  // Steps 7-9: services, IPC, window
  registerIpc(ipcMain, ctx)
  state.mainWindow = createMainWindow()

  // Drain any pending URL that arrived before ready
  if (state.pendingUrl) {
    routeDeepLink(state.pendingUrl)
    state.pendingUrl = null
  }
})

// ── QUIT HANDLERS ─────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  // Clean up global shortcuts, watchers, etc.
})
```

## Why crashReporter Must Be First

`crashReporter.start()` instruments renderer processes AT SPAWN TIME. Any BrowserWindow created before `start()` runs is not monitored. If you start the crash reporter inside `whenReady`, renderers that crash during startup are invisible.

## Why requestSingleInstanceLock Must Be Pre-Ready

If you call `requestSingleInstanceLock()` inside `whenReady`, the second instance has already performed partial initialization before quitting. On macOS, the first instance may receive the `second-instance` event too late. The lock must be synchronous at module load.

## Cold-Launch Deep Links

When a user clicks `myapp://action` from another app while your app is NOT running:

1. macOS launches your app binary
2. BEFORE `whenReady` fires, macOS delivers `open-url` event
3. If you attach the listener inside `whenReady`, the event is already gone

The pre-ready listener captures it and stashes it in state. After ready, you drain it.

## macOS App Lifecycle Differences

macOS apps don't quit when all windows close — they stay running in the Dock (or menu bar). Handle this:

```typescript
app.on('window-all-closed', () => {
  // On macOS: DON'T quit unless it's a menu-bar app that manages its own lifecycle
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  // macOS: Dock click when app is running but no windows — re-create window
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})
```

## App State Object

A shared mutable state object for boot-phase plumbing avoids complex initialization ordering:

```typescript
const state: {
  mainWindow: BrowserWindow | null
  pendingUrl: string | null
  // services installed during whenReady:
  tray: TrayController | null
  shortcuts: ShortcutController | null
} = {
  mainWindow: null,
  pendingUrl: null,
  tray: null,
  shortcuts: null,
}
```

This is intentionally mutable module-scope state — the alternative is a complex dependency-injection tree that doesn't survive the async boundary.

## Key App Events

| Event | When | Notes |
|---|---|---|
| `app.whenReady()` | Platform ready | Create windows here |
| `ready` | Same as whenReady | Prefer `.whenReady().then()` |
| `window-all-closed` | All BrowserWindows closed | Quit on Linux/Windows |
| `activate` (macOS) | Dock click, no windows | Re-create window |
| `before-quit` | Quit initiated | Last chance to cancel quit |
| `will-quit` | Quit proceeding | Clean up: unregister shortcuts |
| `open-url` (macOS) | Deep link from OS | MUST be pre-ready |
| `second-instance` | Another instance started | MUST be pre-ready |

## Key Takeaways

1. Five things MUST happen at module-load scope before `whenReady`: crashReporter, singleInstanceLock, setAsDefaultProtocolClient, open-url listener, second-instance listener.
2. `dock.hide()` must be called inside `whenReady` but before the first BrowserWindow.
3. Pre-ready event listeners (open-url, second-instance) catch cold-launch URLs.
4. `window-all-closed` should only quit on Linux/Windows — macOS apps persist in menu bar.
5. Use a module-scope state object to bridge pre-ready and post-ready initialization.

Evidence: `../../05_distillation/patterns/P-06-pre-ready-boot-ordering.md`, `../../05_distillation/patterns/P-13-crashreporter-start-before-whenready.md`, `../../01_research/03-app-lifecycle.md`, `../../01_research/11-deep-links-protocol.md`
