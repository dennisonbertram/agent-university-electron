# Lab 10 — Capstone: Menu Bar App

**Goal**: Build a menu-bar-only macOS app (no Dock icon) that combines tray, notifications, global shortcuts, and deep links in one working app — the "Pulse" pattern.

**Prerequisites**: All previous labs (01-09), all lessons (01-12)

**Duration**: ~60-90 minutes

**POC Reference**: [examples/example-capstone-pulse.md](../examples/example-capstone-pulse.md)

## Goal

By the end, you should have a working app that:
- Shows only in the menu bar (no Dock icon)
- Has a tray icon with state (idle/active)
- Sends notifications (or logs failure if unsigned)
- Registers a global shortcut that toggles state
- Handles a deep link `myapp://toggle`
- Logs all events as structured JSON-lines
- Has at least 3 Playwright behavioral tests

## Architecture Blueprint

```
src/
  main.ts          — pre-ready boot order (P-06)
  window.ts        — secure popover window (P-01, P-18)
  tray.ts          — module-scope tray (P-05)
  notifications.ts — failed-listener-first (P-09)
  shortcuts.ts     — register + will-quit unregister (P-10)
  protocol.ts      — deep-link parser (P-11)
  log.ts           — structured JSON-lines (PB-07)
  ipc.ts           — registry + validators (P-02)
  preload.ts       — contextBridge surface
  renderer/
    index.html
    renderer.ts
```

## Steps

### 1. main.ts boot order

```typescript
// src/main.ts — module-load scope
import { app, ipcMain } from 'electron'
import { createLogger } from './log'
import { startCrashReporter } from './crash'
import { SCHEME, parseDeepLink } from './protocol'
import { createMainWindow } from './window'
import { installTray } from './tray'
import { showNotification } from './notifications'
import { installShortcuts } from './shortcuts'
import { registerIpc } from './ipc'

// Set paths before whenReady
if (process.env.USER_DATA_DIR) app.setPath('userData', process.env.USER_DATA_DIR)

const logger = createLogger('main')
logger.info('app:starting', {})

// Step 1: crashReporter
try { startCrashReporter({ logger, productName: 'Capstone' }) } catch {}

// Step 2: single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

// Step 3: protocol
try { app.setAsDefaultProtocolClient(SCHEME) } catch {}

// Step 4: pre-ready listeners
const pendingUrls: string[] = []
app.on('open-url', (event, url) => {
  event.preventDefault()
  pendingUrls.push(url)
  if (app.isReady()) drainUrls()
})
app.on('second-instance', (_event, argv) => {
  const url = argv.find(a => a.startsWith(`${SCHEME}://`))
  if (url) pendingUrls.push(url)
  state.mainWindow?.show()
  state.mainWindow?.focus()
})

// State
const state: { mainWindow: any; tray: any; shortcuts: any } = {
  mainWindow: null, tray: null, shortcuts: null
}

function drainUrls() {
  while (pendingUrls.length > 0) {
    const url = pendingUrls.shift()!
    const [parsed, err] = parseDeepLink(url)
    if (err) { logger.warn('deeplink:parse-failed', { url, error: err.message }); continue }
    logger.info('deeplink:parsed', { action: parsed!.action })
    if (parsed!.action === 'toggle') {
      const current = state.tray?.getState() ?? 'idle'
      state.tray?.setState(current === 'idle' ? 'active' : 'idle')
    }
  }
}

app.whenReady().then(() => {
  logger.info('app:ready', {})
  if (process.platform === 'darwin') app.dock.hide()

  state.tray = installTray({ logger })
  state.shortcuts = installShortcuts({
    logger,
    onFire: () => {
      const current = state.tray?.getState() ?? 'idle'
      state.tray?.setState(current === 'idle' ? 'active' : 'idle')
      showNotification({ title: 'State changed', body: `Now ${current === 'idle' ? 'active' : 'idle'}`, logger })
    },
  })

  const ctx = { logger, tray: state.tray, notifications: { show: showNotification } }
  registerIpc(ipcMain, ctx)
  state.mainWindow = createMainWindow()
  logger.info('window:created', {})

  drainUrls()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

### 2. Popover window (P-18)

In `src/window.ts`, use `frame: false` and appropriate dimensions for a popover:

```typescript
const win = new BrowserWindow({
  width: 420,
  height: 400,
  frame: false,
  resizable: false,
  minimizable: false,
  maximizable: false,
  webPreferences: { ...SECURE_WEB_PREFERENCES, preload: preloadPath },
})
```

### 3. Renderer shows tray state

In `src/renderer/renderer.ts`:
```typescript
// Periodically poll current state (or use IPC push)
async function refreshState() {
  const state = await window.api.getTrayState()
  document.getElementById('state')!.textContent = state
}
setInterval(refreshState, 1000)
```

Add `getTrayState` IPC channel that returns `state.tray.getState()`.

### 4. Playwright tests

Write at least these 3:

```typescript
test('BT-cap-01: app starts, tray installed', async () => {
  const { app, readLogLines } = await launchApp()
  try {
    await expect.poll(
      () => readLogLines().some(l => l.event === 'tray:installed'),
      { timeout: 5000 }
    ).toBe(true)
  } finally { await app.close() }
})

test('BT-cap-02: shortcut toggles state', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() => (window as any).api.testFireShortcut('CmdOrCtrl+Shift+P'))
    await expect.poll(
      () => readLogLines().some(l =>
        l.event === 'tray:state-changed' &&
        (l.payload as any)?.state === 'active'
      ),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})

test('BT-cap-03: deep link toggles state', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.testEmitOpenUrl('myapp://toggle')
    )
    await expect.poll(
      () => readLogLines().some(l => l.event === 'deeplink:parsed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Verify Checklist

- [ ] App launches with no Dock icon visible
- [ ] Tray icon appears in menu bar
- [ ] `CmdOrCtrl+Shift+P` toggles tray state (via test seam)
- [ ] `myapp://toggle` deep link toggles tray state (via test seam)
- [ ] Notification fires (either `shown` or `failed` logged)
- [ ] `will-quit` logs `shortcut:cleanup:will-quit`
- [ ] All 3 Playwright tests pass

## Key Takeaways

This lab exercises the full Electron skill pack in one coherent app. The patterns it validates:
- P-01 (secure window), P-02 (IPC registry), P-05 (module-scope tray), P-06 (pre-ready boot), P-07 (test seams), P-09 (notification failed), P-10 (shortcut cleanup), P-11 (deep link router), P-13 (crashReporter pre-ready)

Evidence: [examples/example-capstone-pulse.md](../examples/example-capstone-pulse.md), `../../03_pocs/L-capstone-pulse/`, `../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`
