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
