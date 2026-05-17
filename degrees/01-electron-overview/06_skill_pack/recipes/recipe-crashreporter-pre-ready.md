# Recipe — crashReporter Before whenReady

**Use when**: Setting up crash reporting in any Electron app.

## Code

```typescript
// src/crash.ts
import { app, crashReporter } from 'electron'

export interface CrashReporterService {
  getState(): {
    started: boolean
    startedBeforeWhenReady: boolean
    submitURL: string | null
    uploadToServer: boolean
  }
}

export function startCrashReporter(opts: {
  logger: Logger
  submitURL?: string
  productName: string
}): CrashReporterService {
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
      submitURL: opts.submitURL ?? null,
      uploadToServer: !!opts.submitURL,
    }),
  }
}
```

```typescript
// src/main.ts — module-load scope, BEFORE app.whenReady()
import { startCrashReporter } from './crash'

// Bootstrap logger (works before app.getPath('logs'))
const bootstrapLog = createLogger('crash-boot')

let crashService: CrashReporterService | null = null
try {
  crashService = startCrashReporter({
    logger: bootstrapLog,
    submitURL: process.env.CRASH_URL,  // undefined → don't upload
    productName: 'MyApp',
  })
} catch (err) {
  // Cannot let crash reporter failure take down the app
  console.error('crashReporter start failed:', err)
}

// THEN — wait for whenReady
app.whenReady().then(() => { /* ... */ })
```

## Test Pattern

```typescript
test('R-crash-01: crash reporter started before whenReady', async () => {
  const { app, readLogLines } = await launchApp()
  try {
    await expect.poll(
      () => {
        const lines = readLogLines()
        const line = lines.find(l => l.event === 'crash-reporter:started')
        return (line?.payload as any)?.startedBeforeWhenReady === true
      },
      { timeout: 5000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Watch Out For

- `crashReporter.start()` MUST be at module-load scope — BEFORE `app.whenReady()`. Renderers spawned before `start()` are NOT monitored by the crash reporter.
- If `submitURL` is not set (undefined), `electron-updater` since Electron 13 requires either setting `submitURL` or `uploadToServer: false`. Using `'http://localhost:9080/crashes'` as a fallback satisfies the requirement when no URL is provided.
- Wrap in try/catch — a crash during `crashReporter.start()` would kill the app before any error UI is available.
- The bootstrap logger must use a deterministic path that doesn't depend on `app.getPath('logs')` (which requires `whenReady` on some platforms). Use `LOG_DIR` env var or `__dirname` relative path.

Evidence: `../../05_distillation/patterns/P-13-crashreporter-start-before-whenready.md`, `../../05_distillation/anti-patterns/AP-06-starting-crashreporter-after-whenready.md`, `../../01_research/19-crash-reporting-and-observability.md`
