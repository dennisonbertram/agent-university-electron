# Recipe — Structured JSON-Lines Logger

**Use when**: Implementing observability in any Electron process.

## Code

```typescript
// src/log.ts
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

interface LogEntry {
  ts: string
  level: 'debug' | 'info' | 'warn' | 'error'
  process: string
  module: string
  event: string
  payload?: object
}

export type Logger = ReturnType<typeof createLogger>

// LOG_DIR can be overridden by env var for test isolation
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs')

export function createLogger(module: string, proc: string = 'main'): Logger {
  const logPath = path.join(LOG_DIR, `${proc}.log`)
  mkdirSync(LOG_DIR, { recursive: true })

  const write = (level: string, event: string, payload?: object) => {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level: level as LogEntry['level'],
      process: proc,
      module,
      event,
      ...(payload !== undefined ? { payload } : {}),
    }
    // appendFileSync is synchronous — tests can read immediately after emit
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

## Reading Logs in Tests

```typescript
// tests/e2e/helpers.ts
export function readLogLines(logDir: string): Array<Record<string, unknown>> {
  const logPath = path.join(logDir, 'main.log')
  try {
    return readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l))
  } catch { return [] }
}
```

```typescript
// In a Playwright test:
await expect.poll(
  () => readLogLines(logDir).some(l => l.event === 'tray:installed'),
  { timeout: 5000 }
).toBe(true)
```

## Event Naming Convention

```
<module>:<verb>              e.g., tray:installed, window:created
<module>:<verb>:<qualifier>  e.g., ipc:app:ping:served, power:suspend:observed
<module>:<verb>:failed       e.g., shortcut:register:failed
```

Common markers from L1-capstone:
```
app:starting, app:ready, app:before-quit
window:created, window:closed
ipc:<channel>:served, ipc:<channel>:validation-failed
tray:installed, tray:state-changed
notification:shown, notification:failed
shortcut:registered, shortcut:<key>:fired, shortcut:cleanup:will-quit
power:suspend:observed, power:resume:observed
deeplink:parsed, deeplink:parse-failed
updater:checking, updater:update-available, updater:update-downloaded
crash-reporter:started
```

## Test Pattern

```typescript
it('R-log-01: log entries are valid JSON', async () => {
  const { app, logDir } = await launchApp()
  await app.close()
  const lines = readFileSync(path.join(logDir, 'main.log'), 'utf8')
    .trim().split('\n').filter(Boolean)
  for (const line of lines) {
    expect(() => JSON.parse(line)).not.toThrow()
    const entry = JSON.parse(line)
    expect(entry).toHaveProperty('ts')
    expect(entry).toHaveProperty('event')
  }
})
```

## Watch Out For

- `appendFileSync` is synchronous and blocks the main process I/O thread. For high-throughput logging (>1000 events/sec), switch to async writes or `electron-log`. For typical Electron apps, synchronous is fine and avoids buffering delays in tests.
- Never log plaintext secrets, passphrases, or full paths under `userData` (leaks bundle ID + username).
- The `LOG_DIR` env var path MUST be created (via `mkdirSync`) before the first write. The recipe does this at module initialization.
- In packaged builds, `process.cwd()` may return `/` — always use `app.getPath('logs')` as the fallback in production (not `process.cwd()`). The recipe uses `process.cwd()` for dev; adjust for production.

Evidence: `../../05_distillation/playbooks/PB-07-observability-structured-logging-conventions.md`, `../../05_distillation/decision-records/DR-02-hand-rolled-jsonl-logger-at-l1.md`
