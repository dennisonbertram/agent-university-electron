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
