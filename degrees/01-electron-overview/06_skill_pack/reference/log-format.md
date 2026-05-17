# Log Format Reference

Structured JSON-lines logging schema and event catalog.

Back to [../index.md](../index.md) | [api-cheatsheet.md](./api-cheatsheet.md)

---

## Log Entry Schema

Every log line is a JSON object on a single line (JSON Lines format).

```typescript
interface LogEntry {
  ts: string        // ISO 8601: "2025-01-15T10:30:00.000Z"
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload'
  module: string    // source module: "tray", "ipc", "updater", etc.
  event: string     // namespaced event: "tray:created", "ipc:echo:validation-failed"
  payload?: unknown // optional structured data
}
```

**Example log line:**
```json
{"ts":"2025-01-15T10:30:00.000Z","level":"info","process":"main","module":"tray","event":"tray:created","payload":{"iconPath":"/path/to/icon.png"}}
```

---

## Event Naming Convention

```
<module>:<action>[:<state>]
```

| Module | Actions | Examples |
|---|---|---|
| `app` | `started`, `ready`, `quit`, `before-quit`, `second-instance` | `app:started`, `app:ready` |
| `window` | `created`, `hidden`, `shown`, `closed`, `load-failed` | `window:created` |
| `tray` | `created`, `clicked`, `menu-opened` | `tray:created` |
| `ipc` | `<channel>:called`, `<channel>:validation-failed`, `<channel>:error` | `ipc:echo:called` |
| `storage` | `save`, `load`, `save-failed`, `load-failed` | `storage:save` |
| `notification` | `shown`, `failed`, `clicked`, `action`, `timeout` | `notification:shown` |
| `shortcuts` | `registered`, `register-failed`, `unregistered`, `fired` | `shortcuts:registered` |
| `deep-link` | `received`, `parse-failed`, `routed`, `route-unknown` | `deep-link:received` |
| `power` | `suspend:observed`, `resume:observed`, `lock-screen`, `unlock-screen` | `power:suspend:observed` |
| `updater` | `checking-for-update`, `update-available`, `update-not-available`, `update-downloaded`, `error`, `download-progress` | `updater:update-available` |
| `crash` | `reporter-started`, `reporter-error` | `crash:reporter-started` |
| `security` | `will-navigate:blocked`, `window-open:denied`, `permission-denied` | `security:will-navigate:blocked` |
| `db` | `opened`, `migrated`, `query-error` | `db:opened` |

---

## Boot Sequence Markers

These events appear in order in the log on every launch. Use for boot-order regression tests.

```
app:started
crash:reporter-started       // MUST appear before app:ready
app:single-instance-lock     // MUST appear before app:ready
app:ready                    // app.whenReady() resolved
window:created
tray:created                 // (for menu-bar apps)
app:initialized              // all setup complete
```

---

## Special Markers

| Event | Meaning | Used In |
|---|---|---|
| `crash:startedBeforeWhenReady` | `crashReporter.start()` called before `whenReady` | E2E regression |
| `app:single-instance-lock` | `requestSingleInstanceLock()` result | E2E regression |
| `dock:hidden` | `app.dock.hide()` called | E2E regression |
| `notification:shown` OR `notification:failed` | Notification settled | E2E test (accept either) |
| `ipc:<ch>:validation-failed` | Validator rejected input | E2E validation test |
| `updater:update-available` | Update available | E2E update test |

---

## Logger Implementation

```typescript
// src/log.ts
import { appendFileSync } from 'fs'
import { app } from 'electron'
import path from 'path'

export interface LogEntry {
  ts: string
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload'
  module: string
  event: string
  payload?: unknown
}

const LOG_DIR = process.env.LOG_DIR ?? app.getPath('logs')
const LOG_FILE = path.join(LOG_DIR, 'main.log')

export function createLogger(moduleName: string) {
  function write(level: LogEntry['level'], event: string, payload?: unknown): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      process: 'main',
      module: moduleName,
      event,
      ...(payload !== undefined && { payload }),
    }
    // appendFileSync for E2E test synchronicity
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
    // Also write to electron-log for console output in dev
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry))
  }

  return {
    debug: (payload: { event: string } & Record<string, unknown>) =>
      write('debug', payload.event, omit(payload, 'event')),
    info: (payload: { event: string } & Record<string, unknown>) =>
      write('info', payload.event, omit(payload, 'event')),
    warn: (payload: { event: string } & Record<string, unknown>) =>
      write('warn', payload.event, omit(payload, 'event')),
    error: (payload: { event: string } & Record<string, unknown>) =>
      write('error', payload.event, omit(payload, 'event')),
  }
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _, ...rest } = obj
  return rest
}
```

---

## Reading Logs in Tests

```typescript
// In Playwright helpers
export function readLogLines(logFile: string): LogEntry[] {
  try {
    return fs.readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l) as LogEntry)
  } catch {
    return []
  }
}

// Usage:
const lines = readLogLines(logPath)
const started = lines.find(l => l.event === 'crash:reporter-started')
expect(started).toBeDefined()
```

---

## LOG_DIR Environment Variable

Set `LOG_DIR` to a test-specific temp directory so each test has its own isolated log file:

```typescript
// In launchApp() helper
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-logs-'))
const electronApp = await electron.launch({
  args: ['dist/main.js'],
  env: { ...process.env, LOG_DIR: logDir, NODE_ENV: 'test' },
})
```

---

## What NOT to Log

- Plaintext passwords or passphrases
- Encryption keys or key material
- `safeStorage` raw values
- Full user file contents
- PBKDF2 derived keys

Use `[REDACTED]` placeholder if you must log that an operation occurred.

---

## Related

- [../lessons/11-crash-reporting-and-observability.md](../lessons/11-crash-reporting-and-observability.md) — logging architecture
- [../recipes/recipe-structured-jsonl-logger.md](../recipes/recipe-structured-jsonl-logger.md) — complete logger implementation
- [../recipes/recipe-playwright-electron-launch.md](../recipes/recipe-playwright-electron-launch.md) — `readLogLines()` in tests

Evidence: `../../../05_distillation/patterns/P-13-crashreporter-start-before-whenready.md`, `../../../05_distillation/distilled-principles.md`
