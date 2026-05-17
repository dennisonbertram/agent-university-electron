# POC L1 — Hello Electron — Report

Built: 2026-05-17.
Outcome: **PASS** — all 4 behavioral tests and all 4 regression tests pass on
macOS 15.7.7 / arm64 with Electron 42.1.0 / Node 24.15.0.

---

## 1. What was built

A minimal Electron app under `degrees/01-electron-overview/03_pocs/L1-hello-electron/`:

- **Main process** (`src/main.ts`) — emits four lifecycle log events
  (`app:starting`, `app:ready`, `window:created`, `renderer:ready`),
  registers three IPC channels, creates exactly one BrowserWindow,
  suppresses `app.quit()` on darwin when all windows close.
- **Preload** (`src/preload.ts`) — `contextBridge.exposeInMainWorld('api', {…})`
  with three narrow methods: `rendererReady`, `ping`, `logPath`.
- **Renderer** (`src/renderer/index.html` + `renderer.ts`) — strict-CSP HTML;
  on `DOMContentLoaded` calls `window.api.rendererReady(navigator.userAgent)`.
- **Structured logger** (`src/log.ts`) — dependency-free JSON-lines logger
  whose entries conform to the contract documented in
  `02_planning/observability-strategy.md §2`.
- **Tests** — 14 vitest unit tests (logger contract, IPC channel registry,
  preload-drift cross-check) and 8 Playwright `_electron` e2e tests
  (BT-L1-1..4 + R-L1-1..4).

---

## 2. Test outcomes

### RED commit (`09ebd88`)

- Vitest: 10 of 13 tests failed (logger stub `throw`s; IPC name tests pass).
- Playwright: 4 of 4 BTs failed — `firstWindow()` timed out after 30 s on
  every test because the stub `main.ts` never created a window. Verbatim
  output in `04_logs/test-results.md` Entry 1.

### GREEN commit (`9661b22`)

- Vitest: 14 of 14 pass (added the preload-inline-channel drift check).
- Playwright: 4 of 4 BTs pass in ~2 s total. Verbatim output in
  `04_logs/test-results.md` Entry 2.

### REGRESSION commit (this commit)

- Vitest: 14/14 pass.
- Playwright: 8/8 pass (4 BTs + 4 Rs). Verbatim output in
  `04_logs/test-results.md` Entry 3.

---

## 3. Decisions made (also logged in `04_logs/decision-log.md`)

### D-1: No electron-forge / Vite at L1

The L1 prompt suggested using `create-electron-app --template=vite-typescript`.
We declined because:
- The Forge + Vite scaffold produces ~150 transitive dependencies and a
  multi-config build graph that obscures the Electron wiring under test.
- L1's goal is a smoke test of main/renderer + the secure-defaults baseline,
  not packaging. Forge's value lies at L5 (signing, makers, updater).
- `tsc` alone produces a clean `dist/` that Electron's `electron .`
  command can launch without any further machinery.

This is a deviation from the L1 prompt but matches the prompt's own
"deviate where the toolchain insists, but document deviations" clause.
L5 will introduce Forge with its own packaging tests.

### D-2: Hand-rolled JSON-lines logger, not electron-log

`02_planning/observability-strategy.md §1` makes `electron-log` the canonical
choice but explicitly notes it is **introduced at L4**. For L1 the synchronous,
zero-dependency logger in `src/log.ts` is preferred because:
- Tests need to read the log file immediately after each IPC event.
  Synchronous file writes (`appendFileSync`) are deterministic; electron-log's
  buffering would force the tests to sleep for an unknown duration.
- The output format (`{ ts, level, process, module, event, payload? }`) is the
  same JSON-lines contract electron-log emits when `transports.file.format =
  JSON.stringify` is configured. The L4 migration is a drop-in.

### D-3: Preload string literals inlined

Documented in `src/preload.ts` header and `04_logs/expectation-gap-ledger.md`
Entry 1. Sandbox preload cannot `require()` relative files; we inlined the
channel strings and added a cross-check unit test.

### D-4: `LOG_DIR` env-var override for tests

The simplest deterministic way to give each Playwright test a fresh log file.
The alternative (`app.setPath('logs', ...)`) has early-init quirks because
`app.getPath('logs')` is not stable before `app.whenReady()` on every
platform.

---

## 4. Expectation gaps logged

| # | Title                                                    | Severity |
|---|----------------------------------------------------------|----------|
| 1 | Sandbox preload cannot `require('./ipc')` — silent fail  | medium   |
| 2 | tsc `include: ["src/**/*.ts"]` does not pick up `.d.ts`  | low      |

Full entries in `04_logs/expectation-gap-ledger.md`.

---

## 5. Hot-reload status

Not implemented at L1 (the L1 prompt explicitly exempted hot-reload from the
green/regression gate). The L1 dev loop is `npm run build && npm start`. A
future POC that introduces a bundler can add `electron-vite` or `nodemon`
without touching L1's structure.

---

## 6. Time spent (informal)

- Scaffold + failing tests (RED): ~25 min
- Implementation (GREEN): ~30 min (including the preload-sandbox debug loop)
- Docs + regression tests (REGRESSION): ~25 min

Total: ~1.3 hours.

---

## 7. Recommendations for L2

1. **Reuse the test harness verbatim.** `tests/e2e/helpers.ts` (`launchApp`,
   `readLogLines`, `waitForEvent`) is generic. Copy it into L2 and extend
   rather than rewrite.
2. **Add a preload bundler.** Once L2 introduces a real IPC surface, the
   inlined-string workaround becomes a maintenance hazard. Adopt `esbuild`
   (single-file output) or move to electron-vite.
3. **Tighten the CSP at L2.** L1 ships a strict meta-tag CSP; L2 should
   additionally wire `session.webRequest.onHeadersReceived` so the policy
   is enforced for any future HTTP-served renderer surfaces.
4. **Add `will-navigate` and `setWindowOpenHandler` guards in L2.**
   These are the next two items on the security checklist.
5. **Keep the log file path stable.** L2 onwards can rely on
   `${LOG_DIR}/main.log` (or `app.getPath('logs')/main.log`) as the
   single source of truth for behavioral assertions.

---

## 8. Risks / blockers

None encountered. The single non-trivial debug step (preload `require`
failing under sandbox) was resolved in ~15 minutes and surfaced a
documented gotcha (`expectation-gap-ledger.md` Entry 1).
