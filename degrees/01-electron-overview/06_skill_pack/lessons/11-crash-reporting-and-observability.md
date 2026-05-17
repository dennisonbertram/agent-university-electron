# Lesson 11 — Crash Reporting and Observability

**Prerequisites**: [10-auto-update.md](./10-auto-update.md)  
**Next**: [12-testing-electron-apps.md](./12-testing-electron-apps.md)

## Principle: Logs Are the Test Contract

Every behavioral test ends up grepping a log marker. If logs are unstructured (`console.log('ping received')`), tests become brittle string-matching. Structure logs from day 1.

## Log Entry Shape

```typescript
interface LogEntry {
  ts: string           // ISO-8601: "2026-05-17T10:23:45.123Z"
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload' | 'utility'
  module: string       // "tray", "ipc", "storage", "updater"
  event: string        // "tray:installed", "ipc:app:ping:served"
  payload?: object     // NO secrets, NO PII, NO full file paths
}
```

## Naming Convention for `event`

Pattern: `<module>:<verb>` or `<module>:<verb>:<qualifier>`

```
app:starting, app:ready, app:before-quit
window:created, window:closed
ipc:app:ping:served, ipc:journal:append:validation-failed
security:will-navigate:blocked
tray:installed, tray:state-changed
notification:shown, notification:failed:unsigned
shortcut:CmdOrCtrl+Shift+P:fired, shortcut:register:failed
power:suspend:observed, power:resume:observed
journal:row:inserted, journal:unlocked:touch-id
journal:encryption-unavailable:fallback-plaintext
updater:checking, updater:update-available, updater:update-downloaded
crash-reporter:started
```

Tests grep for specific markers: `expect(logs.some(l => l.event === 'tray:installed')).toBe(true)`.

## Synchronous File Logger (Dependency-Free)

For early POCs or when you need tests to read logs immediately after the event:

```typescript
// src/log.ts
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs')
mkdirSync(LOG_DIR, { recursive: true })

export type Logger = ReturnType<typeof createLogger>

export function createLogger(module: string, proc: string = 'main') {
  const logPath = path.join(LOG_DIR, `${proc}.log`)
  const write = (level: string, event: string, payload?: object) => {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      process: proc as 'main',
      module,
      event,
      payload,
    }
    appendFileSync(logPath, JSON.stringify(entry) + '\n')
  }
  return {
    debug: (event: string, payload?: object) => write('debug', event, payload),
    info:  (event: string, payload?: object) => write('info',  event, payload),
    warn:  (event: string, payload?: object) => write('warn',  event, payload),
    error: (event: string, payload?: object) => write('error', event, payload),
  }
}
```

`appendFileSync` is synchronous — tests can read the log file immediately after calling a handler, without `await` or polling.

## electron-log (Drop-In)

For production apps, `electron-log` handles log rotation, multi-process forwarding, and platform-appropriate paths:

```typescript
import log from 'electron-log/main'
import path from 'node:path'
import { app } from 'electron'

log.initialize()
log.transports.file.resolvePathFn = () =>
  path.join(process.env.LOG_DIR ?? app.getPath('logs'), 'main.log')
log.transports.file.format = JSON.stringify   // match the LogEntry schema
```

Renderer forwarding: `electron-log/renderer` automatically forwards renderer logs to main via IPC.

## What NOT to Log

- Plaintext journal content (user data)
- Passphrases, hashes, salts
- Full file paths under `userData` in error messages (leaks bundle ID + username)
- Unredacted stack traces with user-named files in remote log uploads

## crashReporter

The crashReporter captures renderer and GPU process crashes as minidump files.

Critical: call `crashReporter.start()` BEFORE `app.whenReady()`. Renderers spawned before `start()` are NOT monitored.

```typescript
// src/crash.ts
import { app, crashReporter } from 'electron'

export function startCrashReporter(opts: {
  logger: Logger
  submitURL?: string
  productName: string
}) {
  // Record whether we started before ready (for regression tests)
  const startedBeforeWhenReady = !app.isReady()

  crashReporter.start({
    productName: opts.productName,
    submitURL: opts.submitURL ?? 'http://localhost:9080/crashes',
    uploadToServer: !!opts.submitURL,
    rateLimit: false,
    compress: true,
    globalExtra: {
      _productName: opts.productName,
      environment: process.env.NODE_ENV ?? 'production',
    },
  })

  opts.logger.info('crash-reporter:started', {
    submitURL: opts.submitURL ?? null,
    uploadToServer: !!opts.submitURL,
    startedBeforeWhenReady,
  })

  return {
    getState: () => ({
      started: true,
      startedBeforeWhenReady,
      uploadedReports: crashReporter.getUploadedReports().length,
    }),
  }
}
```

In `main.ts`, call it before anything else:

```typescript
// src/main.ts — module-load scope
try {
  startCrashReporter({ logger, productName: 'MyApp', submitURL: process.env.CRASH_URL })
} catch (err) {
  // Can't let a crash reporter startup failure take down the app
  console.error('crashReporter failed:', err)
}
```

## Renderer Log Forwarding

To see renderer logs in the main process log file, add an IPC channel:

```typescript
// IPC registry — production channel
{
  channel: 'log:entry',
  validate: (arg) => {
    // validate LogEntry shape
    return arg as LogEntry
  },
  handler: (entry, ctx) => {
    ctx.logger.info(entry.event, entry.payload)
    return { ok: true }
  },
}

// preload.ts
contextBridge.exposeInMainWorld('api', {
  logEntry: (entry: LogEntry) => ipcRenderer.invoke('log:entry', entry),
})

// renderer.ts
window.api.logEntry({ ts: ..., level: 'info', process: 'renderer', module: 'ui', event: 'button:clicked', payload: {} })
```

## LOG_DIR Environment Variable

Tests need fresh log directories:

```typescript
// src/log.ts
const LOG_DIR = process.env.LOG_DIR ?? path.join(app.getPath('logs'))
```

Each Playwright test provides a fresh tmp dir:

```typescript
const logDir = mkdtempSync(path.join(tmpdir(), 'electron-log-'))
const app = await _electron.launch({
  env: { LOG_DIR: logDir, ... },
})
```

## Key Takeaways

1. Structured JSON-lines logs are the test contract — not string assertions or UI checks.
2. Event names follow `<module>:<verb>` pattern — consistent across all modules.
3. `appendFileSync` for tests; `electron-log` with `format = JSON.stringify` for production.
4. `crashReporter.start()` MUST be at module-load scope before `whenReady`.
5. Override `LOG_DIR` via env var per test for isolation.
6. Never log plaintext secrets, passphrases, or full file paths.

Evidence: `../../05_distillation/playbooks/PB-07-observability-structured-logging-conventions.md`, `../../05_distillation/patterns/P-13-crashreporter-start-before-whenready.md`, `../../05_distillation/anti-patterns/AP-06-starting-crashreporter-after-whenready.md`, `../../01_research/19-crash-reporting-and-observability.md`
