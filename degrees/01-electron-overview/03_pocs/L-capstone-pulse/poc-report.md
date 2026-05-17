# Pulse capstone — POC report

## Status

- **Behavioral tests (BT-C-1..12)**: 14/14 passing.
- **Regression tests (R-C-1..8)**: 8/8 passing.
- **Unit tests**: 87/87 passing across 15 files.
- **Packaging**: `npm run package` produces `Pulse.app` with the
  `app.asar.unpacked/.../better_sqlite3.node` native module unpacked
  (auto-unpack-natives) and `simulated-signing.md` + skip-log marker
  emitted (no Apple Dev creds in env).
- **Universal binary**: NOT exercised in this run (`@long-running`,
  documented).
- **Real Apple signing + notarization**: SKIPPED (no creds). The skip
  path is conditional in `forge.config.ts`; `osxSign`/`osxNotarize` only
  enter the spread when `HAS_APPLE_CREDS` is true. The `packageAfterCopy`
  hook writes `simulated-signing.md` whenever the skip path is taken.

## What's exercised by what mechanism

| Test    | Driven via                                              | Real OS? |
| ------- | ------------------------------------------------------- | :------: |
| BT-C-1  | `test:fire-shortcut` IPC                                | simulated |
| BT-C-2  | `test:emit-power-event` IPC ⇒ `powerMonitor.emit()`     | simulated |
| BT-C-3  | `test:trigger-notification-action` IPC                  | simulated |
| BT-C-4  | `test:advance-clock` IPC                                | simulated |
| BT-C-5  | `test:fire-deep-link` IPC + `test:get-raw-journal-rows` | partially |
| BT-C-6  | `TOUCH_ID_UNAVAILABLE=1` env-flag                       | simulated |
| BT-C-7  | `journal:set-passphrase` + `journal:unlock-with-passphrase` | real |
| BT-C-8  | `TOUCH_ID_FORCE_AVAILABLE=1` env-flag                   | simulated |
| BT-C-9  | Two `launchApp` calls sharing `userDataDir`             | real |
| BT-C-10 | `boot.summary().dockHidden` + plist check               | real (dock.hide on darwin) |
| BT-C-11 | `runPackage()` + plist + filesystem walk                | real (forge) |
| BT-C-12 | `launchPackagedApp` → spawn + tail of `main.log`        | real (packaged app boots) |

The "simulated" rows reflect Decision 10 (REF-01/06): real OS events
either require user interaction (Touch ID prompt, notification action
buttons) or signed builds (most notification surfaces), so we drive them
through gated test IPC channels.

## Honest deviations from the prompt's ideal design

- **Tray icon — PNG template variants vs title strings.** The prompt
  preferred per-state PNG template images (`tray-idle-Template.png`,
  `tray-focus-Template.png`, ...). The capstone uses the same title-string
  approach as L4 (`●` / `▶` / `◌` / `⏸`) — exactly as the prompt
  explicitly permits when asset creation is infeasible. The tray IS
  installed with a base 16×16 transparent template PNG (so the macOS
  `nativeImage` constructor is happy), but the meaningful per-state
  signal is the title text. Polish for a real ship would swap in real
  per-state PNGs; this is documented Entry 6 in expectation-gap-ledger.
- **LSUIElement.** The packaged Info.plist contains `LSUIElement = true`,
  giving the menu-bar-only experience. `app.dock.hide()` in dev mode
  covers the unpackaged path. Both branches asserted in BT-C-10.
- **No `assets/` directory committed.** The prompt's file layout listed
  optional `src/assets/tray-*-Template.png`. Since we use title strings,
  the directory was not created. The deviation is documented here.
- **Touch ID test (BT-C-8) under `TOUCH_ID_FORCE_AVAILABLE`.** The
  biometric service short-circuits to "resolved true" when the env flag
  is set AND no override is injected — the alternative (calling the real
  `systemPreferences.promptTouchID`) would hang in CI or on hardware
  without an enrolled fingerprint. The branch is small and obvious in
  `src/biometric.ts` (it's the "test seam" pattern from Decision 10
  carried into the biometric module). Real Touch ID is therefore
  untested in this run.
- **Notification action via IPC seam (BT-C-3).** Real notification action
  buttons require a signed build on macOS 12+. The prompt explicitly
  permits asserting the handler-invocation path via test IPC. We
  register the action handler when the engine queues the completion
  notification, and the test IPC `test:trigger-notification-action`
  invokes it directly. The handler increments durationMs by 5 minutes
  and logs `focus:extended:+5min`.
- **safeStorage fallback was NOT exercised at runtime under e2e.** The
  `journal:encryption-unavailable:fallback-plaintext` branch is reachable
  by static-source inspection (R-C-2) AND by unit test (the journal-store
  test passes `encryptionAvailable: false`). At runtime under Playwright
  on a developer mac with Keychain available, the branch doesn't fire
  organically. R-C-1 asserts the boot-time observability of both branches
  symmetrically.

## Expectation gaps recorded

- **Entry 12 (capstone — new)**: `better-sqlite3@12.10.0` doesn't compile
  against Electron 42's V8 14.x out of the box. The toolchain hits three
  compile errors (`External::New` arity, `External::Value` arity,
  `SetNativeDataProperty` overload ambiguity). The local patch
  (`scripts/patches/better-sqlite3-v8-tag.mjs`) adds `#if V8_MAJOR_VERSION >= 14`
  guards so the same source compiles for system Node (V8 13.6, vitest)
  and Electron 42 (V8 14.8, Playwright). The patch runs as `postinstall`.

- **Entries 1-11** (L1-L5) all remain relevant. Entry 7 (electron-updater
  appends `?noCache=`) and Entry 8 (`packagerConfig.protocols` overrides
  `extendInfo.CFBundleURLTypes`) apply directly to this POC's
  `local-update-server.mjs` and `forge.config.ts` respectively. Entry 10
  (Playwright wipes `test-results/`) was rediscovered when capturing RED
  logs — the workaround (`test-output/`) is now standard for this POC.

## Decisions recorded

- **Decision 11 (carried from L5)**: hybrid build (tsc + esbuild + forge,
  no Vite plugin) — same hybrid pattern preserved.
- **Decision 12 (capstone — new)**: in-process IPC test seam for SQLite
  row inspection. The test process can't load the Electron-rebuilt
  `better_sqlite3.node` (ABI mismatch); the in-process seam
  (`test:get-raw-journal-rows`) is portable and gated.

## Invariants future Phase 7-11 work depends on

1. **Pre-ready order (R-C-4, R-C-5)** — `requestSingleInstanceLock()` and
   `startCrashReporter()` must remain at module-load scope in `src/main.ts`,
   BEFORE the `app.whenReady().then(...)` call. Any future refactor that
   wraps boot in an async function will break both regressions.
2. **`pulse://` scheme registration (BT-C-11)** — the canonical scheme
   lives in `packagerConfig.protocols`; Info.plist.template carries
   `CFBundleURLTypes` as defense in depth (Entry 8). Any change to the
   scheme name MUST update three places: `protocol.ts`,
   `Info.plist.template`, and `forge.config.ts`.
3. **`safeStorage.encryptString` reference (R-C-2)** — `journal-store.ts`
   AND `main.ts` MUST contain the literal so a regression that
   accidentally bypasses encryption is caught by static-source check.
4. **AutoUnpackNativesPlugin (R-C-8)** — `forge.config.ts` MUST keep this
   plugin in the `plugins:` list. Without it, `better-sqlite3` ships
   inside the asar and fails to load at runtime in the packaged app.
5. **`globalShortcut.unregisterAll()` in will-quit (R-C-7)** — owned by
   `src/shortcuts.ts`. If the cleanup is moved elsewhere, the literal
   `app.on('will-quit',` + `globalShortcut.unregisterAll()` pair must
   still exist in that file for the static check.
6. **`testHooksEnabled()` gate** — all test-only channels (every
   `test:*` channel) are gated by `NODE_ENV === 'test'` OR
   `PULSE_TEST_HOOKS === '1'` (or carry-forward L4/L5 flags). A real
   distribution MUST NOT set any of those flags. Documented in the
   README's "Test seams" section.
7. **Input length caps (R-C-6)** — `JOURNAL_TEXT_MAX = 10_000` and
   `PASSPHRASE_MAX = 4_096` are the DoS-resistance baseline. Lifting
   either WITHOUT updating R-C-6's expected bound is the kind of
   "convenience" change that the regression test catches.
8. **Native-module patch script** — `scripts/patches/better-sqlite3-v8-tag.mjs`
   MUST keep running as `postinstall`. Without it, fresh installs fail to
   build better-sqlite3.

## Debugging sessions worth recording

Tracked in `04_logs/debugging-log.md`:

1. **better-sqlite3 vs V8 14.x** (the big one). Three compile errors
   surfaced in sequence:
   - `External::New(isolate, addon)` — arity. Fixed by patching call site.
   - `External::Value()` — arity. Fixed.
   - `SetNativeDataProperty(name, getter, 0, ...)` overload ambiguity.
     Fixed by `0 → nullptr`.
   Initial approach (unconditional patch) broke the system-Node rebuild.
   Final approach uses `#if V8_MAJOR_VERSION >= 14` guards so the same
   source compiles for both targets. The patch is idempotent and the
   `pretest`/`pretest:e2e` hooks rebuild for the right ABI before each
   test class.

2. **Node 24 ABI vs Electron ABI** — after each `electron-rebuild`, the
   binary is unloadable from system Node (NODE_MODULE_VERSION 146 vs 137).
   The Playwright test that inspected the SQLite DB directly hit this on
   first run (BT-C-5 initial implementation). Resolution: `test:get-raw-journal-rows`
   IPC seam (Decision 12).

## Recommended next step (Phase 7-11)

This is the final capstone for Phase 6. Phase 7-11 (distillation, skill
pack, evaluation, …) should begin by extracting the patterns this POC
established:

- **Distillation candidates** (move to `05_distillation/`):
  - "pre-ready boot order" (single-instance + crash + dock.hide + protocol).
  - "test seam IPC channel registry pattern" (gated, validated,
    same-shape-as-production-channels).
  - "JSON-lines structured log assertion pattern" (every behavioral test
    grep-asserts a log marker).
  - "native-module preprocessor-guarded patch script for cross-ABI builds".
- **Skill pack candidates** (`06_skill_pack/`):
  - Drop-in `focus-engine` reducer + EventEmitter wrapper.
  - Drop-in `journal-store` with safeStorage + better-sqlite3.
  - Drop-in `biometric` with env-flag-driven test branches.
  - Drop-in `lifecycle.ts` (open-url + second-instance + will-quit).
  - The `scripts/patches/better-sqlite3-v8-tag.mjs` pattern as a
    template for future native-module patches.
- **Evaluation** (`07_evaluation/`):
  - Score Pulse against the doctrine Phase 3 rubric (coverage,
    gotcha-likelihood, integration value, testing value, observability,
    deployment value, feasibility within time budget).
  - Compare with L4's score; the capstone should score highest on
    coverage + integration value, with feasibility marked
    "achieved-with-patch-required" (Entry 12).
