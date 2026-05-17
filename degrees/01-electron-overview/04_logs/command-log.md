# Command Log — 01-electron-overview

Every non-trivial shell command run during the degree, with output excerpts. Append-only. Filter out trivial `cd` / `ls`.

## Entry Format

```
## N — <date> — <short label>

\`\`\`
<command>
\`\`\`

Output (excerpt):
\`\`\`
<output>
\`\`\`
```

## Commands

## 1 — 2026-05-17 — L1 install dependencies

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npm install
```

Output (excerpt):

```
npm warn ERESOLVE overriding peer dependency
added 73 packages, and audited 74 packages in 4s
19 packages are looking for funding
found 0 vulnerabilities
```

## 2 — 2026-05-17 — L1 build (tsc + renderer asset copy)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npm run build
```

Output: clean (no diagnostics emitted). Produces `dist/{main,preload,window,log,ipc}.js`,
`dist/renderer/{renderer.js,index.html}`.

## 3 — 2026-05-17 — L1 unit tests (RED)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npm run test
```

Output (excerpt):

```
Test Files  1 failed | 1 passed (2)
Tests       10 failed | 3 passed (13)
```

Failures are the expected logger-stub `throw`s. See test-results.md Entry 1.

## 4 — 2026-05-17 — L1 e2e tests (RED)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npx playwright test
```

Output (excerpt):

```
Running 4 tests using 1 worker
  ✘  1 BT-L1-1  TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded
  ✘  2 BT-L1-2  TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded
  ✘  3 BT-L1-3  TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded
  ✘  4 BT-L1-4  TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded
  4 failed
```

## 5 — 2026-05-17 — L1 unit tests (GREEN)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npm run test
```

Output:

```
Test Files  2 passed (2)
Tests       14 passed (14)
```

## 6 — 2026-05-17 — L1 e2e tests (GREEN)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npx playwright test
```

Output:

```
Running 4 tests using 1 worker
  ✓  1 BT-L1-1 (342ms)
  ✓  2 BT-L1-2 (454ms)
  ✓  3 BT-L1-3 (281ms)
  ✓  4 BT-L1-4 (480ms)
  4 passed (1.8s)
```

## 7 — 2026-05-17 — L1 full e2e suite (REGRESSION)

```
cd degrees/01-electron-overview/03_pocs/L1-hello-electron && npx playwright test
```

Output:

```
Running 8 tests using 1 worker
  ✓  1 BT-L1-1 (671ms)
  ✓  2 BT-L1-2 (466ms)
  ✓  3 BT-L1-3 (316ms)
  ✓  4 BT-L1-4 (482ms)
  ✓  5 R-L1-1  (830ms)
  ✓  6 R-L1-2  (341ms)
  ✓  7 R-L1-3  (479ms)
  ✓  8 R-L1-4  (458ms)
  8 passed (4.3s)
```

## 8 — 2026-05-17 — L2 install dependencies

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npm install
```

Output (excerpt):

```
npm warn ERESOLVE overriding peer dependency
added 77 packages, and audited 78 packages in 4s
19 packages are looking for funding
1 moderate severity vulnerability
```

(+4 packages vs L1 — esbuild added for preload bundling.)

## 9 — 2026-05-17 — L2 build (tsc + esbuild preload + renderer copy)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npm run build
```

Output: clean. esbuild reports `dist/preload.js 4.7kb` and a sourcemap.

## 10 — 2026-05-17 — L2 unit tests (RED)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npx vitest run
```

Output (excerpt):

```
Test Files  1 failed | 3 passed (4)
     Tests  4 failed | 20 passed (24)
```

All 4 failures are the validator stubs throwing "not implemented" — real
assertion failures, not import errors. csp.test.ts and
security-defaults.test.ts pass because the static config (CSP meta tag,
window.ts secure defaults) was wired correctly from the skeleton; they
only fail under future regressions, which is the intent.

## 11 — 2026-05-17 — L2 e2e tests (RED)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npx playwright test
```

Output (excerpt):

```
Running 9 tests using 1 worker
  ✓  BT-L2-2 (isolation — passes on static config)
  ✓  BT-L2-6 (CSP — passes on static config)
  ✘  BT-L2-1, BT-L2-3, BT-L2-4, BT-L2-5, BT-L2-5b, BT-L2-7, BT-L2-8
  7 failed | 2 passed (37.5s)
```

Failure modes (verbatim):
- `Error: No handler registered for 'app:ping'` / `'app:echo'` / `'journal:append'`
- Timeout waiting for `security:window-open:blocked` log entry
- `Expected: >= 4 / Received: 0` for the onTick subscription
- `Expected: "IpcValidationError" / Received: "Error"` for the validation reject

## 12 — 2026-05-17 — L2 unit tests (GREEN)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npx vitest run
```

Output:

```
Test Files  4 passed (4)
     Tests  24 passed (24)
   Duration 89ms
```

## 13 — 2026-05-17 — L2 e2e tests (GREEN)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npx playwright test
```

Output:

```
Running 9 tests using 1 worker
  ✓ BT-L2-6  (1.5s)   ✓ BT-L2-2  (323ms)
  ✓ BT-L2-3  (335ms)  ✓ BT-L2-4  (936ms)
  ✓ BT-L2-1  (343ms)  ✓ BT-L2-5  (341ms)
  ✓ BT-L2-5b (345ms)  ✓ BT-L2-7  (336ms)  ✓ BT-L2-8 (1.6s)
  9 passed (6.3s)
```

BT-L2-5 required the Decision 6 fix (plain-object throw) to pass — see
expectation-gap-ledger Entry 3 and decision-log Entry 6.

## 14 — 2026-05-17 — L2 full suite (REGRESSION)

```
cd degrees/01-electron-overview/03_pocs/L2-secure-ipc && npx vitest run && npx playwright test
```

Output:

```
# vitest
Test Files  4 passed (4)
     Tests  24 passed (24)

# playwright
Running 13 tests using 1 worker
  ✓ BT-L2-1..8 (9 tests)
  ✓ R-L2-1..4 (4 tests)
  13 passed (7.1s)
```

## 15 — 2026-05-17 — L3 install dependencies

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm install
```

Output (excerpt):

```
added 77 packages, and audited 78 packages in 4s
```

## 16 — 2026-05-17 — L3 unit test run (RED commit)

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm run test
```

Output (excerpt):

```
 Test Files  1 failed | 4 passed (5)
      Tests  7 failed | 43 passed (50)
```

Failures: 7 in `tests/unit/storage.test.ts` — all
`Error: storage.createJournalStorage: not implemented (RED commit stub)`.

## 17 — 2026-05-17 — L3 e2e run (RED commit)

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm run test:e2e
```

Output (excerpt):

```
  6 failed
    tests/e2e/journal.spec.ts:24:5 › BT-L3-1
    tests/e2e/journal.spec.ts:67:5 › BT-L3-2
    tests/e2e/lifecycle-flush.spec.ts:35:5 › BT-L3-8
    tests/e2e/menus.spec.ts:48:5 › BT-L3-6
    tests/e2e/menus.spec.ts:76:5 › BT-L3-9
    tests/e2e/watch.spec.ts:32:5 › BT-L3-7
  3 passed (46.8s)
```

## 18 — 2026-05-17 — L3 unit test run (GREEN commit)

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm run test
```

Output:

```
 Test Files  5 passed (5)
      Tests  50 passed (50)
```

## 19 — 2026-05-17 — L3 e2e run (GREEN commit)

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm run test:e2e
```

Output:

```
Running 9 tests using 1 worker
  ✓ BT-L3-1..9 (9 tests)
  9 passed (4.0s)
```

## 20 — 2026-05-17 — L3 full suite (REGRESSION commit)

```
cd degrees/01-electron-overview/03_pocs/L3-storage-and-native-io && npm run test && npm run test:e2e
```

Output:

```
# vitest
Test Files  5 passed (5)
     Tests  50 passed (50)

# playwright
Running 13 tests using 1 worker
  ✓ BT-L3-1..9 (9 tests)
  ✓ R-L3-1..4 (4 tests)
  13 passed (6.9s)
```
