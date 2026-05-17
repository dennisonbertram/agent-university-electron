# Distilled Principles — Electron App Development

The 18 principles that survived L1-L5 + the Pulse capstone. Each is a one-line declaration with the justification and evidence pointer that earned it a slot.

---

## 1. Secure defaults are non-negotiable

Every BrowserWindow must keep `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. Changing any of these is a security regression — document the reason and add a regression test if you must (evidence: `01_research/05-security-model.md` lines 6-20; `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 2).

## 2. Pre-ready ordering is load-bearing

`requestSingleInstanceLock()`, `crashReporter.start()`, `setAsDefaultProtocolClient()`, the `open-url` listener, and `app.dock.hide()` (where relevant) must all run at module-load scope BEFORE `app.whenReady().then(...)`. Wrapping boot in an async function silently breaks cold-launch deep links, second-instance routing, and renderer-crash capture (evidence: `03_pocs/L-capstone-pulse/src/main.ts` lines 1-100; `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 1).

## 3. Every IPC channel needs a validator

Free-form `ipcMain.handle` callbacks are an attack surface. Wrap each handler in `validate(arg) → handler(validatedArg)` and emit a structured `ipc:<ch>:validation-failed` log on rejection (evidence: `03_pocs/L2-secure-ipc/src/ipc.ts`; `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 1).

## 4. Sandbox preload is allergic to relative requires

Under `sandbox: true`, `require('./ipc')` silently aborts the preload before `contextBridge.exposeInMainWorld` runs. Either bundle the preload with esbuild (`external: ['electron']`) or inline the constants and add a drift-detector unit test (evidence: `04_logs/expectation-gap-ledger.md#entry-1`; `04_logs/decision-log.md#decision-5`).

## 5. Errors do not round-trip across IPC

Electron's `ipcMain.handle` forwards only `Error.message`. `Error.name` is stripped on the renderer side AND when re-thrown across contextBridge. Encode the typed error name via a sentinel prefix in the message; throw a plain object `{ name, message }` from preload — never an Error instance (evidence: `04_logs/expectation-gap-ledger.md#entry-3`; `04_logs/decision-log.md#decision-6`).

## 6. Tray references must live at module scope

A local `const tray = new Tray(...)` is collected by V8 within seconds and the icon disappears with no error. Always assign to `let trayInstance: Tray | null` at module scope (evidence: `01_research/21-failure-modes.md#FM-04`; `03_pocs/L4-deep-macos-integration/src/tray.ts:27`).

## 7. Every Notification needs a `failed` listener BEFORE `.show()`

On unsigned dev macOS, notifications fail silently — `failed` is the only observable. Wiring the listener after `.show()` is a race condition (evidence: `01_research/21-failure-modes.md#FM-05`; `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`).

## 8. globalShortcut.unregisterAll() in `will-quit` or you leak

If you do not unregister on quit, accelerators stay reserved against the OS-level lookup table across restarts on some macOS versions. Pair every `globalShortcut.register` with a `will-quit` cleanup (evidence: `03_pocs/L-capstone-pulse/src/shortcuts.ts:68-77`; `04_logs/decision-log.md#decision-10`).

## 9. Deep links require packaging on macOS

`open-url` does not fire for unpackaged binaries — even `process.defaultApp` registration succeeds silently. Use programmatic `app.emit('open-url', evt, url)` for dev tests and defer real OS routing to a packaged build (evidence: `01_research/11-deep-links-protocol.md` lines 14-16; `01_research/21-failure-modes.md#FM-06`; `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-7 row).

## 10. Native modules track Electron's V8 — sometimes worse

A native module published "now" can already be too stale for the latest Electron. `better-sqlite3@12.10.0` did not compile against Electron 42's V8 14.x without three preprocessor-guarded source patches. Plan for `electron-rebuild` AND a patch path (evidence: `04_logs/expectation-gap-ledger.md#entry-12`; `04_logs/debugging-log.md` 2026-05-17 session).

## 11. Two ABIs require two rebuilds

Once `better-sqlite3` is rebuilt for Electron's NODE_MODULE_VERSION 146, system Node 24 (ABI 137) cannot load it. If your test runner needs the same module under system Node, switch the binary per test class (`pretest` rebuilds for Node, `pretest:e2e` rebuilds for Electron) or move inspection through an IPC seam (evidence: `04_logs/decision-log.md#decision-12`; `04_logs/debugging-log.md` 2026-05-17 §"Test ABI dance").

## 12. Use env-var seams, not source-code conditionals scattered everywhere

`LOG_DIR`, `USER_DATA_DIR`, `DIALOG_STUB`, `TOUCH_ID_FORCE_AVAILABLE`, `NODE_ENV === 'test'` — concentrate test seams behind named env vars with a single read site. Each seam is small, controllable, and survives refactors (evidence: `04_logs/decision-log.md#decision-3`, `decision-8`, `decision-9`, `decision-10`).

## 13. Test-only IPC channels are a legitimate pattern

When real OS events (powerMonitor.suspend, notification action click, second-instance, open-url, key event) cannot be driven from Playwright, register `test:*` IPC channels gated by `NODE_ENV === 'test'` OR a flag env var. They reuse the production validator+handler plumbing — they ARE production channels, just registered conditionally (evidence: `04_logs/decision-log.md#decision-10`, `decision-12`; `03_pocs/L-capstone-pulse/poc-report.md` §"What's exercised by what mechanism").

## 14. Structured JSON-lines logs are the test contract

Every behavioral test ultimately greps a log marker. If logs are unstructured, tests become brittle. Standardize on `{ ts, level, process, module, event, payload? }` and read the file after each action with deterministic synchronous writes (electron-log buffers — use sync writes during tests) (evidence: `02_planning/observability-strategy.md` lines 30-42; `04_logs/decision-log.md#decision-2`).

## 15. Fuses harden — flip them all to "off"

`RunAsNode: false`, `EnableCookieEncryption: true`, `EnableNodeOptionsEnvironmentVariable: false`, `EnableNodeCliInspectArguments: false`, `EnableEmbeddedAsarIntegrityValidation: true`, `OnlyLoadAppFromAsar: true`. Skipping fuses leaves your packaged binary abusable as a node interpreter (evidence: `03_pocs/L5-packaging-signing-update/forge.config.ts:225-233`; `01_research/05-security-model.md` lines 157-170).

## 16. crashReporter must start BEFORE whenReady

Renderers spawned before `crashReporter.start()` are not monitored — even if you start it later. Module-load-scope call site, with a try/catch so a single crash doesn't break the boot path (evidence: `01_research/21-failure-modes.md#FM-12`; `01_research/19-crash-reporting-and-observability.md` lines 41-45; `03_pocs/L5-packaging-signing-update/poc-report.md` R-L5-1).

## 17. `webUtils.getPathForFile(file)` replaces `file.path` since Electron 32

The nonstandard `File.path` property was removed in Electron 32. Always route drag-drop paths through a preload-exposed `webUtils.getPathForFile` wrapper (evidence: `01_research/21-failure-modes.md#FM-15`; `01_research/22-version-compatibility.md` lines 48-51).

## 18. `packagerConfig.protocols` OVERRIDES `extendInfo.CFBundleURLTypes`

Forge does not merge URL-type declarations — `protocols` wins, `extendInfo.CFBundleURLTypes` is silently dropped. Either declare the scheme exclusively via `protocols` (no role/icon metadata) or move everything into `extendInfo` and drop `protocols` (evidence: `04_logs/expectation-gap-ledger.md#entry-8`; `03_pocs/L5-packaging-signing-update/poc-report.md` Entry 8).
