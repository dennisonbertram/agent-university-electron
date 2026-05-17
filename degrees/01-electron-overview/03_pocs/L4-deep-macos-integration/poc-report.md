# L4 — POC Report

Date: 2026-05-17 (build day).
Author: Claude Code agent.

## Summary

L4 lit up ten macOS-native surfaces in a single Electron app, inheriting
L3's storage + L2's secure-IPC baseline, and reached 12 / 12 behavioral
tests on the first GREEN compile after a clean RED. The trick was being
honest about what's testable in dev mode versus what only a packaged
build can prove — and shaping every "untestable" surface into a
programmatic simulation that exercises the same code path.

## TDD commit trail

1. **`phase-6(L4): red`** (`4ae3e3b`) — Scaffolded the directory by
   copying L3, added nine module stubs (tray, notifications, shortcuts,
   power, lifecycle, protocol, autolaunch, theme, dock), wired the
   extended IPC registry + preload + renderer ambient types, and wrote
   every behavioral + regression test. Vitest: 7 / 98 fail. Playwright:
   12 / 12 BTs fail. All failures are real assertion diffs, not import
   errors.
2. **`phase-6(L4): green`** (`04bc083`) — Implemented every new module
   end-to-end. Vitest: 98 / 98 pass. Playwright: 12 / 12 BTs pass on
   first run.
3. **`phase-6(L4): regression`** (this commit) — Added
   `tests/e2e/regression.spec.ts` covering R-L4-1..6, wrote
   README/test-plan/poc-report, appended log entries (especially an
   expectation-gap entry on `setLoginItemSettings` under unsigned dev).
   Vitest: 98 / 98. Playwright: 18 / 18 (12 BTs + 6 R-tests).

## Honest reporting of simulated paths

Nearly every BT in L4 uses programmatic simulation in place of a real
OS interaction. This is deliberate and documented per surface:

| BT       | Surface                  | Real-OS path vs simulated path                                                                                                                    |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| BT-L4-1/2| Tray construction + state| Real — Tray is constructed with a real `nativeImage`; no signing required. The TITLE-only state machine is a deviation (see Deviations below).     |
| BT-L4-3  | Notifications            | **Failure path is real.** On unsigned dev macOS the OS rejects the notify and `failed` fires; that's the realistic test. The signed-success path is documented as `@signed-only` and deferred to L5/capstone. |
| BT-L4-4  | globalShortcut           | Registration is real. Firing is simulated via `test:fire-shortcut` invoking the stored handler — we don't drive an OS key event during CI.        |
| BT-L4-5  | powerMonitor             | Simulated. `powerMonitor.emit('suspend' | 'resume' | …)` per REF-06; putting the laptop to sleep mid-test is impractical.                         |
| BT-L4-6  | second-instance          | Simulated. `app.emit('second-instance', …)` rather than spawning a second binary; we still exercise the parse + dispatch + log path end-to-end.   |
| BT-L4-7  | open-url                 | Simulated. Per FM-06, macOS only routes `electron-l4://` to packaged apps; in dev we emit the event ourselves.                                    |
| BT-L4-8  | setLoginItemSettings     | Real call. The `observed` field reflects what `getLoginItemSettings` reports back — see Expectation gap below.                                    |
| BT-L4-9  | nativeTheme              | Real call. The `updated` event subscription is real; we also broadcast a synchronous snapshot on `setSource` so the test push fires deterministically. |
| BT-L4-10 | dock.setBadge            | Real call. `app.dock.getBadge()` is queried via `app.evaluate`.                                                                                   |
| BT-L4-11 | addRecentDocument        | Real call. The OS recent-items list is NOT inspectable from the test — we assert only invocation + log. Limitation documented.                    |
| BT-L4-12 | will-quit cleanup        | Simulated. We fire `app.emit('will-quit', …)` to exercise the cleanup, then re-read `globalShortcut.isRegistered(...)`.                            |

## Deviations from the prompt's "ideal" design

1. **Tray title strings as state markers, not template-PNG variants.**
   The prompt allowed using `●` / `▶` / `◌` / `⏸` text titles "for L4,
   real template-PNG variants arrive at the capstone." We do generate
   ONE shared template image (16×16 transparent base-64-embedded PNG)
   so the Tray constructor has a non-null `nativeImage`, but per-state
   icon variants are out of scope here. Documented as a deviation; the
   capstone POC's brief calls this out explicitly.
2. **Notification action / reply callbacks are wired but not asserted
   end-to-end.** In an unsigned dev build the OS rejects the notify
   before any button can be clicked. The handlers are registered
   (`notification:action` / `notification:reply` log entries are ready)
   so the moment we test on a signed build the handlers light up.
3. **`addRecentDocument` is fire-and-log.** No way to inspect the OS
   Recent Items list from JavaScript.

## Expectation gaps surfaced

### Entry 5 — `setLoginItemSettings` on unsigned dev under macOS 14

- **What I expected**: after `app.setLoginItemSettings({
  openAtLogin: true })`, `app.getLoginItemSettings().openAtLogin`
  would return `true`.
- **Why**: this is the documented round-trip; FM-09 / OQ-09 warn that
  macOS 13+ Service Management may interfere, but the docs also
  imply the legacy LSSharedFileList path still works for unsigned dev
  apps with `openAsHidden`.
- **What actually happened**: in the unsigned dev test environment
  (macOS 14.x), `setLoginItemSettings({ openAtLogin: true,
  openAsHidden: true })` succeeded silently; the immediately
  subsequent `getLoginItemSettings().openAtLogin` sometimes returned
  `false` regardless. The disable path (`openAtLogin: false`) was
  reliable.
- **Resolution**: BT-L4-8 asserts `requested` always and
  `observed === false` on the disable side; the enable side asserts
  only `requested === true` and the structured log. The full
  bidirectional state assertion is deferred to a signed packaged build
  in L5.
- **Promoted to expectation-gap-ledger**: Yes — see Entry 5 in
  `04_logs/expectation-gap-ledger.md`.

### Entry 6 — `Notification.failed` payload shape on macOS 14

- **What I expected**: per docs, `failed` fires with `(event, error)`
  where `error` is a string describing the failure ("Application is
  not code-signed" or similar).
- **What actually happened**: in the dev runs the listener got
  `error` as the literal string from the OS; no surprises. Kept for
  the ledger as a sanity-check entry; would be Entry 6 only if a
  future build observes a different shape.

## What the regression tests buy

R-L4-1..6 catch six specific regressions that the BTs alone could miss:

- R-L4-1: a future agent refactors the Tray into a closure-local var
  inside `installTray`; BT-L4-1/2 might still pass momentarily, but
  the runtime check fails when the tray view loses its image after a
  GC cycle.
- R-L4-2: a future agent registers a new globalShortcut without
  remembering the cleanup hook. Static check fails immediately.
- R-L4-3: a future agent adds a new notification call site without
  wiring `failed` first. The static-source check catches the regression
  even if the call is in unsigned-dev-only code that never fires in CI.
- R-L4-4: a future agent loosens `parseDeepLink` and accepts a partial
  parse. The boundary array (`electron-l4://`, `electron-l4://%`,
  `electron-l4:/oops`) catches it.
- R-L4-5: a future agent moves the single-instance lock inside
  `whenReady()`. Byte-offset comparison fails.
- R-L4-6: a future agent removes the cleanup-on-remove path. The
  static check for `openAtLogin: false` AND `cleanupOnRemove` in
  `autolaunch.ts` fails.

## Toolchain / build

Same as L1/L2/L3: `tsc` for main + `esbuild` for preload + static
HTML copied. No electron-forge yet; that's L5. The preload bundle is
24.8 KB.

## Test counts (final)

- Vitest: **98 / 98** unit tests across 10 files.
- Playwright (`_electron`): **18 / 18** e2e tests
  (12 BT-L4-N + 6 R-L4-N).

## Risks / what's intentionally NOT here

- **Real protocol-routing test**: only achievable in a packaged build
  with `CFBundleURLTypes` declared in `Info.plist`. Deferred to L5.
- **Real keyboard-event-driven shortcut**: requires automation tools
  beyond Playwright. Deferred (and likely manual) in the capstone.
- **Notification action button click**: requires a signed build.
  Deferred to L5/capstone.
- **OS recent-items inspection**: not possible from JavaScript.
  Permanent test limitation.
- **`crashReporter` wiring**: out of L4's scope (L5/capstone).

## Recommended next step

**L5 — Packaging, Code Signing, Auto-Update.** L4's surface is what
L5 needs to package: the menu-bar tray, the deep-link scheme, the
notifications that actually display on a signed build, the auto-launch
path that round-trips reliably under macOS 13+ Service Management.
After L5, the capstone Pulse can stitch L1..L5 into the polished
menu-bar focus + journal companion.
