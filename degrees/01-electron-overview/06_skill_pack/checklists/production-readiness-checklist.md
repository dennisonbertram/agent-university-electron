# Production-Readiness Checklist — Electron App

Items that must be true BEFORE the bundle leaves your machine.

## Packaging

| # | Item | How to Verify |
|---|---|---|
| 1 | `asar: true` in `packagerConfig` | `ls <App>.app/Contents/Resources/app.asar` — file must exist |
| 2 | Dev files excluded via `ignore` regex | `npx @electron/asar list app.asar` — no `.ts`, no `tests/`, no `forge.config.ts` |
| 3 | Native modules unpacked from asar | `ls <App>.app/Contents/Resources/app.asar.unpacked/node_modules/` |
| 4 | `Info.plist` carries `CFBundleURLTypes` AND version string | `plutil -p <App>.app/Contents/Info.plist \| grep CFBundle` |
| 5 | `package.json` version is correct (not `0.0.0` or test version) | Read `package.json` |

## Code Signing

| # | Item | How to Verify |
|---|---|---|
| 6 | Signed with Developer ID Application certificate | `codesign --verify --deep --strict <App>.app` → exit 0 |
| 7 | Hardened runtime enabled | `codesign --display --verbose=4 <App>.app` → check flags |
| 8 | Required entitlements in plist | `codesign --display --entitlements - <App>.app` |
| 9 | Notarized via `xcrun notarytool submit --wait` | `xcrun stapler validate <App>.app` → "The validate action worked!" |
| 10 | Notarization ticket stapled | Same as above |
| 11 | Gatekeeper passes | `spctl --assess --type exec --verbose <App>.app` → "accepted" |

## Fuses

| # | Item | How to Verify |
|---|---|---|
| 12 | All 6 hardening fuses set | Static check `forge.config.ts`; see [security-checklist.md](./security-checklist.md) items 17-22 |

## Auto-Update

| # | Item | How to Verify |
|---|---|---|
| 13 | `electron-updater` wired with feed URL | Source check in `updater.ts` |
| 14 | All 6 updater events logged | Code review: `update-available`, `update-not-available`, `update-downloaded`, `error`, `checking-for-update`, `download-progress` |
| 15 | Local update smoke test passes | Run BT-upd test: `updater:update-available` fires for newer-version manifest |
| 16 | Update server strips `?noCache` query | `curl "http://<server>/latest-mac.yml?noCache=abc"` → returns manifest |
| 17 | `forceDevUpdateConfig = true` in dev builds only | Code review: set in `updater.ts`, not behind `isPackaged` guard |

## crashReporter

| # | Item | How to Verify |
|---|---|---|
| 18 | `crashReporter.start()` called BEFORE `app.whenReady()` | Source check: `start()` at module-load scope in `main.ts`; E2E: `startedBeforeWhenReady: true` in log |
| 19 | `submitURL` set OR `uploadToServer: false` | Source check in `crash.ts` |

## Observability

| # | Item | How to Verify |
|---|---|---|
| 20 | Structured JSON-lines logs in `app.getPath('logs')/main.log` | Launch packaged app; check log file |
| 21 | Renderer-side logs forwarded to main | E2E test: trigger renderer action; verify in main.log |

## Lifecycle

| # | Item | How to Verify |
|---|---|---|
| 22 | `requestSingleInstanceLock()` at module scope BEFORE `whenReady` | Source position check |
| 23 | `open-url` listener registered BEFORE `whenReady` | Source position check |
| 24 | Deep-link scheme in `packagerConfig.protocols` OR `extendInfo.CFBundleURLTypes` (not both) | `plutil -p <App>.app/Contents/Info.plist` |
| 25 | `LSUIElement: true` for menu-bar-only apps | `plutil -p <App>.app/Contents/Info.plist \| grep LSUIElement` |
| 26 | `app.dock.hide()` called BEFORE first BrowserWindow in dev | Source position check; E2E: `dock:hidden` log before `window:created` |

## Tray (Menu-Bar Apps)

| # | Item | How to Verify |
|---|---|---|
| 27 | Tray reference is module-scope `let trayInstance` | Static check `src/tray.ts` |
| 28 | Template-image PNG assets present with correct naming | `ls assets/tray-*-Template.png` |
| 29 | Bundler preserves `Template` suffix in asset filenames | Check built output; no hashed filenames |

## Auto-Launch

| # | Item | How to Verify |
|---|---|---|
| 30 | `setLoginItemSettings` round-trips on signed build | Manual smoke test on macOS 13+ with signed packaged app |

## Global Shortcuts

| # | Item | How to Verify |
|---|---|---|
| 31 | `globalShortcut.unregisterAll()` in `will-quit` | Static check `src/shortcuts.ts` |

## Notifications

| # | Item | How to Verify |
|---|---|---|
| 32 | `notification.on('failed', ...)` before `notification.show()` | Static check `src/notifications.ts` |

## Test Seams

| # | Item | How to Verify |
|---|---|---|
| 33 | No `test:*` channels accessible in packaged production build | E2E test against packaged build: invoke `test:*` channel; assert rejects |

Back to [../index.md](../index.md)

Evidence: `../../05_distillation/production-readiness-checklist.md`
