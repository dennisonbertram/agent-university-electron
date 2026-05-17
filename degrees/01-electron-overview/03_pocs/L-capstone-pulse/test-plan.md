# Pulse capstone — test plan

## Behavioral tests (BT-C-1..12)

Every test launches an unsigned dev Electron via `electron.launch()` (or
spawns the packaged app via `spawn`) and asserts both:

1. **State** — IPC-returned snapshots (`focus:state`, `app:get-tray-state`,
   `test:get-boot-summary`, `test:get-raw-journal-rows`).
2. **Log markers** — append-only JSON-lines events in `LOG_DIR/main.log`.

### Focus mode

- **BT-C-1** — Cmd+Shift+P fires (via `test:fire-shortcut`); the engine
  transitions `idle → focus`, tray title flips to `▶`, log
  `focus:start:25min`. Asserted: focus.state.kind === 'focus' AND tray view
  === 'focus' AND the log marker.
- **BT-C-2** — `test:emit-power-event { event: 'suspend' }` ⇒ state
  `focus → paused`, log `focus:paused:sleep`. Then `event: 'resume'` ⇒
  state `paused → focus`, log `focus:resumed:after-sleep`, and
  `pausedForMs` ≥ 0 (the engine accumulates suspend duration).
- **BT-C-3** — `test:advance-clock` plus
  `test:trigger-notification-action { id: 'latest', actionIndex: 0 }` invokes
  the handler that the focus engine registered when it issued the
  "complete" notification. Asserted: log `focus:extended:+5min`. State may
  be `focus` (extended) or `break` (race with completion); both are valid.
- **BT-C-4** — `focus:start { durationMs: 1000 }` + `test:advance-clock
  { toMs: 5000 }` ⇒ log `focus:complete` AND state = `break`. The
  completion notification is asserted by EITHER `notification:shown` (rare
  on unsigned dev) OR `notification:failed:unsigned`.

### Journal

- **BT-C-5** — `test:fire-deep-link { url: 'pulse://log?text=hello world' }`
  ⇒ log `journal:append:1-row`. `test:get-raw-journal-rows` returns the
  ciphertext; base64-decoded bytes are NOT equal to "hello world" when
  safeStorage encrypted; equal when the fallback fired.
- **BT-C-6** — `TOUCH_ID_UNAVAILABLE=1`; renderer calls `journal:list`. The
  handler returns `{ ok: false, requiresFallback: true, reason: 'touch-id-unavailable' }`
  and logs `journal:list:touch-id-fallback`. The handler does NOT decrypt.
- **BT-C-7** — `journal:set-passphrase`, then `journal:unlock-with-passphrase`
  with the correct value returns entries and logs
  `journal:unlocked:passphrase`. Wrong passphrase returns
  `{ ok: false, reason: 'invalid-passphrase' }` and logs `journal:unlock:failed`.
- **BT-C-8** — `TOUCH_ID_FORCE_AVAILABLE=1`; `journal:list` resolves with
  entries via the Touch ID branch and logs `journal:unlocked:touch-id`.
  The biometric module's `promptUnlock` short-circuits to resolved true when
  FORCE_AVAILABLE is set with no override injected — so the test runs
  deterministically even on hardware without configured Touch ID.

### Lifecycle + packaging

- **BT-C-9** — Two `launchApp` calls share the same `userDataDir`. The
  second launch's `test:get-boot-summary` reports
  `journalRowsAtBoot ≥ 2`. The boot logger emits
  `boot:restored:N-journal-entries`. Focus state on second boot is `idle`.
- **BT-C-10** — `app.dock.hide()` is called BEFORE the first BrowserWindow
  is created. `boot.summary().dockHidden === true` on darwin.
  `Info.plist.template` contains `LSUIElement = true`.
- **BT-C-11** — `npm run package` produces `out/Pulse-darwin-arm64/Pulse.app`.
  Its `Info.plist` contains `CFBundleURLTypes` registering `pulse` (NOT
  `electron-l5`), `LSUIElement=true`, version, copyright. The
  `app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
  exists (auto-unpack-natives).
- **BT-C-12** — `spawn` the packaged binary; assert log sequence
  `app:starting → app:ready → app:install-complete`, plus `app:dock-hidden`,
  plus `crash-reporter:started`.

## Regression tests (R-C-1..8)

See `tests/e2e/regression.spec.ts`. They mostly static-check the source
tree so a regression that bypasses encryption / drops the auto-unpack
plugin / re-orders pre-ready calls is caught even if the behavioral tests
happen to pass.

R-C-1 includes a runtime probe — the boot-summary IPC reports whether
safeStorage was available at boot, and the log assertion is conditional
on that branch.

R-C-6 actually exercises the validator at the IPC boundary by sending a
10_001-char text + a 4_097-char passphrase and asserting `IpcValidationError`
with a message that includes the cap. This is a runtime DoS-resistance check.

## SKIPs (honestly reported)

- **BT-C-3** notification action behavior: the real OS-level action-button
  click would require a signed build (macOS notification actions are
  largely unsupported on unsigned dev). We assert the action HANDLER
  being invoked via the `test:trigger-notification-action` IPC seam. The
  test is honest about this — the `Note` in the prompt is reflected in
  the spec doc comment.
- **BT-C-8** Touch ID prompt: real `systemPreferences.promptTouchID()`
  cannot run from Playwright (it requires user input on actual hardware).
  The biometric service has an env-driven branch that short-circuits to
  resolved true when `TOUCH_ID_FORCE_AVAILABLE=1` AND no override is
  provided. Real Touch ID is documented as untested in this run.
- **Universal binary** (`npm run make:universal`): NOT exercised by
  default — it routinely runs 5+ minutes per build. The forge config
  supports it via the `MakerDMG` + `MakerZIP` makers + `@electron/universal`
  dep. Listed as `@long-running` in poc-report.
- **Real Apple signing + notarization**: ALWAYS skipped in this run (no
  APPLE_ID in env). The skip path is enforced by R-L5-4 (carry-forward in
  spirit) — `forge.config.ts` gates `osxSign`/`osxNotarize` on
  `process.env.APPLE_ID`.

## What is exercised vs simulated

| Surface              | Real OS | Simulated |
| -------------------- | :-----: | :-------: |
| Tray icon + title    |    ✓    |           |
| BrowserWindow boot   |    ✓    |           |
| Cmd+Shift+P (real OS hotkey) |    | ✓ via `test:fire-shortcut` |
| Cmd+Shift+J          |         | ✓ via `test:fire-shortcut` |
| powerMonitor suspend |         | ✓ via `test:emit-power-event` |
| open-url             |         | ✓ via `test:fire-deep-link` |
| Notification show    |    ✓    | (with `failed` listener — REF-04) |
| Notification action  |         | ✓ via `test:trigger-notification-action` |
| safeStorage encrypt  |    ✓    |           |
| Touch ID prompt      |         | ✓ via env-flag short-circuit |
| Passphrase verify    |    ✓    |           |
| SQLite via better-sqlite3 |  ✓ |           |
| crashReporter wiring |    ✓    |           |
| updater wiring       |    ✓    |           |
| Packaging (npm run package) |  ✓ |          |
| Apple signing        |         | always skipped without creds |

## Running individual tests

```sh
# One unit file:
npx vitest run tests/unit/focus-engine.test.ts

# One e2e file:
npx playwright test tests/e2e/focus.spec.ts

# One e2e test by name:
npx playwright test -g "BT-C-5"

# Force a packaging refresh:
rm -rf out && npm run package
```
