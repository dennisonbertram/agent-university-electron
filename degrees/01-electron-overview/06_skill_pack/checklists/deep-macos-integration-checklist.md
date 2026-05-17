# Deep macOS Integration Checklist

For apps that use tray, notifications, deep links, shortcuts, powerMonitor, Touch ID, or Service Management.

## Pre-Build

| # | Item | How to Verify |
|---|---|---|
| 1 | Code-signing plan in place before writing notification code | Notifications fail silently unsigned — design for this from day 1 |
| 2 | Deep-link testing strategy decided (packaging required, OR test seam) | Source check: `testEmitOpenUrl` test seam exists |
| 3 | `LSUIElement: true` set in `extendInfo` for menu-bar-only apps | `forge.config.ts` static check |
| 4 | Per-state template PNG assets prepared with `Template` suffix | `ls assets/tray-*-Template.png` |

## Tray

| # | Item | How to Verify |
|---|---|---|
| 5 | `let trayInstance: Tray \| null` at module scope (not function-local) | Static check `src/tray.ts` first line |
| 6 | Tray image path uses `process.resourcesPath` in packaged builds | Source check for packaged/unpackaged path branching |
| 7 | Template image filename ends in `Template` | Asset file listing |
| 8 | Bundler does NOT hash/rename asset files | Build output check |

## Notifications

| # | Item | How to Verify |
|---|---|---|
| 9 | `notification.on('failed', ...)` before `notification.show()` | Static check `src/notifications.ts` |
| 10 | `failed` handler logs `notification:failed` marker | E2E test: expect either `notification:shown` or `notification:failed` |
| 11 | Action button handler registered before `show()` | Code review for notification action callbacks |
| 12 | Notification test coverage uses log-marker assertions (not OS display) | E2E test structure |

## Global Shortcuts

| # | Item | How to Verify |
|---|---|---|
| 13 | `globalShortcut.register()` return value checked | Source check: `if (!registered) logger.warn(...)` |
| 14 | `globalShortcut.unregisterAll()` in `will-quit` | Static check `src/shortcuts.ts` |
| 15 | Test seam `fireForTest` method exists for Playwright testing | Source check `src/shortcuts.ts` |

## Deep Links

| # | Item | How to Verify |
|---|---|---|
| 16 | `setAsDefaultProtocolClient` at module scope BEFORE `whenReady` | Source position check |
| 17 | `open-url` listener at module scope BEFORE `whenReady` | Source position check |
| 18 | Strict URL parser (`parseDeepLink`) with unit tests for boundary cases | Unit tests: valid, wrong scheme, empty action, malformed URL |
| 19 | `packagerConfig.protocols` OR `extendInfo.CFBundleURLTypes` — NOT both | Static check for both being used simultaneously (G-09) |
| 20 | Test seam `testEmitOpenUrl` for Playwright testing | Source check test IPC registry |

## powerMonitor

| # | Item | How to Verify |
|---|---|---|
| 21 | `powerMonitor` accessed inside `whenReady` (not module scope) | Source position check |
| 22 | Test seam for `powerMonitor.emit(event)` | Source check test IPC registry |
| 23 | `suspend` and `resume` handlers log structured markers | E2E test with test seam |

## Touch ID

| # | Item | How to Verify |
|---|---|---|
| 24 | `canPromptTouchID()` called before `promptTouchID()` | Code review `src/biometric.ts` |
| 25 | Env-flag seams: `TOUCH_ID_UNAVAILABLE=1` and `TOUCH_ID_FORCE_AVAILABLE=1` | E2E tests for both branches |
| 26 | `com.apple.security.cs.disable-library-validation` in entitlements | `entitlements.mac.plist` check |

## Auto-Launch

| # | Item | How to Verify |
|---|---|---|
| 27 | `setLoginItemSettings` tests assert request side only (not read-back) | Test does NOT assert `getLoginItemSettings().openAtLogin === true` in dev |
| 28 | Manual smoke test on signed packaged build for round-trip | Sign the app; test System Settings → Login Items |

## Dock

| # | Item | How to Verify |
|---|---|---|
| 29 | `app.dock.hide()` called BEFORE `createMainWindow()` inside `whenReady` | Source position check |
| 30 | All `app.dock.*` calls wrapped in `if (process.platform === 'darwin')` | Source check for platform guard |

Back to [../index.md](../index.md)

Evidence: `../../05_distillation/before-you-build/BYB-02-electron-on-macos-deep-integration.md`
