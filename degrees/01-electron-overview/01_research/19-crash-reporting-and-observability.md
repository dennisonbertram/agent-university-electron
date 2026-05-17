# Crash Reporting and Observability — Electron

Version: Electron 42.1.0 [S19]

## crashReporter

### Setup (Call BEFORE app.ready)

```typescript
// src/main.ts — before any other code
import { app, crashReporter } from 'electron'
import path from 'node:path'

// Set crash dump directory BEFORE starting crash reporter
app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashes'))

crashReporter.start({
  productName: 'MyApp',
  // submitURL is required if uploadToServer: true
  submitURL: 'http://localhost:9080/crashes', // local sink for testing
  // OR for production:
  // submitURL: 'https://crash.example.com/upload',
  uploadToServer: true,           // false = store locally, no upload
  ignoreSystemCrashHandler: false,
  rateLimit: false,               // true = max 1 upload/hour (macOS/Windows)
  compress: true,                 // gzip payload (default true since v12)
  globalExtra: {
    _productName: 'MyApp',
    _companyName: 'MyCompany',
    environment: process.env.NODE_ENV ?? 'production',
  },
  extra: {
    'main-process': 'true', // process-specific (not sent from renderers)
  },
})
```

[S19]

### Key Rules

1. Call `crashReporter.start()` BEFORE `app.on('ready')` — renderers spawned before start won't be monitored [S19]
2. Do NOT call again in renderer processes — main-process start auto-monitors renderers
3. `globalExtra` values are frozen after `start()` — cannot change at runtime
4. If `submitURL` is omitted, MUST set `uploadToServer: false` (required since v13)
5. `companyName` option is deprecated — use `globalExtra._companyName`

### Minidump Storage

Minidumps are stored in a `Crashpad` directory at `app.getPath('crashDumps')`:
```
~/Library/Application Support/<AppName>/crashes/
  Crashpad/
    pending/     ← not yet uploaded
    completed/   ← uploaded
    attachments/ ← additional files
```

Override before start:
```typescript
app.setPath('crashDumps', '/custom/crash/path')
```

### Local Crash Sink (Testing)

Run a minimal server to receive crash reports:

```typescript
// scripts/crash-sink.ts
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const PORT = 9080
let count = 0

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/crashes') {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const filename = path.join('/tmp', `crash-${Date.now()}-${count++}.dmp`)
      writeFileSync(filename, Buffer.concat(chunks))
      console.log('[crash-sink] received crash report:', filename)
      res.writeHead(200)
      res.end('{"result": "ok"}')
    })
  } else {
    res.writeHead(404)
    res.end()
  }
}).listen(PORT, () => {
  console.log(`Crash sink running at http://localhost:${PORT}`)
})
```

Trigger a crash to test:
```typescript
// In main process:
process.crash() // produces a minidump

// In renderer (via IPC):
ipcMain.handle('debug:crash', () => process.crash())
```

### Extra Parameters

```typescript
// Add context at runtime
crashReporter.addExtraParameter('userId', 'user-123')
crashReporter.addExtraParameter('sessionId', sessionId)

// Remove
crashReporter.removeExtraParameter('userId')

// Inspect
const params = crashReporter.getParameters()
```

Limits:
- Keys: max 39 bytes (excess silently ignored)
- Values via `addExtraParameter`: max 20,320 bytes (truncated)
- Values in `globalExtra`/`extra`: max 127 bytes (truncated) [S19]

## Logging with electron-log

`electron-log` is the community standard for structured logging in Electron apps.

```bash
npm install electron-log
```

```typescript
// src/logger.ts
import log from 'electron-log/main'
import path from 'node:path'

// Configure before use
log.initialize()
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('logs'), 'app.log')
log.transports.file.level = 'info'
log.transports.console.level = 'debug' // verbose in dev
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

export const logger = log
```

```typescript
// In renderer/preload:
import log from 'electron-log/renderer'
log.info('renderer started')
```

### Structured Logging Convention

```typescript
// Prefix with [module] tag, include relevant context
logger.info('[tray] created', { iconPath: path.basename(iconPath) })
logger.info('[ipc] journal:append', { entryLength: text.length })
logger.warn('[shortcuts] failed to register', { accelerator })
logger.error('[updater] error', { message: err.message, code: (err as any).code })
```

DO NOT log:
- Passwords, API keys, tokens
- Full paths (may contain username)
- Personal user data without consent
- Raw encrypted buffer contents

### Log Locations (macOS)

```
~/Library/Logs/<AppName>/
  app.log        ← electron-log default
  main.log       ← crashReporter (if custom path not set)
```

## DevTools Integration

```typescript
// Open DevTools (development only)
if (process.env.NODE_ENV !== 'production') {
  win.webContents.openDevTools({ mode: 'detach' })
}

// Install React DevTools (optional, for React renderers)
// import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer'
// await installExtension(REACT_DEVELOPER_TOOLS)
```

## Console Logging from Renderer

```typescript
// Main listens to renderer console output
win.webContents.on('console-message', (event) => {
  // In Electron 35+: event.level is a string ('info' | 'warning' | 'error' | 'debug')
  // Not: event.level as numeric
  const level = event.level // string since Electron 35
  const message = event.message
  const line = event.line
  const source = event.sourceId
  logger.info(`[renderer:${level}] ${message} (${source}:${line})`)
})
```

BREAKING: The `console-message` event signature changed in Electron 35. `event.level` is now a string, not a number. [S29]

## Sourcemaps for Packaged Builds

```typescript
// vite.renderer.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true, // enable in packaged build for readable stack traces
    // Caution: sourcemaps expose source code; consider separate sourcemap upload
    // to crash reporter and exclude from distribution
  },
})
```

## Observability Checklist (per POC)

- [ ] `crashReporter.start()` called before `app.ready`
- [ ] Local crash sink script for testing
- [ ] `electron-log` initialized with file transport
- [ ] All IPC handlers log entry and exit at debug level
- [ ] All errors logged with context
- [ ] `console-message` event forwarded from renderer to main log
- [ ] `process.crash()` triggered to verify crash sink receives reports
- [ ] Log level configurable via env var
- [ ] Logs directory accessible: `app.getPath('logs')`
