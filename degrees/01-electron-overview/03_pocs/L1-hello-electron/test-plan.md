# L1 — Test Plan

Behavioral tests (BT) come straight from the L1 contract in `00_metadata/poc-plan.md`.
Regression tests (R) protect implementation invariants that BTs alone don't pin down.

All tests run on `darwin` (macOS); darwin-only behaviors are explicitly `test.skip`-ed
on other platforms with a documented reason.

---

## BT-L1-1 — App launches with exactly one BrowserWindow, renderer DOMContentLoaded fires

- **Given** the app is launched under Playwright `_electron` with `args: [POC_ROOT]`,
- **When** Playwright awaits `electronApp.firstWindow()` and the page reaches `domcontentloaded`,
- **Then** `BrowserWindow.getAllWindows().length === 1` and `document.readyState !== 'loading'`.
- **Asserted in**: `tests/e2e/boot.spec.ts` — `BT-L1-1: app launches with exactly one BrowserWindow and renderer DOMContentLoaded fires`
- **Why it matters**: the entire degree is predicated on a single main + single renderer model. If the renderer never paints, every downstream POC is dead in the water.
- **Expected failure before implementation**: `firstWindow()` times out after 30s because the stub `main.ts` never calls `createMainWindow()`.

---

## BT-L1-2 — Renderer announces ready via IPC; main logs userAgent

- **Given** the renderer has finished `DOMContentLoaded` and `window.api.rendererReady(navigator.userAgent)` has fired,
- **When** the test polls the log file for an `event === 'renderer:ready'` entry,
- **Then** the entry is `{ level: 'info', module: 'ipc', payload: { userAgent: <non-empty string> } }`.
- **Asserted in**: `tests/e2e/boot.spec.ts` — `BT-L1-2: renderer announces ready via IPC and main logs renderer:ready with userAgent`
- **Why it matters**: this is the first end-to-end IPC test for the degree. It proves contextBridge exposure, ipcMain.on registration, and structured-log emission all work together.
- **Expected failure before implementation**: log file never contains `renderer:ready` because preload exposes nothing and main registers no handler.

---

## BT-L1-3 — On darwin, closing the only window does NOT quit the app

- **Given** the app is running with exactly one BrowserWindow open on `darwin`,
- **When** `BrowserWindow.getAllWindows().forEach(w => w.destroy())` is called and the window count reaches 0,
- **Then** `app.isReady()` still returns `true` and the `__l1Quitting` flag (set in `before-quit`) is still `false`.
- **Asserted in**: `tests/e2e/boot.spec.ts` — `BT-L1-3: on darwin, closing the only window does NOT quit the app`
- **Why it matters**: macOS convention diverges from Windows/Linux here. Future POCs (tray-only apps in L4 / capstone) depend on this guard being in place.
- **Expected failure before implementation**: stub `main.ts` has no `window-all-closed` listener so default behavior may quit; in the RED commit the test fails earlier because no window exists.

---

## BT-L1-4 — Structured log emits app:starting → app:ready → window:created → renderer:ready in order

- **Given** the app has booted and the renderer has reached `renderer:ready`,
- **When** the test reads all lines from the log file and locates each of the four canonical events,
- **Then** they appear in the documented order (by line index), and every entry conforms to the JSON-lines contract (`ts` ISO-8601-UTC, `level` ∈ {debug,info,warn,error}, `process` ∈ {main,renderer,preload,utility}, `module` string, `event` string).
- **Asserted in**: `tests/e2e/boot.spec.ts` — `BT-L1-4: structured log emits app:starting → app:ready → window:created → renderer:ready in order`
- **Why it matters**: the observability strategy stipulates these four entries as the L1 instrumentation minimum. Future POCs read this format to assert their own log invariants.
- **Expected failure before implementation**: log file does not exist (stub never writes).

---

## R-L1-1 — window-all-closed on darwin does NOT invoke app.quit()

- **Given** the app is running on `darwin` with one BrowserWindow open and `renderer:ready` has been logged,
- **When** all windows are destroyed and a 500 ms grace period elapses,
- **Then** the log file contains **no** `app:before-quit` entry and `app.isReady()` still returns `true`.
- **Asserted in**: `tests/e2e/regression.spec.ts` — `R-L1-1`
- **Why it matters**: BT-L1-3 checks `app.isReady` after window close. This regression test additionally proves that we never *attempted* to quit (the `before-quit` event would have logged if `app.quit()` had been called). If a future refactor changes the `window-all-closed` listener to unconditionally `app.quit()`, this test fails before BT-L1-3 does.

---

## R-L1-2 — window.api shape

- **Given** the renderer has finished loading,
- **When** the test evaluates `Object.keys(window.api).sort()`,
- **Then** the result is `['logPath', 'ping', 'rendererReady']`, each typed `'function'`.
- **Asserted in**: `tests/e2e/regression.spec.ts` — `R-L1-2`
- **Why it matters**: if `contextBridge.exposeInMainWorld` breaks (e.g. preload throws silently under sandbox), the boot tests might pass via the log path while the renderer surface is empty. This test pins the contextBridge surface explicitly.

---

## R-L1-3 — createMainWindow runs after app.whenReady resolves

- **Given** the app has booted normally,
- **When** the test reads all log entries and locates `app:starting`, `app:ready`, and `window:created` by index,
- **Then** the index order is `starting < ready < created` AND the timestamps are monotonically non-decreasing (`<=`).
- **Asserted in**: `tests/e2e/regression.spec.ts` — `R-L1-3`
- **Why it matters**: it is a common Electron mistake to construct a `BrowserWindow` before `app.whenReady()` resolves. The Electron runtime crashes on this. This test guards against a code change that moves the `createMainWindow()` call out of the `whenReady` callback.

---

## R-L1-4 — app:ping IPC handler

- **Given** the app is running and the renderer can call `window.api.ping()`,
- **When** the test invokes `window.api.ping()` from renderer scope,
- **Then** the result is `{ pong: true, ts: <positive number> }`.
- **Asserted in**: `tests/e2e/regression.spec.ts` — `R-L1-4`
- **Why it matters**: `app:ping` is reused by future POCs as a liveness probe (its name is namespaced `app:` for that reason). If the response shape changes, downstream tests fail with cryptic errors; this test puts the failure here at L1.

---

## Unit tests (vitest)

### tests/unit/log.test.ts (10 tests)

- `logFilePath` default + override.
- Every `info/debug/warn/error` call produces exactly one JSON line with the contract fields.
- Multi-write order preservation.
- `minLevel` filtering at `info` and `warn`.
- Custom `fileName` writes to the chosen file (not `main.log`).
- `logDir` directory is created lazily if missing.
- Payloads survive JSON round-trip (nested objects, arrays, booleans).
- `process` field reflects the configured process tag.

### tests/unit/ipc-channel-names.test.ts (4 tests)

- Each `IPC_CHANNELS` value matches the documented string literal.
- All values follow the `verb:noun` regex with exactly one colon.
- Values are unique.
- Preload's inlined channel constants do not drift from `IPC_CHANNELS`.

---

## Out of scope for L1 (deferred)

- **Hot reload behavior**: the L1 prompt exempted this from the green/regression gate. Will be revisited when a bundler enters the toolchain.
- **Renderer-side `electron-log` forwarding** (observability-strategy.md §6): deferred to L4 along with the rest of the electron-log migration.
- **CSP violation reports**: L1 sets a strict CSP meta tag but doesn't yet route `report-to`. L2 handles this.
- **Renderer e2e with packaged binary**: L1 only exercises the unpackaged path. The packaged-binary smoke test arrives at L5.
