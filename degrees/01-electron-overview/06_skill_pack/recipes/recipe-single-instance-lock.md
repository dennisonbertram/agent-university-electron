# Recipe — Single Instance Lock

**Use when**: Preventing multiple instances of your app from running simultaneously.

## Code

```typescript
// src/main.ts — module-load scope, BEFORE app.whenReady()
import { app, BrowserWindow } from 'electron'

// MUST be before whenReady — calling after is too late
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // This is a second instance — quit immediately
  app.quit()
  // process.exit(0) is not needed; app.quit() is sufficient here
}

// Handle second-instance event in the FIRST (winner) instance
app.on('second-instance', (_event, argv, _workingDirectory) => {
  // argv is the command-line args of the second instance
  // On Windows/Linux, deep-link URLs arrive here:
  const deepLinkUrl = argv.find(a => a.startsWith('myapp://'))
  if (deepLinkUrl) {
    // Route the URL
    routeDeepLink(deepLinkUrl)
  }

  // Bring the existing window to focus
  const [win] = BrowserWindow.getAllWindows()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  logger.info('app:second-instance:focused', {})
})

app.whenReady().then(() => {
  // ... rest of startup
})
```

## Test Pattern

```typescript
it('R-single-instance-01: requestSingleInstanceLock called before whenReady', () => {
  const src = readFileSync('src/main.ts', 'utf8')
  // requestSingleInstanceLock must appear before the whenReady call in the file
  const lockIdx = src.indexOf('requestSingleInstanceLock()')
  const readyIdx = src.indexOf('whenReady()')
  expect(lockIdx).toBeGreaterThan(-1)
  expect(readyIdx).toBeGreaterThan(-1)
  expect(lockIdx).toBeLessThan(readyIdx)
})
```

## Watch Out For

- If `requestSingleInstanceLock()` is called inside `whenReady().then()`, the second instance has already partially initialized before quitting — this can cause race conditions on macOS.
- On Linux, the lock file is stored in `app.getPath('userData')`. If `userData` is on a network filesystem, the lock may not work reliably.
- The `second-instance` event is NOT fired on macOS for deep links — those come through `open-url`. Handle both.
- `app.requestSingleInstanceLock()` returns `false` for the second instance immediately — you MUST quit synchronously after checking, before any other initialization.

Evidence: `../../05_distillation/patterns/P-06-pre-ready-boot-ordering.md`, `../../01_research/11-deep-links-protocol.md`
