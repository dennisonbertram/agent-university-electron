# L4 — Test Plan

Behavioral tests (BT-L4-N) come from `poc-plan.md`, expanded for
testability per the L4 prompt. Regression tests (R-L4-N) probe
invariants that the BTs could pass through other paths. Almost every
test uses programmatic simulation — see `poc-report.md` § "Honest
reporting of simulated paths".

## Behavioral tests

### BT-L4-1 — Tray exists at boot

- **Given** the app has booted with `NODE_ENV=test` and
  `L4_TEST_HOOKS=1`.
- **When** the renderer calls `window.api.appGetTrayState()`.
- **Then** the reply is `{ state: 'idle', title: '●', hasImage: true }`.
- **Why this is testable in dev**: the Tray constructor does not
  require code signing on macOS; we read the live instance's state via
  the IPC adapter.
- **File**: `tests/e2e/tray.spec.ts`.

### BT-L4-2 — `tray:set-state` flips title within one tick

- **Given** the tray is `idle`.
- **When** the renderer calls
  `window.api.traySetState({ state: 'focused' })`.
- **Then** the response carries `{ ok: true, view: { state: 'focused',
  title: '▶' } }` and a subsequent `appGetTrayState()` confirms.
- **File**: `tests/e2e/tray.spec.ts`.

### BT-L4-3 — Notification with two buttons fires `failed` (unsigned dev)

- **Given** the unsigned dev build is running.
- **When** the renderer calls
  `notificationShow({ title, body, actions: [{type:'button', text:'Reply'}, {type:'button', text:'Dismiss'}] })`.
- **Then** the response on darwin is `{ ok: false, id, failed:
  { error } }` AND the log file contains a
  `notification:failed:unsigned` entry. On non-darwin platforms the
  test asserts the `ipc:notification:show:served` log entry instead.
- **Why this is realistic for dev**: per FM-05 / REF-04, unsigned dev
  builds on macOS never display notifications; the `failed` event is
  the only observation we get.
- **File**: `tests/e2e/notifications.spec.ts`. The `@signed-only` case
  (would-resolve-`ok:true`) is documented as a comment for L5/capstone.

### BT-L4-4 — globalShortcut handler fires via test seam

- **Given** the app booted; `shortcut:registered` log entry confirms
  `CmdOrCtrl+Shift+P` is held.
- **When** the test calls `test:fire-shortcut` with that accelerator.
- **Then** `globalShortcut.isRegistered('CmdOrCtrl+Shift+P')` returns
  true; the renderer receives a `shortcut:fired` push with
  `{ accelerator }`; the log contains `shortcut:CmdOrCtrl+Shift+P:fired`.
- **Why this is simulated**: we cannot reliably press a key combo
  during automation across CI environments. The handler-invocation
  path proves the wiring; OS-level press is exercised manually.
- **File**: `tests/e2e/shortcuts.spec.ts`.

### BT-L4-5 — powerMonitor suspend/resume cycle

- **Given** the tray state is `focused`.
- **When** the test calls `test:emit-power-event` with
  `{ event: 'suspend' }`.
- **Then** the log contains `power:suspend`; `appGetTrayState()`
  reports `paused`.
- **And when** the test calls `test:emit-power-event` with
  `{ event: 'resume' }`.
- **Then** the log contains `power:resume`; the tray returns to
  `focused`.
- **Why this is simulated**: putting the laptop to sleep during a
  Playwright run isn't practical. We drive `powerMonitor.emit(...)`
  directly per REF-06.
- **File**: `tests/e2e/power.spec.ts`.

### BT-L4-6 — second-instance with deep-link arg

- **Given** the first instance holds the single-instance lock.
- **When** the test fires
  `app.emit('second-instance', _event, [execPath, 'electron-l4://action?x=1'], cwd)`.
- **Then** the log contains `lifecycle:second-instance` with the
  parsed payload; the renderer receives a `lifecycle:open-url` push
  whose `origin === 'second-instance'` and `url` begins with
  `electron-l4://`.
- **File**: `tests/e2e/lifecycle.spec.ts`.

### BT-L4-7 — `open-url` parses + dispatches

- **Given** the app is running on macOS.
- **When** the test fires
  `app.emit('open-url', _event, 'electron-l4://action?y=2')`.
- **Then** the log contains `lifecycle:open-url` with the parsed
  payload; the renderer receives a `lifecycle:open-url` push whose
  `origin === 'open-url'`.
- **Why this is simulated**: per FM-06, the OS only routes
  `electron-l4://` URLs to packaged apps; in dev the event must be
  emitted by us.
- **File**: `tests/e2e/lifecycle.spec.ts`.

### BT-L4-8 — `app:set-autolaunch` flips openAtLogin + logs

- **Given** the app is running.
- **When** the renderer calls
  `appSetAutoLaunch({ enabled: true })` then
  `appSetAutoLaunch({ enabled: false })`.
- **Then** each call is logged as `autolaunch:set:requested`; the
  enable result returns `{ requested: true }` (the `observed` field is
  best-effort under macOS 13+ / unsigned dev, see expectation-gap
  Entry 5); the disable result returns `{ requested: false, observed:
  false }`.
- **File**: `tests/e2e/autolaunch.spec.ts`.

### BT-L4-9 — `app:set-theme` flips nativeTheme + push fires

- **Given** the app is running.
- **When** the renderer calls `appSetTheme({ source: 'dark' })`.
- **Then** the response is `{ source: 'dark', isDark: true }`; the
  log contains `theme:source-set:dark`; a `theme:changed` push lands
  in the renderer with the same payload. Flipping back to `light`
  reverses both.
- **File**: `tests/e2e/theme.spec.ts`.

### BT-L4-10 — `dock:set-badge`

- **Given** `process.platform === 'darwin'` (test is skipped on
  others).
- **When** the renderer calls `dockSetBadge({ badge: '3' })`.
- **Then** `app.dock.getBadge()` returns `'3'`; the log contains
  `dock:badge-set:3`. Calling with `''` clears the badge.
- **File**: `tests/e2e/dock.spec.ts`.

### BT-L4-11 — `app:add-recent`

- **Given** the app is running.
- **When** the renderer calls `appAddRecent({ filePath: '/tmp/sample.md' })`.
- **Then** the response is `{ ok: true }`; the log contains
  `recent:added`.
- **Limitation**: we cannot assert macOS actually surfaced the entry
  in the Recent Items list; that's a manual check during exploratory
  testing.
- **File**: `tests/e2e/dock.spec.ts`.

### BT-L4-12 — `will-quit` unregisters globalShortcut

- **Given** the app booted; `CmdOrCtrl+Shift+P` is registered.
- **When** the test calls `test:trigger-will-quit`.
- **Then** the log contains `lifecycle:will-quit:cleanup`;
  `globalShortcut.isRegistered('CmdOrCtrl+Shift+P')` returns false.
- **File**: `tests/e2e/lifecycle.spec.ts`.

## Regression tests

### R-L4-1 — Tray module-scope variable (GC-safe)

- **Static**: `src/tray.ts` declares `let trayInstance` at module
  scope.
- **Runtime**: launch, snapshot tray state, sleep 2s, snapshot again.
  Both reads return `hasImage: true` and the same `state`.
- **File**: `tests/e2e/regression.spec.ts`.

### R-L4-2 — globalShortcut cleanup pairing

- **Static**: `src/shortcuts.ts` contains `globalShortcut.register`,
  `app.on('will-quit'`, and `globalShortcut.unregisterAll()`.
- **File**: `tests/e2e/regression.spec.ts` + `tests/unit/shortcut-cleanup.test.ts`.

### R-L4-3 — Notification `failed` listener pairing

- **Static**: `src/notifications.ts` contains `new Notification(...)`,
  `.on('failed'`, and `.show(`; the `failed` listener appears BEFORE
  the show call.
- **Runtime**: `notificationShow` always resolves to a structured
  shape (`{ ok, id }` or `{ failed: { error } }`); never `undefined`.
- **File**: `tests/e2e/regression.spec.ts` +
  `tests/unit/notification-failed-listener.test.ts`.

### R-L4-4 — `parseDeepLink` boundary

- **Pure unit**: `electron-l4://`, `electron-l4://%`, `electron-l4:/oops`,
  `https://example.com`, `''`, and `undefined` all return
  `[null, Error]`. A valid input still parses correctly.
- **File**: `tests/e2e/regression.spec.ts` +
  `tests/unit/parse-deep-link.test.ts`.

### R-L4-5 — `requestSingleInstanceLock` ordering

- **Static**: `src/main.ts` calls `requestSingleInstanceLock()`
  BEFORE the first `whenReady()` invocation (byte-offset comparison).
- **File**: `tests/e2e/regression.spec.ts` +
  `tests/unit/single-instance-lock-order.test.ts`.

### R-L4-6 — Autolaunch cleanup path

- **Static**: `src/autolaunch.ts` contains a literal
  `openAtLogin: false` AND a `cleanupOnRemove` function reference.
- **File**: `tests/e2e/regression.spec.ts`.

## Carry-forward unit tests (L1/L2/L3)

- `csp.test.ts` — CSP meta tag is unchanged from L2.
- `security-defaults.test.ts` — secure webPreferences from L2.
- `storage.test.ts` — atomic JSON journal from L3 (the file watcher's
  carry-forward integration test stays in the e2e suite under
  `helpers.ts` boot semantics).
- `ipc-registry-coverage.test.ts` — every registry entry has a
  validator + handler, plus the new L4 channels are all present.
- `ipc-validation.test.ts` — exhaustive per-validator coverage.
- `tray-state-machine.test.ts` — STATE_TITLE table is dense + distinct.
