# P-13 — `crashReporter.start()` BEFORE `app.whenReady()`

**When to use**: every Electron app that wants renderer crashes captured.
**Evidence**: L5 R-L5-1 (`03_pocs/L5-packaging-signing-update/src/crash.ts`), capstone R-C-5 (`03_pocs/L-capstone-pulse/src/main.ts:30-51`).

## Pattern

```typescript
// src/crash.ts
import { app, crashReporter } from 'electron'

export interface CrashReporterService {
  getState(): {
    started: boolean
    submitURL: string | null
    uploadToServer: boolean
    startedBeforeWhenReady: boolean
    uploadedReports: number
  }
}

export function startCrashReporter(opts: {
  logger: Logger
  submitURL?: string
  productName: string
}): CrashReporterService {
  const startedBeforeWhenReady = !app.isReady()
  const uploadToServer = !!opts.submitURL

  crashReporter.start({
    productName: opts.productName,
    submitURL: opts.submitURL ?? 'http://localhost:9080/crashes',
    uploadToServer,
    rateLimit: false,
    compress: true,
    globalExtra: {
      _productName: opts.productName,
      environment: process.env.NODE_ENV ?? 'production',
    },
  })

  opts.logger.info('crash-reporter:started', {
    submitURL: opts.submitURL ?? null,
    uploadToServer,
    startedBeforeWhenReady,
  })

  return {
    getState: () => ({
      started: true,
      submitURL: opts.submitURL ?? null,
      uploadToServer,
      startedBeforeWhenReady,
      uploadedReports: crashReporter.getUploadedReports().length,
    }),
  }
}
```

```typescript
// src/main.ts — module-load scope, before whenReady
try {
  crashReporterService = startCrashReporter({
    logger: crashBootLogger,
    submitURL: process.env.CRASH_URL,
    productName: 'Pulse',
  })
} catch (err) {
  crashBootLogger.error('crash-reporter:start-failed', {
    message: err instanceof Error ? err.message : String(err),
  })
}

// THEN — and only then — wait for whenReady
app.whenReady().then(() => { /* ... */ })
```

## Why it works

- `crashReporter.start()` instruments renderers AT SPAWN TIME. Renderers that exist before `start()` runs are NOT monitored.
- Module-load scope guarantees the call site runs before any code path that might create a BrowserWindow.
- The `startedBeforeWhenReady` flag in the service's state is the regression-test target — R-L5-1 asserts it's `true` for every boot.

## Tradeoffs

- Module-load scope means a sync crash inside `crashReporter.start()` takes down the app before any error UI exists. Wrap in try/catch and log to a bootstrap log file before any of the production logger setup.
- The bootstrap logger must use a deterministic path that doesn't depend on `app.getPath('logs')` (which isn't valid before `whenReady` on some platforms). Use `LOG_DIR` env var or `__dirname/../.crash-boot-logs`.

## Variants

- **Local crash sink server** for tests (`scripts/crash-sink.ts`) — same shape as the update fixture server, accepts POST to `/crashes`.

## Evidence

- `01_research/19-crash-reporting-and-observability.md` lines 41-45
- `01_research/21-failure-modes.md#FM-12`
- `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-1
- `03_pocs/L-capstone-pulse/src/main.ts:30-51`
