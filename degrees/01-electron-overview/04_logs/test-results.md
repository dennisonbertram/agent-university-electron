# Test Results — 01-electron-overview

Captures of test runner output across POC levels. Append-only.

## Entry Format

```
## Entry N — <POC level> — <test name or batch>

- **Date**:
- **POC**:
- **Command**:
- **Status**: PASS / FAIL / SKIP
- **Output** (verbatim):
- **Notes**:
- **Linked to test-plan**:
```

## Entries

## Entry 1 — L1 — RED (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L1-hello-electron
- **Command**:
  - `npm run test` (vitest)
  - `npx playwright test`
- **Status**: FAIL (expected — RED commit `09ebd88`)
- **Output** (verbatim, excerpts):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/ipc-channel-names.test.ts (3 tests) 2ms
 FAIL  tests/unit/log.test.ts > logFilePath > Given a logDir, when called with default fileName, then returns logDir/main.log
 Error: logFilePath: not implemented (stub for RED commit)
 ❯ tests/unit/log.test.ts:32:20
 ... (9 more failures, all from createLogger stub `throw`s)
 Test Files  1 failed | 1 passed (2)
 Tests       10 failed | 3 passed (13)
```

playwright:

```
Running 4 tests using 1 worker
  ✘  1 tests/e2e/boot.spec.ts:25:5 › BT-L1-1: app launches with exactly one BrowserWindow and renderer DOMContentLoaded fires (34.8s)
  ✘  2 tests/e2e/boot.spec.ts:41:5 › BT-L1-2: renderer announces ready via IPC and main logs renderer:ready with userAgent (30.2s)
  ✘  3 tests/e2e/boot.spec.ts:56:5 › BT-L1-3: on darwin, closing the only window does NOT quit the app (30.2s)
  ✘  4 tests/e2e/boot.spec.ts:89:5 › BT-L1-4: structured log emits app:starting → app:ready → window:created → renderer:ready in order (30.2s)

  1) BT-L1-1
    TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded while waiting for event "window"
  (same TimeoutError for 2/3/4)

  4 failed
```

- **Notes**: failures are on real assertions (logger stub `throw`s; main stub creates no window → `firstWindow` times out). Not module-resolution errors.
- **Linked to test-plan**: `03_pocs/L1-hello-electron/test-plan.md` BT-L1-1..4

## Entry 2 — L1 — GREEN (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L1-hello-electron
- **Command**:
  - `npm run test`
  - `npx playwright test`
- **Status**: PASS (GREEN commit `9661b22`)
- **Output** (verbatim):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/ipc-channel-names.test.ts (4 tests) 2ms
 ✓ tests/unit/log.test.ts (10 tests) 10ms
 Test Files  2 passed (2)
 Tests       14 passed (14)
 Duration  88ms
```

playwright:

```
Running 4 tests using 1 worker
  ✓  1 BT-L1-1 (342ms)
  ✓  2 BT-L1-2 (454ms)
  ✓  3 BT-L1-3 (281ms)
  ✓  4 BT-L1-4 (480ms)
  4 passed (1.8s)
```

- **Notes**: every behavioral test now passes. The unit suite grew by 1 test
  (preload-inline-channel drift check) added during GREEN.
- **Linked to test-plan**: BT-L1-1..4 in `test-plan.md`

## Entry 3 — L1 — REGRESSION (vitest + playwright full suite)

- **Date**: 2026-05-17
- **POC**: L1-hello-electron
- **Command**:
  - `npm run test`
  - `npx playwright test`
- **Status**: PASS
- **Output** (verbatim):

vitest: 14/14 pass (unchanged from GREEN).

playwright:

```
Running 8 tests using 1 worker
  ✓  1 tests/e2e/boot.spec.ts:25:5 › BT-L1-1: app launches with exactly one BrowserWindow and renderer DOMContentLoaded fires (671ms)
  ✓  2 tests/e2e/boot.spec.ts:41:5 › BT-L1-2: renderer announces ready via IPC and main logs renderer:ready with userAgent (466ms)
  ✓  3 tests/e2e/boot.spec.ts:56:5 › BT-L1-3: on darwin, closing the only window does NOT quit the app (316ms)
  ✓  4 tests/e2e/boot.spec.ts:89:5 › BT-L1-4: structured log emits app:starting → app:ready → window:created → renderer:ready in order (482ms)
  ✓  5 tests/e2e/regression.spec.ts:41:5 › R-L1-1: window-all-closed on darwin does NOT invoke app.quit() (no app:before-quit log) (830ms)
  ✓  6 tests/e2e/regression.spec.ts:67:5 › R-L1-2: window.api.rendererReady exists in renderer scope as a function (341ms)
  ✓  7 tests/e2e/regression.spec.ts:93:5 › R-L1-3: createMainWindow is called AFTER app.whenReady resolves (log timestamps monotonic) (479ms)
  ✓  8 tests/e2e/regression.spec.ts:123:5 › R-L1-4: app:ping IPC handler responds with { pong: true, ts: number } (458ms)
  8 passed (4.3s)
```

- **Notes**: 4 regression tests added in this commit, all pass on first run.
- **Linked to test-plan**: BT-L1-1..4 and R-L1-1..4 in `test-plan.md`

## Entry 4 — L2 — RED (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L2-secure-ipc
- **Command**:
  - `npm run test` (vitest)
  - `npx playwright test`
- **Status**: FAIL (expected — RED commit `69a1499`)
- **Output** (verbatim, excerpts):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/csp.test.ts (6 tests)
 ✓ tests/unit/security-defaults.test.ts (6 tests)
 ✓ tests/unit/ipc-registry-coverage.test.ts (3 tests)
 ✘ tests/unit/ipc-validation.test.ts > validators.ping (no-arg)
   AssertionError: expected [Function] to not throw an error but
   'IpcValidationError: validator not implemented (RED skeleton)' was thrown
 ✘ tests/unit/ipc-validation.test.ts > validators.echo
   IpcValidationError: validator not implemented (RED skeleton)
 ✘ tests/unit/ipc-validation.test.ts > validators.journalAppend (parses { text:string })
   IpcValidationError: validator not implemented (RED skeleton)
 ✘ tests/unit/ipc-validation.test.ts > validators.journalAppend ({ text:number } → "text" in msg)
   AssertionError: expected '... not implemented ...' to contain 'text'

 Test Files  1 failed | 3 passed (4)
      Tests  4 failed | 20 passed (24)
```

playwright:

```
Running 9 tests using 1 worker
  ✓  BT-L2-2 (typeof require undefined) — passes on static config
  ✓  BT-L2-6 (CSP blocks inline) — passes on static config
  ✘  BT-L2-1 → 'No handler registered for app:ping'
  ✘  BT-L2-3 → Timed out waiting for 'security:window-open:blocked'
  ✘  BT-L2-4 → Timed out waiting for 'security:navigation:blocked'
  ✘  BT-L2-5 → name expected 'IpcValidationError', received 'Error'
  ✘  BT-L2-5b → 'No handler registered for journal:append'
  ✘  BT-L2-7 → 'No handler registered for app:echo'
  ✘  BT-L2-8 → expected onTick count >= 4, received 0
  7 failed | 2 passed (37.5s)
```

- **Notes**: failures are on real assertions, not infrastructure errors.
  BT-L2-2 and BT-L2-6 pass because the static configuration (preload
  + index.html CSP meta) is correct from the skeleton; the behaviors
  under test are properties of those static configs and can only fail
  under a future regression.
- **Linked to test-plan**: BT-L2-1..8 in `03_pocs/L2-secure-ipc/test-plan.md`.

## Entry 5 — L2 — GREEN (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L2-secure-ipc
- **Command**:
  - `npm run test`
  - `npx playwright test`
- **Status**: PASS (GREEN commit `477565d`)
- **Output** (verbatim):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/security-defaults.test.ts (6 tests) 2ms
 ✓ tests/unit/csp.test.ts (6 tests) 2ms
 ✓ tests/unit/ipc-validation.test.ts (9 tests) 3ms
 ✓ tests/unit/ipc-registry-coverage.test.ts (3 tests) 1ms

 Test Files  4 passed (4)
      Tests  24 passed (24)
   Duration  89ms
```

playwright:

```
Running 9 tests using 1 worker

  ✓   1 BT-L2-6 (1.5s)
  ✓   2 BT-L2-2 (323ms)
  ✓   3 BT-L2-3 (335ms)
  ✓   4 BT-L2-4 (936ms)
  ✓   5 BT-L2-1 (343ms)
  ✓   6 BT-L2-5 (341ms)
  ✓   7 BT-L2-5b (345ms)
  ✓   8 BT-L2-7 (336ms)
  ✓   9 BT-L2-8 (1.6s)

  9 passed (6.3s)
```

- **Notes**: BT-L2-5 required the Decision 6 fix (preload throws
  `{ name: 'IpcValidationError', message }` instead of an Error
  instance) — Electron's contextBridge strips Error.name across the
  isolated-world boundary. See expectation-gap-ledger Entry 3.
- **Linked to test-plan**: BT-L2-1..8 in `03_pocs/L2-secure-ipc/test-plan.md`.

## Entry 6 — L2 — REGRESSION (vitest + playwright full suite)

- **Date**: 2026-05-17
- **POC**: L2-secure-ipc
- **Command**:
  - `npm run test`
  - `npx playwright test`
- **Status**: PASS
- **Output** (verbatim):

vitest: 24/24 pass (unchanged from GREEN).

playwright:

```
Running 13 tests using 1 worker

  ✓   1 BT-L2-6 (1.4s)
  ✓   2 BT-L2-2 (351ms)
  ✓   3 BT-L2-3 (344ms)
  ✓   4 BT-L2-4 (818ms)
  ✓   5 R-L2-1 (351ms)
  ✓   6 R-L2-2 (341ms)
  ✓   7 R-L2-3 (338ms)
  ✓   8 R-L2-4 (1ms)
  ✓   9 BT-L2-1 (339ms)
  ✓  10 BT-L2-5 (338ms)
  ✓  11 BT-L2-5b (338ms)
  ✓  12 BT-L2-7 (337ms)
  ✓  13 BT-L2-8 (1.5s)

  13 passed (7.1s)
```

- **Notes**: 4 regression tests added in this commit (R-L2-1..4),
  all pass on first run alongside the 9 behavioral tests.
- **Linked to test-plan**: BT-L2-1..8 and R-L2-1..4 in
  `03_pocs/L2-secure-ipc/test-plan.md`.

## Entry 7 — L3 — RED (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L3-storage-and-native-io
- **Command**:
  - `npm run test` (vitest)
  - `npm run test:e2e` (playwright)
- **Status**: FAIL (expected — RED commit `22e1c5a`)
- **Output** (verbatim, excerpts):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/csp.test.ts (6 tests)
 ✓ tests/unit/security-defaults.test.ts (6 tests)
 ✓ tests/unit/ipc-validation.test.ts (27 tests)
 ✓ tests/unit/ipc-registry-coverage.test.ts (4 tests)
 × tests/unit/storage.test.ts (7 tests) — all fail with:
   Error: storage.createJournalStorage: not implemented (RED commit stub)
 Test Files  1 failed | 4 passed (5)
      Tests  7 failed | 43 passed (50)
```

playwright:

```
Running 9 tests using 1 worker

  ✓ BT-L3-3 dialog cancel (381ms)
  ✓ BT-L3-4 dialog save (515ms)
  ✓ BT-L3-5 drag-drop IPC (382ms)
  × BT-L3-1 journal append+list — storage.createJournalStorage: not implemented
  × BT-L3-2 journal corruption recovery — storage.createJournalStorage: not implemented
  × BT-L3-6 application menu shape — menu.getApplicationMenuTree: not implemented
  × BT-L3-7 file watcher rename — no rename event observed
  × BT-L3-8 Quit menu flush — storage.createJournalStorage: not implemented
  × BT-L3-9 context menu listener — listenerCount: 0

  6 failed
  3 passed (46.8s)
```

- **Notes**: BT-L3-3/4/5 already pass at RED because the dialog adapter
  + files:dropped logger ride on L2 IPC plumbing that needs no new
  implementation. The storage / watch / menu stubs throw `not
  implemented`, producing the 6 failures.
- **Linked to test-plan**: BT-L3-1..9 in `03_pocs/L3-storage-and-native-io/test-plan.md`.

## Entry 8 — L3 — GREEN (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L3-storage-and-native-io
- **Command**:
  - `npm run test` (vitest)
  - `npm run test:e2e` (playwright)
- **Status**: PASS (GREEN commit `0568be0`)
- **Output** (verbatim, excerpts):

vitest:

```
 RUN  v4.1.6
 ✓ tests/unit/csp.test.ts (6 tests) 2ms
 ✓ tests/unit/security-defaults.test.ts (6 tests) 2ms
 ✓ tests/unit/ipc-validation.test.ts (27 tests) 3ms
 ✓ tests/unit/ipc-registry-coverage.test.ts (4 tests) 2ms
 ✓ tests/unit/storage.test.ts (7 tests) 10ms

 Test Files  5 passed (5)
      Tests  50 passed (50)
```

playwright:

```
Running 9 tests using 1 worker

  ✓  1 BT-L3-3 (381ms)
  ✓  2 BT-L3-4 (515ms)
  ✓  3 BT-L3-5 (382ms)
  ✓  4 BT-L3-1 (351ms)
  ✓  5 BT-L3-2 (372ms)
  ✓  6 BT-L3-8 (337ms)
  ✓  7 BT-L3-6 (354ms)
  ✓  8 BT-L3-9 (349ms)
  ✓  9 BT-L3-7 (739ms)

  9 passed (4.0s)
```

- **Notes**: Every BT passed on the first GREEN build. BT-L3-7 latency
  738ms — slower than the spec's 500ms target but well under the
  test's 1500ms CI gate. Documented as an expectation gap (not promoted)
  in poc-report.md.
- **Linked to test-plan**: BT-L3-1..9 in `03_pocs/L3-storage-and-native-io/test-plan.md`.

## Entry 9 — L3 — REGRESSION (vitest + playwright)

- **Date**: 2026-05-17
- **POC**: L3-storage-and-native-io
- **Command**: `npm run test && npm run test:e2e`
- **Status**: PASS

vitest:

```
 Test Files  5 passed (5)
      Tests  50 passed (50)
```

playwright:

```
Running 13 tests using 1 worker
  ✓  BT-L3-1..9 (9 tests)
  ✓  R-L3-1..4 (4 tests)
  13 passed (6.9s)
```

- **Notes**: R-L3-1..4 added in this commit; all four pass on the first
  run alongside the nine behavioral tests.
- **Linked to test-plan**: R-L3-1..4 in `03_pocs/L3-storage-and-native-io/test-plan.md`.

## L4 RED — 2026-05-17

- **POC**: L4 Deep macOS System Integration
- **Suite**: vitest + Playwright (`_electron`)
- **Commit phase**: RED — `phase-6(L4): red — failing tests for tray state, notifications, shortcuts, powerMonitor, lifecycle, deep links, autolaunch, theme, dock`

vitest:
```
Test Files  2 failed | 8 passed (10)
     Tests  7 failed | 91 passed (98)
```

playwright (e2e):
```
12 failed
  BT-L4-1, BT-L4-2 (tray)
  BT-L4-3           (notifications)
  BT-L4-4           (shortcuts)
  BT-L4-5           (power)
  BT-L4-6, BT-L4-7, BT-L4-12 (lifecycle)
  BT-L4-8           (autolaunch)
  BT-L4-9           (theme)
  BT-L4-10, BT-L4-11 (dock)
```

- **Notes**: All 12 behavioral failures + 7 unit-test failures are real
  assertion failures, not import errors. The 7 unit-test failures arise
  from `parse-deep-link.test.ts` happy-path probes and the
  `notification-failed-listener.test.ts` static-source checks (the RED
  notification stub does not yet construct a `new Notification`).
- **Linked to test-plan**: `03_pocs/L4-deep-macos-integration/test-plan.md` (written at REGRESSION).

## L4 GREEN — 2026-05-17

- **POC**: L4 Deep macOS System Integration
- **Suite**: vitest + Playwright (`_electron`)
- **Commit phase**: GREEN — `phase-6(L4): green — tray state machine, notification failed-listener, globalShortcut, powerMonitor, single-instance + open-url, autolaunch, nativeTheme, dock badge; all behavioral tests pass`

vitest:
```
Test Files  10 passed (10)
     Tests  98 passed (98)
```

playwright (e2e):
```
Running 12 tests using 1 worker
  ✓  1 BT-L4-8  (autolaunch)
  ✓  2 BT-L4-10 (dock badge)
  ✓  3 BT-L4-11 (recent docs)
  ✓  4 BT-L4-6  (second-instance + deep-link)
  ✓  5 BT-L4-7  (open-url)
  ✓  6 BT-L4-12 (will-quit cleanup)
  ✓  7 BT-L4-3  (notification failed in unsigned dev)
  ✓  8 BT-L4-5  (powerMonitor suspend/resume)
  ✓  9 BT-L4-4  (CmdOrCtrl+Shift+P fires)
  ✓ 10 BT-L4-9  (nativeTheme dark/light)
  ✓ 11 BT-L4-1  (Tray exists + initial state)
  ✓ 12 BT-L4-2  (tray:set-state reflects)
  12 passed (4.5s)
```

- **Notes**: BT-L4-3 is asserted via the unsigned-dev-failure path (the
  `notification:failed:unsigned` log + `failed: { error }` returned to the
  caller). In a signed packaged build the same call would resolve `ok:true`;
  the signed path is documented as a future case for L5.
- **Linked to test-plan**: `03_pocs/L4-deep-macos-integration/test-plan.md` (written at REGRESSION).
