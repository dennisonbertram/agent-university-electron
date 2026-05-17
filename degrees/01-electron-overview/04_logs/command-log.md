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

## L4-1 — 2026-05-17 — L4 RED build + tests

```
cd .../03_pocs/L4-deep-macos-integration
npm install
npm run build
npm run test
npx playwright test
```

Output (excerpts):

vitest (RED):
```
 Test Files  2 failed | 8 passed (10)
      Tests  7 failed | 91 passed (98)
```

The 7 failures live in `parse-deep-link.test.ts` (4 happy-path assertions
against the RED stub `[null, Error('not implemented')]`) and
`notification-failed-listener.test.ts` (3 static-source checks that look for
`new Notification(...)`, `.on('failed'`, and `.show(` — none of which appear
in the RED stub).

playwright (RED):
```
  12 failed
    tests/e2e/autolaunch.spec.ts BT-L4-8
    tests/e2e/dock.spec.ts BT-L4-10
    tests/e2e/dock.spec.ts BT-L4-11
    tests/e2e/lifecycle.spec.ts BT-L4-6
    tests/e2e/lifecycle.spec.ts BT-L4-7
    tests/e2e/lifecycle.spec.ts BT-L4-12
    tests/e2e/notifications.spec.ts BT-L4-3
    tests/e2e/power.spec.ts BT-L4-5
    tests/e2e/shortcuts.spec.ts BT-L4-4
    tests/e2e/theme.spec.ts BT-L4-9
    tests/e2e/tray.spec.ts BT-L4-1
    tests/e2e/tray.spec.ts BT-L4-2
```

All 12 BTs fail on real behavioral assertions, not import errors.

## L4-2 — 2026-05-17 — L4 GREEN build + tests

```
cd .../03_pocs/L4-deep-macos-integration
npm run build
npm run test
npx playwright test
```

Output (excerpts):

vitest (GREEN):
```
Test Files  10 passed (10)
     Tests  98 passed (98)
```

playwright (GREEN):
```
12 passed (4.5s)
```

Implementations landed:
- `src/protocol.ts`: full parser with strict scheme + action gate; rejects
  `electron-l4://`, `electron-l4://%`, malformed URLs (R-L4-4 happy path).
- `src/tray.ts`: module-scope `trayInstance` (FM-04), STATE_TITLE table for
  idle/focused/break/paused.
- `src/notifications.ts`: Notification + `failed` listener pair, 2s timeout
  fallback so non-darwin platforms still resolve.
- `src/shortcuts.ts`: globalShortcut.register + `app.on('will-quit', ...)`
  cleanup with `globalShortcut.unregisterAll()`.
- `src/power.ts`: suspend/resume + lock/unlock/on-ac/on-battery handlers;
  `fireForTest` uses `powerMonitor.emit` for the e2e seam.
- `src/lifecycle.ts`: single `dispatchArgs(args, origin)` handles both
  `open-url` and `second-instance`; focuses main window, parses, logs,
  dispatches to `onDeepLink`.
- `src/autolaunch.ts`: setLoginItemSettings wrapper logging
  `autolaunch:set:requested` and `:observed`; `ensureLoginItemDisabledOnCleanup`
  sentinel for R-L4-6 static check.
- `src/theme.ts`: nativeTheme wrapper with sync snapshot broadcast (so the
  e2e push event lands before the renderer racer times out).
- `src/dock.ts`: dock.setBadge + addRecentDocument with platform guards.

## L4-3 — 2026-05-17 — L4 REGRESSION run

```
cd .../03_pocs/L4-deep-macos-integration
npx playwright test
```

Output (excerpt):
```
Running 18 tests using 1 worker
  ✓ BT-L4-1..12 (12 tests, all behavioral)
  ✓ R-L4-1..6  (6 tests, all regression)
  18 passed (7.3s)
```

vitest carry-forward:
```
Test Files  10 passed (10)
     Tests  98 passed (98)
```

Three changes landed in this commit beyond the test additions:
- README.md, test-plan.md, poc-report.md written.
- decision-log Decision 10 (test-only IPC channels) appended.
- expectation-gap-ledger Entries 5 (login-item round-trip flake on
  unsigned dev) and 6 (tray title-vs-PNG deviation) appended.

## L5-1 — 2026-05-17 — L5 RED setup (scaffold + npm install + vitest RED)

```
mkdir -p .../L5-packaging-signing-update/{src,scripts/fixtures,tests/{unit,e2e}}
cp -R .../L4/src/. .../L5/src/
npm install --no-audit --no-fund (electron 42.1.0, @electron-forge/cli 7.11.1,
  maker-dmg 7.11.1, maker-zip 7.11.1, plugin-fuses 7.11.1, @electron/fuses 1.8.0,
  @electron/notarize 3.1.1, @electron/universal 3.0.0, electron-updater 6.8.3,
  electron-log 5.2.0, plist 3.1.0, yaml 2.6.1, playwright 1.60.0, vitest 4.1.6,
  typescript 5.6.3, esbuild 0.24.0, @types/node 22.10.0)
npx tsc -p tsconfig.json (EXIT=0)
npx vitest run
```

Output (excerpt):
```
 Test Files  4 failed | 11 passed (15)
      Tests  13 failed | 113 passed (126)
```

Failures (intentional, RED):
- entitlements.test.ts × 4 (empty `entitlements.mac.plist`)
- forge-config.test.ts × 4 (skeleton `forge.config.ts` has empty makers/plugins)
- info-plist-template.test.ts × 3 (empty `Info.plist.template`)
- updater-config.test.ts × 2 (stub `src/updater.ts` throws "not implemented")

The 113 passing tests are L4 carry-forwards (parse-deep-link, ipc-validation,
ipc-registry-coverage with the new L5 channels added, single-instance-lock-
order, tray-state-machine, storage, csp, security-defaults, notification-
failed-listener, shortcut-cleanup) PLUS the L5 ordering tests that pass even
in RED because `startCrashReporter` is imported + called in main.ts ABOVE
the `app.whenReady()` site (the stub throws at runtime, the static order is
intact for the regression check).

## L5-2 — 2026-05-17 — L5 GREEN run (forge package + make + e2e)

```
cd .../03_pocs/L5-packaging-signing-update

# 1. Vitest after GREEN
npx vitest run

# 2. Packaging
APPLE_ID= APPLE_PASSWORD= APPLE_TEAM_ID= APPLE_APP_SPECIFIC_PASSWORD= \
  npm run package

# 3. Make (DMG + ZIP)
APPLE_ID= APPLE_PASSWORD= APPLE_TEAM_ID= APPLE_APP_SPECIFIC_PASSWORD= \
  npm run make

# 4. Playwright e2e (uses memoized package/make from above)
npx playwright test
```

Output (excerpts):
```
# vitest
 Test Files  15 passed (15)
      Tests  126 passed (126)

# package
✔ Packaging for arm64 on darwin
packaging:signing:skipped:no-credentials — see simulated-signing.md
✔ Running postPackage hook

# playwright
  10 passed (12.7s)
  1 skipped  ← BT-L5-4 @long-running universal binary
```

Bundle inspection:
```
out/L5-packaging-signing-update-darwin-arm64/
  L5-packaging-signing-update.app/Contents/
    _CodeSignature   Frameworks   Info.plist   MacOS   PkgInfo   Resources

  Contents/Resources/app.asar  (asar archive present)
  Contents/Info.plist:
    CFBundleIdentifier      = com.agentuniversity.l5.packaging-signing-update
    CFBundleURLSchemes      = electron-l5
    CFBundleShortVersionString = 1.0.0
    NSHumanReadableCopyright   = "Copyright (c) 2026 Agent University..."
```

Artifacts captured under `test-results/`:
- `GREEN-vitest.log` — 126/126 passed
- `GREEN-playwright.log` — 10/11 passed (1 skipped: universal)
- `packaging-skip.log` — `packaging:signing:skipped:no-credentials` marker

Behavioral status:
- PASS: BT-L5-1, BT-L5-2, BT-L5-3, BT-L5-5, BT-L5-6, BT-L5-7, BT-L5-8,
        BT-L5-9, BT-L5-10
- SKIP @long-running: BT-L5-4 (universal binary; forge config supports it).
- SKIP @signed-only (NOT in test suite, documented only): real
  `codesign --verify` and `xcrun stapler validate` — require Apple Dev cert.

## L5-3 — 2026-05-17 — L5 REGRESSION run

```
cd .../03_pocs/L5-packaging-signing-update
npx playwright test
```

Output (full):
```
Running 16 tests using 1 worker

  ✓   1 tests/e2e/crash-reporter.spec.ts:13:5 › BT-L5-8 (410ms)
  ✓   2 tests/e2e/packaged-boot.spec.ts:11:5 › BT-L5-10 (1.2s)
  ✓   3 tests/e2e/packaging.spec.ts:24:7 › BT-L5-1 (1ms)
  ✓   4 tests/e2e/packaging.spec.ts:39:7 › BT-L5-2 (9.9s)
  ✓   5 tests/e2e/packaging.spec.ts:55:7 › BT-L5-3 (2ms)
  ✓   6 tests/e2e/packaging.spec.ts:76:7 › BT-L5-9 (1ms)
  -   7 tests/e2e/packaging.spec.ts:90:7 › BT-L5-4 [skip @long-running]
  ✓   8 tests/e2e/regression.spec.ts:30:7 › R-L5-1 (0ms)
  ✓   9 tests/e2e/regression.spec.ts:39:7 › R-L5-2 (0ms)
  ✓  10 tests/e2e/regression.spec.ts:46:7 › R-L5-3 (0ms)
  ✓  11 tests/e2e/regression.spec.ts:53:7 › R-L5-4 (1ms)
  ✓  12 tests/e2e/regression.spec.ts:77:7 › R-L5-5 (1ms)
  ✓  13 tests/e2e/signing-simulation.spec.ts:24:7 › BT-L5-5 (1ms)
  ✓  14 tests/e2e/signing-simulation.spec.ts:50:7 › R-L5-4 (0ms)
  ✓  15 tests/e2e/updater.spec.ts:24:7 › BT-L5-6 (399ms)
  ✓  16 tests/e2e/updater.spec.ts:61:7 › BT-L5-7 (378ms)

  1 skipped
  15 passed (12.6s)
```

vitest carry-forward:
```
Test Files  15 passed (15)
     Tests  126 passed (126)
```

Documents written:
- README.md (top-level POC overview).
- test-plan.md (BT/R → test file mapping + perf budget).
- poc-report.md (decisions, behavioral status, invariants for capstone).
- 04_logs/decision-log.md (Decision 11: hybrid build chain).
- 04_logs/expectation-gap-ledger.md (Entries 7-11: updater query string,
  protocols-vs-extendInfo merge, forceDevUpdateConfig escape, playwright
  result-dir wipe, packageAfterCopy buildPath semantics).
- 04_logs/deployment-log.md (Attempts 1-4 from L5-2 commit).

## 2026-05-17 — Capstone Pulse — RED commit prep

```
# Scaffold + install + first build
cd 03_pocs/L-capstone-pulse
npm install         # 668 packages, 26s
npm run build       # tsc + esbuild bundle (preload) + static-copy (renderer)
npx vitest run      # ⇒ 28 failed, 59 passed (87 total) — RED confirmed
npx playwright test tests/e2e/focus.spec.ts -g 'BT-C-1'
                    # ⇒ timeout after 5000ms waiting for `focus:start:25min`
                    # `journal-store:install-failed`, `passphrase:install-failed`,
                    # `biometric:install-failed`, `focus-engine:install-failed`
                    # confirm RED at runtime — stub modules throw on install.
```

Carried Entry 10 (Playwright wipes `test-results/` at start) — RED logs landed in `test-output/` instead.

