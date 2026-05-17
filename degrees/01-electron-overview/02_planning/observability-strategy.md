# Observability Strategy — 01-electron-overview

Version: Electron 42.1.0, electron-log 5.x. Evidence: `../01_research/19-crash-reporting-and-observability.md`.

---

## 1. Logging Library Decision

**Library**: `electron-log` (canonical community standard).

**Rationale**: `electron-log` provides:
- Multi-transport output: file, console, renderer
- Log rotation and file size management
- Main→renderer forwarding via IPC (built-in)
- Sourcemap-aware stack trace formatting
- Configurable log levels per transport
- Zero external dependencies beyond Electron

Research found no blocking issues with `electron-log` for Electron 42. The import path changed in v5: `electron-log/main` for main process, `electron-log/renderer` for renderer process, `electron-log/preload` for preload. [`../01_research/19-crash-reporting-and-observability.md`]

**Alternative paths not taken**:
- Hand-rolled logger: viable for simple apps but requires reimplementing rotation, IPC forwarding, and sourcemap handling. Not justified for this degree.
- `pino`: excellent structured logging but designed for Node servers; lacks Electron-specific transports and renderer forwarding. Would require significant adaptation.
- `winston`: similar to pino; no Electron-specific support. Considered and rejected.

---

## 2. Structured Log Format

All logs use a JSON-lines format on the file transport (human-readable on console transport). Every log line must contain:

```typescript
interface LogEntry {
  ts: string          // ISO-8601, e.g. "2026-05-17T10:23:45.123Z"
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload' | 'utility'
  module: string      // e.g. 'tray', 'ipc', 'storage', 'session', 'updater', 'crash'
  event: string       // e.g. 'focus:start', 'ipc:invoke', 'window:open', 'storage:write'
  correlation_id?: string  // UUID for IPC roundtrips; optional for non-IPC events
  payload?: object    // sanitized; never contains secrets or PII
}
```

**electron-log configuration**:
```typescript
// src/logger.ts
import log from 'electron-log/main'
import path from 'node:path'
import { app } from 'electron'

// Must call before any logging
log.initialize()

// File transport: JSON-lines format
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('logs'), 'app.log')
log.transports.file.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
log.transports.file.format = JSON.stringify  // JSON-lines

// Console transport: human-readable for development
log.transports.console.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] [{module}] {text}'

export function createModuleLogger(module: string) {
  return {
    debug: (event: string, payload?: object) =>
      log.debug({ ts: new Date().toISOString(), process: 'main', module, event, payload }),
    info: (event: string, payload?: object) =>
      log.info({ ts: new Date().toISOString(), process: 'main', module, event, payload }),
    warn: (event: string, payload?: object) =>
      log.warn({ ts: new Date().toISOString(), process: 'main', module, event, payload }),
    error: (event: string, payload?: object) =>
      log.error({ ts: new Date().toISOString(), process: 'main', module, event, payload }),
  }
}
```

**Usage pattern**:
```typescript
// src/tray.ts
import { createModuleLogger } from './logger'
const logger = createModuleLogger('tray')

logger.info('state-changed', { from: prevState, to: newState })
logger.warn('icon-load-failed', { path: iconPath, reason: err.message })
```

---

## 3. Log Levels

| Level | When to use |
|-------|-------------|
| `debug` | Entry and exit of every IPC handler; every storage read; every event listener registration; development-only state snapshots |
| `info` | App lifecycle events (ready, quit, window open/close); tray state transitions; session start/stop/pause; notification shown; shortcut registered; deep link received; updater state changes |
| `warn` | Recoverable failures: shortcut registration returned false; notification failed event; auto-launch requires-approval; Touch ID failed with fallback activated; file watcher event missed |
| `error` | Unrecoverable or unexpected failures: IPC handler threw uncaught exception; storage write failed; native module failed to load; crashReporter failed to start; safeStorage decrypt failed |

**Rule**: Log at `debug` for instrumentation; `info` for behavioral milestones; `warn` for expected-but-notable anomalies; `error` for things that will require attention.

---

## 4. What Never to Log

The following data categories are NEVER logged, regardless of log level:

- **Secrets and credentials**: API keys, OAuth tokens, Apple ID passwords, keychain secrets, app-specific passwords
- **Touch ID outcomes verbatim**: Do not log whether Touch ID succeeded or failed with the user's biometric data. Log only: `touchid:succeeded`, `touchid:failed`, `touchid:fallback-activated`. Never log the reason string verbatim as it may contain PII.
- **Journal entry contents**: User-authored text in the focus journal. Log only byte size and entry ID. Never log `text`.
- **Signing keys and certificates**: Never log certificate fingerprints, key IDs, or entitlements contents.
- **Full file paths containing username**: macOS paths often contain the username (`/Users/dennison/...`). Log only the filename or a path relative to a known base (e.g., `logs/app.log` not `/Users/dennison/Library/Logs/Pulse/app.log`).
- **`safeStorage` buffer contents**: Never log the raw encrypted buffer; log only `{ encryptedBytes: buffer.length }`.
- **Crash dump contents**: Never log the crash report payload; log only the submission URL and response code.

---

## 5. Log Destinations

### Development Mode (`process.env.NODE_ENV !== 'production'`)

| Destination | Content |
|-------------|---------|
| stdout/stderr | Console transport (human-readable) at `debug` level |
| DevTools console | Renderer logs forwarded via `electron-log/renderer`; visible in Chromium DevTools |
| File | `~/Library/Logs/<AppName>/app.log` at `debug` level |

### Packaged Mode (production)

| Destination | Content |
|-------------|---------|
| File | `app.getPath('logs')/app.log` at `info` level; daily rotation; max 7 days |
| Crash dumps | `app.getPath('crashDumps')/Crashpad/` — minidumps only; not app logs |

**File rotation configuration**:
```typescript
log.transports.file.maxSize = 10 * 1024 * 1024 // 10 MB per file
log.transports.file.archiveLog = (oldLogPath) => {
  const date = new Date().toISOString().split('T')[0]
  return oldLogPath.replace('app.log', `app-${date}.log`)
}
// Retention: 7 days of archived logs kept; older files deleted automatically
```

### Crash Reports

```typescript
// src/main.ts — BEFORE app.on('ready')
import { app, crashReporter } from 'electron'

app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashes'))
crashReporter.start({
  productName: 'Pulse',
  submitURL: process.env.CRASH_SINK_URL ?? 'http://localhost:9080/crashes',
  uploadToServer: process.env.NODE_ENV !== 'production',
  compress: true,
  globalExtra: {
    _productName: 'Pulse',
    environment: process.env.NODE_ENV ?? 'production',
  },
})
```

Note from `../01_research/19-crash-reporting-and-observability.md`: `crashReporter.start()` MUST be called before `app.on('ready')`. Calling it after means renderers spawned before `start()` are not monitored.

---

## 6. Renderer→Main Log Forwarding

Renderer-process logs are forwarded to main so they appear in the single `app.log` file. This is essential for autonomous agents reviewing logs without human access to DevTools.

**Preload setup** (`src/preload.ts`):
```typescript
import log from 'electron-log/preload'
log.initialize({ spyRendererConsole: true }) // captures console.log etc. from renderer
```

**Renderer usage** (`src/renderer/renderer.ts`):
```typescript
import log from 'electron-log/renderer'
log.info({ ts: new Date().toISOString(), process: 'renderer', module: 'ui', event: 'ready' })
```

**Main process — `console-message` forwarding**:
```typescript
// BREAKING: event.level is a STRING in Electron 35+, NOT a number
win.webContents.on('console-message', (event) => {
  const levelStr = event.level  // 'info' | 'warning' | 'error' | 'debug'
  const level = levelStr === 'warning' ? 'warn' : levelStr
  logger[level as 'debug' | 'info' | 'warn' | 'error']?.(
    'renderer:console',
    { message: event.message, source: event.sourceId, line: event.line }
  )
})
```

See `../01_research/19-crash-reporting-and-observability.md` for the breaking change note on `event.level` being a string in Electron 35+.

---

## 7. Per-POC Instrumentation Requirements

### L1 — Hello Electron

**Required log points** (minimum 5):

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 1 | `app:ready` | info | app | App has reached ready state; log `{ electronVersion: process.versions.electron, nodeVersion: process.versions.node }` |
| 2 | `window:open` | info | window | BrowserWindow created; log `{ width, height, url }` |
| 3 | `renderer:ready` | info | ipc | Renderer reported ready via IPC; log `{ userAgent: <sanitized> }` |
| 4 | `window:closed` | info | window | BrowserWindow closed event; log `{ allWindowsClosed: boolean }` |
| 5 | `app:before-quit` | info | app | `before-quit` event fired; log `{ reason: 'user-initiated' }` |

---

### L2 — Secure IPC

**Required log points** (in addition to L1):

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 6 | `ipc:invoke-entry` | debug | ipc | Every `ipcMain.handle` entry; log `{ channel, correlation_id, argsSize }` |
| 7 | `ipc:invoke-exit` | debug | ipc | Every `ipcMain.handle` completion; log `{ channel, correlation_id, durationMs, success }` |
| 8 | `ipc:validation-failed` | warn | ipc | Payload fails schema; log `{ channel, correlation_id, reason }` (never log the invalid payload itself) |
| 9 | `security:blocked-window-open` | warn | security | `setWindowOpenHandler` blocked; log `{ url: <hostname only, not full URL> }` |
| 10 | `security:blocked-navigation` | warn | security | `will-navigate` blocked; log `{ url: <hostname only> }` |

**Sandbox failure logging**: If preload throws during initialization, the error must be caught and logged before `contextBridge.exposeInMainWorld` is called. Otherwise the renderer gets a white screen with no diagnostic information.

---

### L3 — Storage & Native I/O

**Required log points** (in addition to L1–L2):

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 11 | `storage:write` | debug | storage | Every write to `userData`; log `{ path: <filename only>, bytes }` |
| 12 | `storage:read` | debug | storage | Every read from `userData`; log `{ path: <filename only>, bytes, found: boolean }` |
| 13 | `storage:write-atomic` | debug | storage | Write-then-rename completed; log `{ path: <filename only>, success }` |
| 14 | `dialog:open` | info | dialog | `showOpenDialog` called; log `{ title }` |
| 15 | `dialog:result` | info | dialog | Dialog resolved; log `{ canceled, fileCount }` (never log paths) |
| 16 | `drag-drop:received` | info | storage | Files dropped; log `{ count, firstExtension }` (never log actual paths) |
| 17 | `menu:action` | info | menu | Menu item activated; log `{ label, accelerator }` |

---

### L4 — Deep macOS System Integration

**Required log points** (in addition to L1–L3):

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 18 | `tray:init` | info | tray | Tray created; log `{ iconPath: <filename only>, title }` |
| 19 | `tray:state-changed` | info | tray | Tray state transition; log `{ from, to }` |
| 20 | `tray:click` | debug | tray | Tray icon clicked; log `{ bounds }` |
| 21 | `notification:show` | info | notifications | `notification.show()` called; log `{ title: <first 20 chars>, hasActions }` |
| 22 | `notification:failed` | warn | notifications | `notification.failed` event; log `{ error }` |
| 23 | `notification:action` | info | notifications | Action button clicked; log `{ action }` (not reply text) |
| 24 | `shortcut:registered` | info | shortcuts | `globalShortcut.register()` returned; log `{ accelerator, registered }` |
| 25 | `shortcut:fired` | debug | shortcuts | Registered shortcut triggered; log `{ accelerator }` |
| 26 | `shortcut:unregistered-all` | info | shortcuts | All shortcuts unregistered; log `{ reason: 'will-quit' }` |
| 27 | `power:suspend` | info | power | System suspend; log `{ sessionState }` |
| 28 | `power:resume` | info | power | System resume; log `{ suspendedMs }` |
| 29 | `power:lock-screen` | info | power | Screen locked |
| 30 | `power:on-battery` | info | power | Switched to battery |
| 31 | `deeplink:received` | info | protocol | Deep link received; log `{ scheme, action }` (never log query params that may contain user data) |
| 32 | `deeplink:routed` | debug | protocol | Deep link dispatched to handler; log `{ action, paramKeys }` |
| 33 | `autolaunch:set` | info | autolaunch | `setLoginItemSettings` called; log `{ openAtLogin }` |
| 34 | `autolaunch:status` | info | autolaunch | `getLoginItemSettings` result; log `{ openAtLogin, status }` |
| 35 | `theme:changed` | info | theme | `nativeTheme.updated` fired; log `{ dark: nativeTheme.shouldUseDarkColors }` |
| 36 | `dock:badge` | debug | dock | Dock badge updated; log `{ count }` |

---

### L5 — Packaging, Code Signing, Auto-Update

**Required log points** (in addition to L1–L4):

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 37 | `crash:init` | info | crash | `crashReporter.start()` completed; log `{ submitURL: <host only>, uploadToServer }` |
| 38 | `updater:check-start` | info | updater | `checkForUpdates()` called; log `{ feedURL }` |
| 39 | `updater:checking` | debug | updater | `checking-for-update` event |
| 40 | `updater:available` | info | updater | `update-available` event; log `{ version }` |
| 41 | `updater:not-available` | info | updater | `update-not-available` event |
| 42 | `updater:downloading` | info | updater | `download-progress` events; log `{ percent, transferred }` |
| 43 | `updater:downloaded` | info | updater | `update-downloaded` event; log `{ version }` |
| 44 | `updater:error` | error | updater | `error` event; log `{ message, code }` |
| 45 | `signing:skipped` | info | packaging | Code signing skipped (no `APPLE_IDENTITY`); log `{ reason }` |

---

### Capstone — "Pulse"

All L1–L5 log points apply. Additional capstone-specific instrumentation:

| # | Event | Level | Module | Description |
|---|-------|-------|--------|-------------|
| 46 | `session:start` | info | session | Focus session started; log `{ durationMin, sessionId }` |
| 47 | `session:pause` | info | session | Session paused (e.g., on power suspend); log `{ remainingMs, reason }` |
| 48 | `session:resume` | info | session | Session resumed; log `{ resumedAfterMs }` |
| 49 | `session:end` | info | session | Session completed or stopped; log `{ durationMin, actualMs, completed: boolean }` |
| 50 | `journal:append` | info | journal | Journal entry appended; log `{ entryId, bytes }` (never log text) |
| 51 | `journal:list` | debug | journal | Journal entries listed; log `{ count }` |
| 52 | `touchid:start` | info | auth | `promptTouchID()` called |
| 53 | `touchid:succeeded` | info | auth | Touch ID succeeded |
| 54 | `touchid:failed` | warn | auth | Touch ID failed; log `{ reason: <category, not verbatim> }` |
| 55 | `touchid:fallback` | info | auth | Passphrase fallback activated |
| 56 | `safestorage:encrypt` | debug | storage | `encryptString` called; log `{ bytes }` |
| 57 | `safestorage:decrypt` | debug | storage | `decryptString` called; log `{ bytes, success }` |
| 58 | `debug-menu:opened` | info | debug | Debug log viewer window opened |

---

## 8. Debug Menu Pattern

The capstone includes a hidden debug menu accessible without exposing a public UI affordance:

```typescript
// src/debug-menu.ts
import { Menu, MenuItem, BrowserWindow, app } from 'electron'
import path from 'node:path'
import { createModuleLogger } from './logger'

const logger = createModuleLogger('debug-menu')

export function registerDebugMenu(): void {
  // Add to View menu (existing or new)
  const menu = Menu.getApplicationMenu()
  const viewMenu = menu?.items.find(i => i.label === 'View')

  const debugItem = new MenuItem({
    label: 'Show Logs',
    accelerator: 'CmdOrCtrl+Shift+L',
    click: () => openLogViewer(),
  })

  // In development, add a "Crash Test" item
  if (process.env.NODE_ENV !== 'production') {
    const crashItem = new MenuItem({
      label: 'Trigger Test Crash',
      click: () => process.crash(),
    })
    viewMenu?.submenu?.append(crashItem)
  }

  viewMenu?.submenu?.append(debugItem)
  Menu.setApplicationMenu(menu)
}

function openLogViewer(): void {
  const logPath = path.join(app.getPath('logs'), 'app.log')
  logger.info('debug-menu:opened', { logPath: 'app.log' })

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'Pulse Logs',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  win.loadFile(path.join(__dirname, '../renderer/log-viewer.html'))
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('log-path', logPath)
  })
}
```

---

## 9. Sourcemaps for Packaged Builds

Enable sourcemaps in Vite's renderer and main configs to produce readable stack traces in crash reports and electron-log output:

```typescript
// vite.renderer.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
})

// vite.main.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
})
```

**Caution** (from `../01_research/19-crash-reporting-and-observability.md`): Sourcemaps expose source code. For production, consider uploading sourcemaps to the crash reporter separately (e.g., Sentry) and excluding them from the DMG distribution. For this degree (no production ship), include sourcemaps in the packaged app for debugging convenience.

`electron-log` respects sourcemaps when formatting Error objects. Stack traces in log files will show original TypeScript lines, not minified output.

---

## 10. Test Observability Requirement

Tests must assert log emission for security-relevant events. This is not optional — an agent reviewing a silent-failure scenario must be able to find the cause in logs.

**Required observable log assertions in tests**:

| Event | Test assertion |
|-------|---------------|
| `security:blocked-window-open` | After triggering `window.open()` in renderer, read app log file and assert log line with event=`security:blocked-window-open` exists |
| `security:blocked-navigation` | After triggering `will-navigate` to external URL, assert log line with event=`security:blocked-navigation` exists |
| `ipc:validation-failed` | After sending malformed IPC payload, assert log line with event=`ipc:validation-failed` and no `level=error` lines indicating uncaught exception |
| `notification:failed` | In unsigned build, after `notification.show()`, assert log line with event=`notification:failed` (expected; not a test failure) |
| `shortcut:registered` | After app boot, assert log line with event=`shortcut:registered` and `registered: true` (or log explaining false) |
| `crash:init` | After app boot, assert `crash:init` log line appears BEFORE any `app:ready` log line |
| `session:start` | After shortcut fires in capstone, assert `session:start` log line with `sessionId` field present |
| `journal:append` | After `pulse://log?text=hello`, assert `journal:append` log line with `bytes > 0` (never check text) |

**Log file inspection in tests**:
```typescript
// tests/helpers/log-inspector.ts
import { readFileSync } from 'node:fs'
import { app } from 'electron'
import path from 'node:path'

export function readLogLines(appPath?: string): object[] {
  const logPath = appPath
    ? path.join(appPath, 'logs', 'app.log')
    : path.join(process.env.TEST_LOG_DIR ?? os.tmpdir(), 'app.log')

  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line) }
      catch { return { raw: line } }
    })
}

export function findLogEvent(lines: object[], event: string): object | undefined {
  return lines.find((l: any) => l.event === event)
}
```

Usage in Playwright e2e:
```typescript
test('blocked navigation produces security log', async () => {
  await window.evaluate(() => {
    window.location.href = 'https://evil.example.com'
  })
  await new Promise(r => setTimeout(r, 500)) // brief wait for log flush
  const logPath = await electronApp.evaluate(({ app }) =>
    path.join(app.getPath('logs'), 'app.log')
  )
  const lines = readLogLines(logPath)
  const entry = findLogEvent(lines, 'security:blocked-navigation')
  expect(entry).toBeTruthy()
  expect((entry as any).level).toBe('warn')
})
```
