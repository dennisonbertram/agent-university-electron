# BYB-02 — Before building deep macOS integration with Electron

Read this if your app targets the macOS menu bar, tray popovers, deep links, notifications, global shortcuts, Touch ID, or Service Management auto-launch — the surfaces Pulse (capstone) exercises.

## Capability map

| Capability | Electron API | Works unsigned in dev? | Works signed packaged? |
|---|---|:---:|:---:|
| Tray icon + state | `Tray`, `nativeImage.createFromBuffer` | Yes (title fallback) | Yes |
| Tray context menu | `Menu.buildFromTemplate` + `tray.setContextMenu` | Yes | Yes |
| Notifications (basic show) | `new Notification(...)` | NO — silent fail | Yes |
| Notification action buttons | `Notification({ actions })` | NO | Yes |
| Notification reply | `Notification({ hasReply })` | NO | Yes |
| globalShortcut | `globalShortcut.register` | Yes | Yes (with hardened runtime) |
| Custom URL scheme (open-url) | `setAsDefaultProtocolClient` + `open-url` | NO | Yes |
| second-instance (Win/Linux) | `requestSingleInstanceLock` + `second-instance` | Yes | Yes |
| powerMonitor events | `powerMonitor.on('suspend' / 'resume')` | Yes | Yes |
| Auto-launch round-trip | `app.setLoginItemSettings` | Flaky on macOS 13+ | Yes (with SMAppService) |
| Touch ID prompt | `systemPreferences.promptTouchID` | Hangs without enrolled finger | Yes (with entitlement) |
| Dock badge / hide | `app.dock.setBadge` / `app.dock.hide()` | Yes | Yes |
| nativeTheme | `nativeTheme.on('updated')` | Yes | Yes |
| addRecentDocument | `app.addRecentDocument` | Fire-and-forget (no OS readback) | Same |

## The five things that bite hardest

1. **Notifications NEED signing on macOS.** Plan to invest in code-signing AND a test path that drives notification action handlers via IPC seam, not real OS display.

2. **Deep links NEED packaging.** `open-url` doesn't fire for `npx electron .` invocations. Plan for programmatic emission in tests (P-08) and packaged-build smoke tests for real OS routing.

3. **`setLoginItemSettings` is non-deterministic on unsigned dev** (G-05). Assert the request side in tests; defer state-read assertions to signed packaged builds.

4. **Tray state machine via PNG template variants vs title strings.** Real polish ships per-state PNGs (`tray-idle-Template.png`, `tray-focused-Template.png`); bundler must preserve the `Template` suffix. POCs use title strings (`●`, `▶`, `◌`, `⏸`) as a deviation — fine for L4, swap real PNGs for capstone polish.

5. **Touch ID needs entitlements + signed packaged build.** `com.apple.security.cs.disable-library-validation: true` in `entitlements.mac.plist` (OQ-05). Dev seam: env-flag `TOUCH_ID_FORCE_AVAILABLE=1` resolves the prompt true; `TOUCH_ID_UNAVAILABLE=1` short-circuits to false (P-17).

## Architecture template

```
src/
  main.ts              — pre-ready boot order (P-06)
  window.ts            — secure popover (P-01, P-18)
  tray.ts              — module-scope tray (P-05)
  notifications.ts     — failed-listener-first (P-09)
  shortcuts.ts         — register + will-quit unregister (P-10)
  power.ts             — powerMonitor.on + fireForTest (P-08)
  protocol.ts          — strict deep-link parser (P-11)
  lifecycle.ts         — single dispatch for open-url + second-instance
  autolaunch.ts        — setLoginItemSettings wrapper
  theme.ts             — nativeTheme observer
  dock.ts              — dock.setBadge / dock.hide
  biometric.ts         — Touch ID + env-flag seams (P-17)
  passphrase.ts        — PBKDF2 fallback (P-16)
  log.ts               — structured JSON-lines (PB-07)
  ipc.ts               — registry + validators (P-02)
  ipc-validation.ts    — IpcValidationError + per-channel validators
  security.ts          — navigation + permission guards
  preload.ts           — narrow contextBridge surface (AP-02)
  renderer/
    index.html         — strict CSP
    renderer.ts
    renderer.d.ts      — declared in tsconfig "files" (G-02)
```

## Required env vars for tests

```
LOG_DIR                       fresh log directory per test
USER_DATA_DIR                 fresh userData per test
NODE_ENV=test                 gates `test:*` IPC channels
TOUCH_ID_UNAVAILABLE=1        forces canPromptTouchID() → false
TOUCH_ID_FORCE_AVAILABLE=1    forces canPromptTouchID() → true
DIALOG_STUB=1                 stubs dialog.showOpenDialog / showSaveDialog
DIALOG_STUB_MODE=pick|cancel  determines stub return value
PULSE_DB_PATH                 overrides journal.db location
CRASH_URL                     overrides crashReporter submitURL
UPDATE_URL                    overrides electron-updater feed URL
```

## Required pre-ready scaffolding

```typescript
// src/main.ts — module-load scope BEFORE app.whenReady
startCrashReporter({ /* ... */ })
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.setAsDefaultProtocolClient('pulse')
app.on('open-url', (event, url) => { /* route */ })
app.on('second-instance', (_event, argv) => { /* route */ })

app.whenReady().then(() => {
  app.dock.hide()    // BEFORE first BrowserWindow (BT-C-10)
  installTray(...)
  installNotifications(...)
  installShortcuts(...)
  // ...
  registerIpc(ipcMain, ctx)
  createMainWindow()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
```

## Evidence

- `03_pocs/L-capstone-pulse/poc-report.md`
- `03_pocs/L4-deep-macos-integration/poc-report.md`
- `01_research/01-capabilities-overview.md`
- `01_research/15-system-preferences-touchid.md`
- `01_research/12-dock-and-autolaunch.md`
