# PB-07 — Structured-logging conventions (observability)

Doctrine: every behavioral test ends up grep'ing a log marker. Logs are the test contract.

## Log entry shape

```typescript
interface LogEntry {
  ts: string                                       // ISO-8601, e.g. "2026-05-17T10:23:45.123Z"
  level: 'debug' | 'info' | 'warn' | 'error'
  process: 'main' | 'renderer' | 'preload' | 'utility'
  module: string                                   // e.g. 'tray', 'ipc', 'storage', 'updater'
  event: string                                    // e.g. 'focus:start', 'ipc:invoke', 'journal:append:1-row'
  correlation_id?: string
  payload?: object                                 // sanitized; no secrets / PII
}
```

## Naming convention for `event`

`<module>:<verb>` or `<module>:<verb>:<qualifier>`. Examples from L1-capstone:

- `app:starting`, `app:ready`, `app:before-quit`
- `window:created`, `window:closed`
- `ipc:app:ping:served`, `ipc:journal:append:validation-failed`
- `security:will-navigate:blocked`
- `tray:installed`, `tray:state-changed`
- `notification:shown`, `notification:failed:unsigned`
- `shortcut:CmdOrCtrl+Shift+P:fired`, `shortcut:register:failed`
- `power:suspend:observed`, `power:resume:observed`
- `journal:row:inserted`, `journal:unlocked:touch-id`, `journal:unlocked:passphrase`
- `journal:encryption-unavailable:fallback-plaintext`
- `updater:checking`, `updater:update-available`
- `crash-reporter:started`

Tests grep for specific markers — `expect(logs.some(l => l.event === 'tray:installed')).toBe(true)`. Consistency lets the same helper read every POC's logs.

## Implementation choices

### Hand-rolled synchronous logger (L1)

For early POCs where tests need to read logs immediately:

```typescript
// src/log.ts — dependency-free, synchronous
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export function createLogger(opts: { logDir: string; module: string; process: 'main' | 'preload' | 'renderer' }) {
  const logPath = path.join(opts.logDir, `${opts.process}.log`)
  mkdirSync(opts.logDir, { recursive: true })
  const append = (level: string, event: string, payload?: object) => {
    const entry = { ts: new Date().toISOString(), level, process: opts.process, module: opts.module, event, payload }
    appendFileSync(logPath, JSON.stringify(entry) + '\n')
  }
  return {
    debug: (event: string, payload?: object) => append('debug', event, payload),
    info: (event: string, payload?: object) => append('info', event, payload),
    warn: (event: string, payload?: object) => append('warn', event, payload),
    error: (event: string, payload?: object) => append('error', event, payload),
  }
}
```

### electron-log (L4+)

Drop-in once buffered writes are acceptable. Configure with `transports.file.format = JSON.stringify` to match the schema:

```typescript
import log from 'electron-log/main'
log.initialize()
log.transports.file.resolvePathFn = () => path.join(app.getPath('logs'), 'main.log')
log.transports.file.format = JSON.stringify
```

## What NOT to log

- Plaintext journal content. The capstone strips it via `length` instead of `text`.
- Passphrases, hashes, salts (any of the three is enough to attack).
- Full file paths under `userData` in error messages (leaks bundle ID, username).
- Stack traces with stack frames pointing at user-named files (still useful for debugging, but sanitize before remote upload).

## Test pattern

```typescript
const lines = readLogLines() // see PB-06 launchApp helper
await expect.poll(() => lines.some(l => l.event === 'journal:append:1-row'),
  { timeout: 3000 }
).toBe(true)
```

## Evidence

- `02_planning/observability-strategy.md` lines 30-76
- `04_logs/decision-log.md#decision-2`
- `03_pocs/L1-hello-electron/src/log.ts` (hand-rolled)
- `03_pocs/L-capstone-pulse/src/log.ts`
- Used by every BT in every POC L1-capstone
