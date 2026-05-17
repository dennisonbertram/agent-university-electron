# POC Plan — 01-electron-overview

Progressive levels. Each introduces ONE primary concept (or a tightly-coupled cluster). Each reuses prior levels' code where useful. Capstone combines everything.

---

## L1 — Hello Electron (smoke test)

- **Goal**: Confirm a minimal Electron app boots: main process spawns one BrowserWindow, renderer loads an HTML page, devtools open, hot reload works.
- **Introduces**: project layout, main/renderer split, build & run scripts, devtools, hot reload.
- **Reuses**: nothing.
- **Files**: `src/main.ts`, `src/preload.ts`, `src/renderer/index.html`, `src/renderer/renderer.ts`, `package.json`, `tsconfig.json`, `forge.config.ts` (or equivalent).
- **Behavioral tests** (Given/When/Then):
  - Given the app launches in test mode, when `app.whenReady()` resolves, then exactly one BrowserWindow exists and its `webContents` is loaded.
  - Given the renderer loads, when it reports ready via IPC, then main logs the renderer's user-agent and resolves a `renderer-ready` promise.
  - Given the user closes the window on macOS, when no other windows are open, then the app does NOT quit (macOS convention) — verify `app` is still alive.
  - Given hot reload triggers, when the renderer source changes, then the renderer reloads within N seconds and the main process is unaffected.
- **Expectation-gap watch**: Forge template choices, default security flags in templates, hot-reload library compatibility, devtools quirks.

---

## L2 — Secure IPC

- **Goal**: Establish the secure IPC + renderer-hardening baseline that every subsequent POC inherits.
- **Introduces**: `contextBridge`, `contextIsolation`, `sandbox`, `nodeIntegration: false`, CSP, `will-navigate` and `setWindowOpenHandler` guards, permission handler, typed two-way IPC (invoke/handle), main→renderer event push, IPC arg validation.
- **Reuses**: L1 layout.
- **Files**: `src/main.ts`, `src/ipc.ts`, `src/preload.ts`, `src/renderer/api.d.ts`, `src/renderer/renderer.ts`, plus tests.
- **Behavioral tests**:
  - Given a renderer call to `window.api.ping()`, when invoked, then main responds with a pong containing the server's monotonic timestamp.
  - Given a renderer attempts `window.require('fs')`, when called, then it fails with a TypeError because `nodeIntegration: false`.
  - Given the renderer attempts `window.open('https://evil.example')`, when called, then `setWindowOpenHandler` blocks it and logs the attempt to main.
  - Given an IPC handler validates args, when the renderer sends a malformed payload, then the handler rejects with a typed error and no main-process exception leaks to the renderer.
  - Given the CSP meta tag disallows inline scripts, when the renderer attempts to inject one, then a CSP report fires.
- **Expectation-gap watch**: Sandbox + preload limitations (no `require` in preload under sandbox), exact CSP report destination, `contextBridge` serialization rules.

---

## L3 — Storage & Native I/O

- **Goal**: Persist app data correctly across restarts; integrate native file/menu surfaces.
- **Introduces**: `app.getPath('userData')`, JSON file persistence with atomic writes, `dialog.showOpenDialog`/`showSaveDialog`, drag-and-drop file handling, file watchers, application menu + context menu wired via IPC commands.
- **Reuses**: L1 layout, L2 secure-IPC scaffolding.
- **Files**: `src/storage.ts`, `src/menu.ts`, `src/main.ts`, `src/renderer/...`, plus tests.
- **Behavioral tests**:
  - Given a `journal:append` IPC call, when invoked, then the entry persists to `userData/journal.json` atomically (write-rename) and a subsequent read returns it.
  - Given the user cancels the file dialog, when `dialog.showOpenDialog` resolves, then result.canceled is true and `filePaths` is empty.
  - Given a file is dragged onto the window, when dropped, then main receives an IPC with the dropped paths and the renderer never sees the raw `File` object's filesystem path.
  - Given the user clicks "Quit" in the application menu, when activated, then `app.quit()` runs and `before-quit` listeners flush state.
  - Given a watched file is renamed, when the watcher fires, then the renderer is notified via IPC within N ms.
- **Expectation-gap watch**: `userData` differences across packaged vs unpackaged, write-rename race semantics, sandbox restrictions on `dialog` paths, menu accelerator quirks across macOS versions.

---

## L4 — Deep macOS System Integration ★

This is the centerpiece of the standalone POCs. Exercises Electron's most macOS-native APIs.

- **Goal**: Wire every major macOS system surface that desktop apps typically need.
- **Introduces**:
  - **Tray / status bar**: `Tray` with template image, dynamic title text, popover-style menu, click-to-toggle state
  - **Native notifications**: `new Notification(...)` with action buttons, reply input, click handlers, sound, silent flag
  - **Global shortcuts**: `globalShortcut.register` for OS-wide hotkeys, conflict detection, cleanup on quit
  - **powerMonitor**: subscribe to `suspend`, `resume`, `idle`, `lock-screen`, `unlock-screen`, `on-battery`
  - **App lifecycle**: `before-quit`, `will-quit`, `second-instance` (via `requestSingleInstanceLock`), `activate` (dock click), `window-all-closed` (suppress quit on macOS)
  - **Deep links**: register custom protocol (`electron-l4://`), handle `open-url` event, parse deep-link payload, route to action
  - **Dock**: badge count, custom dock menu, hide/show
  - **Auto-launch on login**: `app.setLoginItemSettings({ openAtLogin })`
  - **Native theme**: `nativeTheme.shouldUseDarkColors`, `updated` event
  - **Recent documents**: `app.addRecentDocument` / `app.clearRecentDocuments`
- **Reuses**: L2 secure-IPC + L3 storage for stateful tray label.
- **Files**: `src/tray.ts`, `src/notifications.ts`, `src/shortcuts.ts`, `src/power.ts`, `src/lifecycle.ts`, `src/protocol.ts`, `src/dock.ts`, `src/autolaunch.ts`, `src/theme.ts`, `src/main.ts`, plus tests and a small renderer.
- **Behavioral tests**:
  - Given the app boots, when `app.ready` fires, then exactly one Tray icon exists with the template image and the configured initial title.
  - Given the tray state is "focused", when the renderer toggles state via IPC, then the tray title and icon update within one event-loop tick.
  - Given a notification is shown with two action buttons, when the user clicks "Reply" and types "ok", then the registered `reply` handler fires with `"ok"`.
  - Given `globalShortcut.register("CmdOrCtrl+Shift+P", handler)`, when the user presses that combo with another app focused, then the handler runs in main and emits an IPC event.
  - Given powerMonitor's `suspend` fires, when received, then a registered listener marks the app state `paused` and logs the event.
  - Given a second instance launches with a deep-link arg `electron-l4://action?x=1`, when the first instance receives the `second-instance` event, then it focuses the existing window and dispatches the parsed action.
  - Given `app.setLoginItemSettings({ openAtLogin: true })` is called, when queried, then `getLoginItemSettings().openAtLogin` is true.
  - Given the system theme switches dark→light, when `nativeTheme.updated` fires, then the renderer is notified via IPC and the tray icon updates.
  - Given quit is initiated, when `will-quit` fires, then all registered globalShortcuts are unregistered.
- **Expectation-gap watch**: Notification reply input availability + macOS-only quirks; template image sizing rules; globalShortcut conflicts with system shortcuts; `open-url` vs `second-instance` event ordering for deep links; Tray "disappearing" issues if not retained; macOS sandboxed-app limitations on `setLoginItemSettings` for non-MAS apps.

---

## L5 — Packaging, Code Signing, Auto-Update

- **Goal**: Produce a real packaged app, walk through the signing/notarization flow, wire an auto-updater against a local fixture.
- **Introduces**: electron-forge configuration, makers (DMG, ZIP), maker-universal for arm64+x64, hardened-runtime entitlements, code-sign config, notarization config (`@electron/notarize`), `electron-updater` wiring with `provider: generic` pointing at a local HTTP server serving a manifest, `crashReporter.start({ submitURL })` to a local sink.
- **Reuses**: L4 menu-bar app shell (good packaging target).
- **Files**: `forge.config.ts`, `entitlements.mac.plist`, `Info.plist` overrides, `src/updater.ts`, `src/crash.ts`, `scripts/local-update-server.ts`, plus tests.
- **Behavioral tests**:
  - Given `npm run make`, when invoked, then a `.dmg` and `.zip` artifact appear under `out/` for the current arch.
  - Given the packaged app launches, when it runs, then it boots from the packaged resources (not the dev `src/`) and tray + window appear.
  - Given no Apple Dev account is configured, when packaging runs, then signing/notarization is skipped with an explicit log message AND a `simulated-signing.md` is produced describing what would happen in production.
  - Given the local update server is running and the manifest declares version X+1, when the updater checks, then it reports an update available with the expected URL.
  - Given the updater downloads from the fixture, when complete, then `quit-and-install` is callable.
  - Given `codesign --verify` is run on a signed build, when invoked, then it returns 0 (only on machines with signing creds; otherwise skipped with a documented reason).
- **Expectation-gap watch**: Universal-binary maker quirks, native module rebuild for two arches, `electron-updater` provider config for generic backends, notarization timing (15s–30min variance), keychain access for signing in CI vs local.

---

## L-capstone — "Pulse": Menu-Bar Focus & Journal Companion ★★

The capstone is intentionally hard. It combines every prior level's lessons into a coherent, polished, packaged macOS app.

- **Concept**: A no-dock menu-bar app with two cooperating subsystems:
  1. **Focus mode** — pomodoro-style timer with global hotkey toggle, sleep-aware pause/resume, notification-driven flow control
  2. **Journal** — quick-capture text entries (from global hotkey or deep link) stored locally and encrypted, Touch-ID-gated when viewing
- **Combines**:
  - L1: TypeScript app skeleton, devtools, hot reload (dev mode)
  - L2: contextBridge-based typed IPC, full security hardening, CSP, navigation guards
  - L3: SQLite (`better-sqlite3`) storage, native menus, file-export of journal
  - L4: Tray with dynamic icon reflecting state (idle / focusing / break / paused), notifications with action buttons ("+5min", "End now", "Add note"), two global shortcuts (Cmd+Shift+P focus toggle; Cmd+Shift+J journal quick-capture), powerMonitor pause-on-sleep + idle detection, app lifecycle (single-instance lock, before-quit flushes state), deep-link scheme `pulse://`, auto-launch hidden on login, nativeTheme-aware popover styling, `app.dock.hide()` for menu-bar-only
  - L5: electron-forge packaging with universal binary, signing+notarization config (simulated path documented), `electron-updater` against local fixture, `crashReporter` to local sink
  - New for capstone: `safeStorage` encrypting journal rows; `systemPreferences.promptTouchID` gating journal view (with graceful fallback if Touch ID unavailable); a small Playwright `_electron` e2e suite exercising boot, focus-start-via-hotkey, notification action roundtrip, deep-link routing, packaged build smoke test
- **Deep links**:
  - `pulse://start?duration=25` — start a 25-minute focus session
  - `pulse://stop` — stop the current session
  - `pulse://log?text=...` — append a journal entry
- **Behavioral tests** (illustrative; full plan in `03_pocs/L-capstone-pulse/test-plan.md`):
  - Given a clean install and Cmd+Shift+P pressed with no session, when the handler fires, then a 25-min session starts, the tray icon shows the "focus" state, and main logs `focus:start`.
  - Given a focus session is running and the system sleeps, when `powerMonitor.suspend` fires, then the session pauses and the tray icon shows "paused"; on `resume`, the session continues with elapsed time excluding the sleep interval.
  - Given a notification fires with "+5min" and the user clicks it, when the action callback runs, then the active session's remaining time increases by 5 minutes.
  - Given `pulse://log?text=hello` is opened from another app, when received, then a journal row is encrypted and persisted, and a confirmation notification is shown.
  - Given the user opens the journal popover, when `systemPreferences.promptTouchID('view journal')` is called, then either Touch ID succeeds and the popover unlocks, OR a documented fallback (passphrase prompt) appears.
  - Given the app is quit and relaunched, when boot completes, then the session counter and journal entries from the previous run are restored.
  - Given `npm run make` is invoked, when complete, then the resulting .dmg launches and reproduces the menu-bar-only behavior (no dock icon).
- **Expectation-gap watch**: Popover-window positioning math, Tray menu vs popover-window ergonomics, native-module rebuild for universal binary, Touch ID availability per machine, `safeStorage` cross-version compatibility.

---

## POC Scoring (per doctrine Phase 3)

Scoring template applied to each level in `02_planning/poc-selection.md` after Phase 1:

- Coverage of major surfaces
- Gotcha-likelihood
- Integration value with other POCs
- Testing value
- Observability value
- Deployment value
- Feasibility within time budget

Capstone is intentionally scored hardest on coverage and integration value; this is the reference implementation future agents will study.
