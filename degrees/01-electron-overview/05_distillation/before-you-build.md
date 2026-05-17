# Before You Build — Electron App

Read this in full before writing `new BrowserWindow(...)`. 18 actionable warnings, each with the evidence pointer to where it was earned.

---

## 1. Pin your Electron version

`"electron": "42.1.0"` — not `"^42"`. Each major bump can change Chromium, V8, Node, AND native-module ABI in one step (evidence: `01_research/22-version-compatibility.md` lines 83-89).

## 2. Decide your build chain before you start

Forge + Vite buys you HMR + canonical packaging but adds ~150 transitive deps and obscures the secure-defaults wiring. `tsc + esbuild + forge` (hybrid) keeps the wiring visible. Pick before line 1 — switching mid-project costs a day (evidence: `04_logs/decision-log.md#decision-1`, `decision-11`).

## 3. Decide your security defaults BEFORE the first BrowserWindow

`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. Decide them, document them, hand-write the `SECURE_WEB_PREFERENCES` constant, and make every BrowserWindow construction go through one `createMainWindow()` factory. Add a regression test that fails if the constant is weakened (evidence: `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 2; `01_research/05-security-model.md` lines 6-20).

## 4. Decide your pre-ready ordering BEFORE you write `main.ts`

Single-instance lock, crashReporter, protocol-client registration, `open-url` listener, `second-instance` listener, `dock.hide()` — all of these MUST execute at module-load scope before `app.whenReady().then(...)`. Refactoring a working app to "async boot" silently breaks them all (evidence: `03_pocs/L-capstone-pulse/src/main.ts` lines 1-100; `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 1).

## 5. Set up structured JSON-lines logging on day 1

Every behavioral test ends up grep'ing a log marker. If you start with `console.log`, your test suite has to switch later. Use `electron-log` (with `transports.file.format = JSON.stringify`) — or hand-roll a synchronous logger with the same `{ ts, level, process, module, event, payload? }` shape (evidence: `02_planning/observability-strategy.md` lines 30-42; `04_logs/decision-log.md#decision-2`).

## 6. Write an `LOG_DIR` and `USER_DATA_DIR` env-var seam

Each Playwright test needs a fresh log file AND a fresh `userData/`. Read `process.env.LOG_DIR` / `process.env.USER_DATA_DIR` and apply `app.setPath('userData', dir)` BEFORE `app.whenReady`. Without this you cannot iterate on tests (evidence: `04_logs/decision-log.md#decision-3`, `decision-8`).

## 7. Before you import anything in preload.ts under `sandbox: true`

Sandboxed preload cannot `require()` arbitrary npm packages OR relative TS files. Either bundle with esbuild (`external: ['electron']`) or inline the constants. If you skip this, your `window.api` will silently be `undefined` and tests will time out (evidence: `04_logs/expectation-gap-ledger.md#entry-1`).

## 8. Before you use `tsc -p tsconfig.json` with ambient `.d.ts`

A `.d.ts` file with only global augmentations and no `module exports` is NOT picked up by the `include: ["src/**/*.ts"]` glob. List it explicitly in `"files": [...]` or add a `///<reference />` from a `.ts` file (evidence: `04_logs/expectation-gap-ledger.md#entry-2`).

## 9. Before you call `new Notification(...)`, attach `.on('failed', ...)`

On unsigned dev macOS, every notification fails silently. The `failed` event is the only observable. Wire it BEFORE `.show()` — order matters (evidence: `03_pocs/L-capstone-pulse/src/notifications.ts:83-89`; `01_research/21-failure-modes.md#FM-05`).

## 10. Before you write `new Tray(icon)`, declare a module-scope ref

`let trayInstance: Tray | null = null` at module scope. Otherwise the icon disappears within seconds, with no error (evidence: `01_research/21-failure-modes.md#FM-04`; `03_pocs/L4-deep-macos-integration/src/tray.ts:27`).

## 11. Before you ship a native module — `electron-rebuild` is not enough

Native modules can lag Electron's V8 by a major version. `better-sqlite3@12.10.0` does not compile against Electron 42's V8 14.x out of the box. Plan for a preprocessor-guarded source patch as a `postinstall` step (evidence: `04_logs/expectation-gap-ledger.md#entry-12`; `04_logs/debugging-log.md` 2026-05-17 session).

## 12. Before you ship a native module, decide the test ABI strategy

Once the module is rebuilt for Electron's ABI, system Node cannot load it. Decide up-front: (a) two `pretest`/`pretest:e2e` rebuilds, (b) an IPC seam for in-process inspection, (c) do not unit-test the module under system Node (evidence: `04_logs/decision-log.md#decision-12`; `01_research/21-failure-modes.md#FM-02`).

## 13. Before you call `app.setLoginItemSettings`

Round-trip is non-deterministic on unsigned dev under macOS 14+. Assert the request side; defer state-read assertions to a signed packaged build OR include a user-facing nudge to System Settings → Login Items (evidence: `04_logs/expectation-gap-ledger.md#entry-5`; `01_research/21-failure-modes.md#FM-09`).

## 14. Before you stand up an electron-updater dev fixture server

`electron-updater` appends `?noCache=<random-token>` to every feed URL. Strip the query string before path-matching, and set `forceDevUpdateConfig = true` on the autoUpdater singleton, otherwise it short-circuits in unpackaged dev mode (evidence: `04_logs/expectation-gap-ledger.md#entry-7`, `#entry-9`).

## 15. Before you wire a custom protocol in `forge.config.ts`

`packagerConfig.protocols` OVERRIDES `extendInfo.CFBundleURLTypes`. Either declare the scheme via `protocols` (no role/icon metadata) OR drop `protocols` entirely and put the full CFBundleURLTypes array in `extendInfo`. Mixing them silently loses metadata (evidence: `04_logs/expectation-gap-ledger.md#entry-8`).

## 16. Before you trust drag-drop with `file.path`

`File.path` was removed in Electron 32. Expose `webUtils.getPathForFile(file)` via preload and route drag-drop through it. Otherwise your code works on dev machines with stale Electron and breaks on upgrade (evidence: `01_research/22-version-compatibility.md` lines 48-51; `01_research/21-failure-modes.md#FM-15`).

## 17. Before you use Playwright with `test-results/`

`playwright test` wipes `test-results/` at the start of each run, eating any file you redirected stdout to. Use a sibling directory (`test-output/`) or pipe through `tee` (evidence: `04_logs/expectation-gap-ledger.md#entry-10`).

## 18. Before `forge.config.ts`'s `packageAfterCopy` hook

The `buildPath` argument is the COPIED STAGING DIR inside Forge's temp tree, NOT the final `.app` bundle. Anything written to `buildPath` ends up inside `app.asar`. Write to absolute paths under your source tree if you want git tracking (evidence: `04_logs/expectation-gap-ledger.md#entry-11`).
