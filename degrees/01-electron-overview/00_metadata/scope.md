# Scope — 01-electron-overview

## In Scope

- Electron three-process mental model (main, renderer, preload), lifecycle, and IPC patterns
- Secure renderer defaults: `contextIsolation`, `sandbox`, `nodeIntegration: false`, CSP, navigation guards, permission handlers
- Typed IPC via `contextBridge`: invoke/handle, send/on, MessagePort
- Storage: `app.getPath('userData')`, JSON persistence, SQLite via `better-sqlite3`, `safeStorage` encryption
- Native I/O: file dialogs (`dialog.showOpenDialog`/`showSaveDialog`), drag-and-drop, file watchers, application + context menus
- **macOS deep integration**: Tray (status bar) with template images and dynamic state, native Notifications with action buttons and reply input, `globalShortcut`, `powerMonitor` (suspend/resume/idle), single-instance lock + `second-instance` event, app lifecycle events, custom URL scheme deep links, dock badge + dock menu, `app.setLoginItemSettings` for auto-launch, `nativeTheme`, `app.addRecentDocument`, Touch ID prompt via `systemPreferences.promptTouchID` (verify availability)
- Packaging: electron-forge with makers for DMG and ZIP, universal arm64+x64 binary, code signing config (entitlements, hardened runtime), notarization flow (simulated if no Apple Developer account)
- Auto-update: `electron-updater` or built-in `autoUpdater` (Squirrel.Mac), update channel manifest validation against local fixture
- Crash reporting: `crashReporter` wired to a local sink
- Testing: behavioral tests via `bun:test` or `vitest` (decide in Phase 1); Playwright `_electron` for capstone e2e
- Observability: structured logging in main + renderer, log file rotation, surfacing logs via DevTools and a debug menu
- Capstone: a packaged, runnable menu-bar app that exercises every prior subsystem in concert

## Out of Scope

- Building Electron from source
- Custom Chromium forks or patches
- Linux-specific packaging beyond noting how it differs
- Windows-specific signing or MSIX packaging
- Cross-runtime alternatives (Tauri, NW.js, Wails) except as expectation-gap entries
- Mobile / Capacitor
- Production CI/CD pipeline to ship the capstone to real users
- A live update server (use a local manifest fixture)
- Performance benchmarking beyond functional verification
- Apple Developer account-dependent flows when no credentials are provided — document them as simulated

## Tech Choices and Fallbacks

| Concern | Primary | Fallback |
|---------|---------|----------|
| Framework | Electron (latest stable) | none — Electron is the target |
| Toolchain | electron-forge | electron-builder if forge blocks the macOS notarization flow |
| Language | TypeScript (strict) | none |
| Test runner | TBD in Phase 1 — `vitest` likely (broader native-module compat) | `bun:test` if compat allows; `jest` as last resort |
| E2E for capstone | Playwright `_electron` | spectron (deprecated — only if Playwright blocks) |
| Local DB (capstone) | `better-sqlite3` (native) | `sql.js` (pure WASM) if native rebuild blocks |
| Encryption-at-rest | `safeStorage` | `keytar` if `safeStorage` unavailable on target macOS version |
| Auto-update | `electron-updater` | built-in `autoUpdater` (Squirrel.Mac) |
| Native module rebuild | `@electron/rebuild` via forge plugin | `electron-rebuild` (legacy) |

Each fallback choice is recorded with its trigger condition in `04_logs/decision-log.md` if exercised.
