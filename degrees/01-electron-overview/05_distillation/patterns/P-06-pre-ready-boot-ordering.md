# P-06 — Pre-ready boot ordering (single-instance + crash + protocol + dock.hide)

**When to use**: every Electron app, full stop.
**Evidence**: capstone `src/main.ts` (`03_pocs/L-capstone-pulse/src/main.ts:1-100`), R-L5-1 / R-C-4 / R-C-5.

## Pattern

```typescript
// src/main.ts — module-load scope, BEFORE any whenReady call

// 1. crashReporter.start() — renderers spawned before this are not monitored.
let crashReporterService: CrashReporterService | null = null
try {
  crashReporterService = startCrashReporter({
    logger: crashBootLogger,
    submitURL: process.env.CRASH_URL,
    productName: 'Pulse',
  })
} catch (err) {
  crashBootLogger.error('crash-reporter:start-failed', { /* ... */ })
}

// 2. requestSingleInstanceLock — second instance quits immediately.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// 3. setAsDefaultProtocolClient — must be sync, before any URL routing.
try {
  app.setAsDefaultProtocolClient('pulse')
} catch (err) { /* log */ }

// 4. open-url + second-instance handlers — catch cold-launch URLs.
app.on('open-url', (event, url) => {
  event.preventDefault()
  state.lifecycle?.dispatchArgs([url], 'open-url')
})
app.on('second-instance', (_event, argv) => {
  state.lifecycle?.dispatchArgs(argv, 'second-instance')
})

// THEN — and only then — wait for whenReady.
app.whenReady().then(async () => {
  // 5. dock.hide() BEFORE the first BrowserWindow.
  state.dock = installDock({ logger: dockLogger })
  state.dock.hide()

  // 6. Install all services in order.
  // ...

  // 7. registerIpc + create main window.
  registerIpc(ipcMain, ctx)
  const win = createMainWindow()
})
```

## Why it works

- `crashReporter.start()` instruments renderers at spawn time; renderers created before start are NOT monitored.
- `requestSingleInstanceLock()` after `whenReady` is too late; the second instance has already done partial init.
- `setAsDefaultProtocolClient` must register before `whenReady` so cold-launch URLs route to the existing handler.
- `open-url` handlers attached after `whenReady` miss URLs from a cold app launch.
- `app.dock.hide()` BEFORE the first window prevents the Dock icon from flashing into existence (BT-C-10).

## Tradeoffs

- Module-load scope means a sync error during boot can take down the app before any error UI exists. Wrap each step in try/catch and log to a bootstrap file before any of the services are ready.
- Cannot use `await` at module scope (TypeScript CommonJS target); use `.then(...)` or synchronous APIs.

## Variants

- **Async boot wrapper** — feasible only if you keep crashReporter / single-instance / protocol-registration synchronously at module load and only the *service installation* in the async path.

## Evidence

- `03_pocs/L-capstone-pulse/src/main.ts:1-100`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 1
- `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-1
- `01_research/11-deep-links-protocol.md` lines 42-86
- `01_research/19-crash-reporting-and-observability.md` lines 41-45
