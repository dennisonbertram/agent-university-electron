# Pulse — Capstone POC

A no-dock macOS menu-bar app that combines every prior POC's surface (L1
skeleton → L5 packaging) with two new subsystems:

1. **Focus mode** — a pomodoro-style state machine (`idle` / `focus` /
   `break` / `paused`) with a global hotkey (`Cmd+Shift+P`), sleep-aware
   pause/resume (powerMonitor `suspend` / `resume`), and notification-driven
   flow control ("+5 min" extends the current session).
2. **Encrypted journal** — quick-capture text entries from the deep link
   `pulse://log?text=...` or the global hotkey `Cmd+Shift+J`. Rows are
   stored in SQLite (`better-sqlite3`) with `safeStorage.encryptString`
   wrapping the text into a `BLOB` ciphertext. Viewing the journal requires
   `systemPreferences.promptTouchID` with a PBKDF2+timing-safe passphrase
   fallback.

## What this POC proves

| BT     | Surface                                       | Drives via                       |
| ------ | --------------------------------------------- | -------------------------------- |
| BT-C-1 | Cmd+Shift+P starts a 25-min focus session     | `test:fire-shortcut` IPC         |
| BT-C-2 | sleep + resume pauses + resumes; pausedForMs  | `test:emit-power-event`          |
| BT-C-3 | +5min notification action handler runs        | `test:trigger-notification-action` |
| BT-C-4 | focus → break at expiry + completion notif    | `test:advance-clock`             |
| BT-C-5 | `pulse://log` ⇒ encrypted row + notif         | `test:fire-deep-link` + `test:get-raw-journal-rows` |
| BT-C-6 | Touch ID unavailable ⇒ fallback (no decrypt)  | `TOUCH_ID_UNAVAILABLE=1`         |
| BT-C-7 | passphrase verify (timing-safe compare)       | `journal:unlock-with-passphrase` |
| BT-C-8 | Touch ID available + stubbed prompt ⇒ unlock  | `TOUCH_ID_FORCE_AVAILABLE=1`     |
| BT-C-9 | relaunch restores journal rows; idle state    | Two `launchApp` calls            |
| BT-C-10 | `dock.hide()` + `LSUIElement: true`           | `boot:summary` IPC + plist read  |
| BT-C-11 | packaged Info.plist registers `pulse://`      | `runPackage()` + plist read      |
| BT-C-12 | packaged app boots; canonical log sequence    | `launchPackagedApp()`            |

| R       | Regression                                    | Mechanism                       |
| ------- | --------------------------------------------- | ------------------------------- |
| R-C-1   | safeStorage-unavailable fallback              | static + runtime probe          |
| R-C-2   | journal-store references `safeStorage.encryptString` + main calls it | static     |
| R-C-3   | SQLite index `idx_journal_created_at`         | runtime (read schema)           |
| R-C-4   | `requestSingleInstanceLock` pre-`whenReady`   | static + runtime IPC dispatch   |
| R-C-5   | `crashReporter.start()` pre-`whenReady`       | static                          |
| R-C-6   | input length caps (10_000 / 4_096)            | runtime IpcValidationError      |
| R-C-7   | `globalShortcut.unregisterAll()` in will-quit | static                          |
| R-C-8   | `AutoUnpackNativesPlugin` in forge.config.ts  | static                          |

## How to run

### Prerequisites

- macOS (the Pulse capstone targets darwin only).
- Node 20+ (development uses Node 24.15.0).
- Xcode Command Line Tools (for native-module rebuilds).

### Install + setup

```sh
npm install
# `postinstall` automatically runs scripts/patches/better-sqlite3-v8-tag.mjs.
# See "Native-module gotcha" below.
```

### Run in dev

```sh
npm run start
# Triggers `build` (tsc + esbuild bundle + renderer copy) + `rebuild:electron`
# (electron-rebuild for better-sqlite3).
```

### Run unit tests (vitest, system Node)

```sh
npm test
# `pretest` rebuilds better-sqlite3 against system Node's ABI.
# 87 tests across 15 files, ~250ms.
```

### Run e2e tests (Playwright, Electron 42)

```sh
npm run test:e2e
# `pretest:e2e` rebuilds better-sqlite3 against Electron's ABI.
# 22 tests, ~13s.
```

### Package the app

```sh
npm run package
# Produces out/Pulse-darwin-arm64/Pulse.app.
# Without APPLE_ID env, signing/notarization are skipped and
# `simulated-signing.md` + `test-results/packaging-skip.log` are written.
```

## Deep links

- `pulse://start?duration=25` — start a focus session (duration in minutes).
- `pulse://stop` — stop the current session.
- `pulse://log?text=...` — append an encrypted journal entry.

For dev-mode testing, drive them via the gated `test:fire-deep-link` IPC
channel instead of relying on macOS to route to the unpackaged binary.

## Native-module gotcha

`better-sqlite3@12.10.0` does not yet support Electron 42's V8 14.x API
(`ExternalPointerTypeTag`). `scripts/patches/better-sqlite3-v8-tag.mjs`
adds three `#if V8_MAJOR_VERSION >= 14` guards to the bound C++ source so
the SAME node_modules tree compiles cleanly for BOTH system Node (vitest)
and Electron 42 (Playwright). The patch is idempotent and runs as
`postinstall`. See Entry 12 in `04_logs/expectation-gap-ledger.md`.

When you switch between `npm test` and `npm run test:e2e`, the `pretest*`
hooks rebuild better-sqlite3 for the correct ABI. If you see
`NODE_MODULE_VERSION 146 vs 137` errors, run the appropriate hook manually:

```sh
npm run rebuild:node       # for vitest (system Node)
npm run rebuild:electron   # for Playwright / packaging
```

## Test seams

All test-only IPC channels are gated by `testHooksEnabled()`:
`NODE_ENV === 'test' || PULSE_TEST_HOOKS === '1' || L5_TEST_HOOKS === '1' || L4_TEST_HOOKS === '1'`.
Test seams added at the capstone:

- `test:advance-clock { toMs }` — jumps the focus engine's monotonic clock.
- `test:trigger-notification-action { id, actionIndex }` — invokes a
  registered notification-action handler programmatically. `id: 'latest'`
  resolves to the most-recently-issued notification id.
- `test:fire-deep-link { url }` — dispatches a `pulse://` URL through
  the lifecycle router as if `open-url` had fired.
- `test:get-boot-summary` — returns the boot-time wiring snapshot
  (tray/journal/focus/biometric installed, dockHidden, encryptionAvailable,
  journalRowsAtBoot).
- `test:get-raw-journal-rows` — returns each row as base64 ciphertext so a
  Playwright spec can assert encryption without loading better-sqlite3
  in the test process (Decision 12).

## Code layout

```
src/
  main.ts            — pre-ready order: lock, crash, dock.hide, then whenReady
  preload.ts         — contextBridge surface (gated test seams included)
  window.ts          — frameless popover BrowserWindow + SECURE_WEB_PREFERENCES
  ipc.ts             — channel registry (validators + handlers + push)
  ipc-validation.ts  — DoS-resistance length caps live here
  security.ts        — will-navigate + setWindowOpenHandler + permission denial
  log.ts             — JSON-lines logger contract
  tray.ts            — state machine (idle/focus/break/paused) + module-scope handle
  notifications.ts   — show() with `failed` listener + action-handler registry
  shortcuts.ts       — Cmd+Shift+P + Cmd+Shift+J + will-quit cleanup
  power.ts           — powerMonitor wired to the focus engine
  lifecycle.ts       — pulse:// dispatch + open-url + second-instance
  protocol.ts        — strict pulse:// parser (returns [parsed, null] | [null, err])
  dock.ts            — hide() + setBadge() + addRecentDocument()
  autolaunch.ts      — openAsHidden:true for menu-bar UX
  theme.ts           — nativeTheme.themeSource
  updater.ts         — electron-updater (provider:'generic' invariant)
  crash.ts           — crashReporter pre-ready
  focus-engine.ts    — pure reducer + EventEmitter wrapper + clock seam
  journal-store.ts   — better-sqlite3 + safeStorage encryptor + index
  biometric.ts       — Touch ID with env-flag-driven branches
  passphrase.ts      — PBKDF2-SHA256 100k + crypto.timingSafeEqual
  renderer/
    index.html
    renderer.ts
    renderer.d.ts
scripts/
  build-preload.mjs           — esbuild bundle (preload is sandboxed)
  copy-renderer.mjs           — static HTML copy
  local-update-server.mjs     — local update fixture HTTP server
  seed-fixture-db.mjs         — clean-slate fixture DB helper
  fixtures/
    latest-mac.yml.update     — manifest declaring version 1.0.1
    latest-mac.yml.current    — manifest declaring version 1.0.0
  patches/
    better-sqlite3-v8-tag.mjs — V8 14.x compatibility patch
tests/
  unit/             — 15 files, 87 tests, ~250ms
  e2e/              — 8 files, 22 tests (BT-C-1..12 + R-C-1..8), ~13s
```

## Logs the test suite asserts

Every behavioral test grep-asserts a structured log marker. The full list:

- `app:starting`, `app:ready`, `app:install-complete`, `app:dock-hidden`
- `safe-storage:availability`
- `crash-reporter:started`
- `protocol:registered`, `lifecycle:open-url`, `lifecycle:second-instance`
- `deeplink:dispatched`, `deeplink:start:dispatched`, `deeplink:log:dispatched`
- `tray:installed`, `tray:state-changed`
- `shortcut:registered`, `shortcut:CmdOrCtrl+Shift+P:fired`, `shortcut:cleanup:will-quit`
- `notification:show:requested`, `notification:shown`, `notification:failed:unsigned`,
  `notification:trigger-action:invoked`
- `power:suspend`, `power:resume`
- `focus:start:25min`, `focus:paused:sleep`, `focus:resumed:after-sleep`,
  `focus:extended:+5min`, `focus:complete`
- `journal:append:1-row`, `journal:list:touch-id-fallback`,
  `journal:unlocked:touch-id`, `journal:unlocked:passphrase`,
  `journal:unlock:failed`, `journal:encryption-unavailable:fallback-plaintext`
- `boot:restored:<N>-journal-entries`
- `updater:configured`, `updater:checking`, `updater:update-available`
- `packaging:signing:skipped:no-credentials`

## See also

- `test-plan.md` — full test plan including SKIP rationale.
- `poc-report.md` — what worked, what didn't, deviations, future work.
- `simulated-signing.md` — what would happen with real Apple credentials.
- `04_logs/decision-log.md` § Decision 11 (hybrid build) + Decision 12 (in-process SQLite IPC seam).
- `04_logs/expectation-gap-ledger.md` § Entry 12 (better-sqlite3 vs V8 14).
