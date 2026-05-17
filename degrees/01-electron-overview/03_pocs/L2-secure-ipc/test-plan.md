# Test Plan — L2 Secure IPC

Drawn directly from `00_metadata/poc-plan.md` L2 section, expanded to be
testable. Each test is one or more concrete assertions with a fixed boot
strategy (Playwright `_electron` + temp `LOG_DIR`).

## Behavioral tests

### BT-L2-1 — Typed two-way IPC: app:ping

- **Given** the renderer is loaded and `window.api.ping` exists.
- **When** the renderer calls `window.api.ping()`.
- **Then** main responds with `{ pong: true, ts: number, monotonic: number }`
  AND a `ipc:ping:served` log entry is emitted.

Spec: `tests/e2e/secure-ipc.spec.ts`.

### BT-L2-2 — contextIsolation + nodeIntegration:false

- **Given** the renderer loaded the strict-defaults BrowserWindow.
- **When** `typeof require` and `typeof process` are evaluated in the
  renderer.
- **Then** both are `'undefined'`. `window.api` exists but does NOT
  expose `ipcRenderer`.

Spec: `tests/e2e/isolation.spec.ts`.

### BT-L2-3 — setWindowOpenHandler denies external URLs

- **Given** the renderer is loaded.
- **When** the renderer calls `window.open('https://evil.example')`.
- **Then** the handler returns `{ action: 'deny' }`; no new
  BrowserWindow is created; main logs `security:window-open:blocked`
  with `payload.url` containing `evil.example`.

Spec: `tests/e2e/navigation-guards.spec.ts`.

### BT-L2-4 — will-navigate blocks external navigation

- **Given** the renderer is loaded.
- **When** the renderer assigns `location.href = 'https://evil.example'`.
- **Then** `will-navigate` prevents it; main logs
  `security:navigation:blocked`; the renderer URL stays the original
  `file://…`.

Spec: `tests/e2e/navigation-guards.spec.ts`.

### BT-L2-5 — IPC validation surface

- **Given** the IPC registry validates every channel.
- **When** the renderer calls `window.api.journalAppend({ text: 123 })`.
- **Then** the promise rejects with `err.name === 'IpcValidationError'`
  AND main logs `ipc:journal:append:validation-failed` AND the app stays
  alive.

Companion BT-L2-5b: a valid call `{ text: 'hello journal' }` resolves
`{ ok: true }` and logs `ipc:journal:append:served`.

Spec: `tests/e2e/secure-ipc.spec.ts`.

### BT-L2-6 — CSP forbids inline scripts

- **Given** the renderer's CSP has `script-src 'self'` and no
  `'unsafe-inline'`.
- **When** the renderer injects a `<script>` whose source sets a known
  global.
- **Then** the global stays `undefined` (Chromium refused to execute).

Spec: `tests/e2e/csp.spec.ts`.

### BT-L2-7 — Typed two-way IPC: app:echo

- **Given** the renderer is loaded.
- **When** `window.api.echo('hello')` and
  `window.api.echo({ x: 1, nested: { y: 'z', arr: [1,2,3] } })` are called.
- **Then** each resolves with the input verbatim (structured-clone
  round-trip preserved). Main logs `ipc:echo:served` with a numeric
  `payload.payloadSize` for each call.

Spec: `tests/e2e/secure-ipc.spec.ts`.

### BT-L2-8 — Main→renderer tick stream

- **Given** main runs a 200ms `setInterval` that calls
  `webContents.send('tick', n)`.
- **When** the renderer subscribes via `window.api.onTick(handler)` and
  waits ~1.1s.
- **Then** the handler fires at least 4 times with strictly
  monotonically increasing `n`. Cleanup via the returned disposer
  unsubscribes.

Spec: `tests/e2e/secure-ipc.spec.ts`.

## Regression tests

### R-L2-1 — contextIsolation cannot be silently turned off

- Probe: try to mutate `window.api.ping` from the main world; the
  exposed value is frozen so the original method must survive. Also
  cross-check that `require`, `process`, `global`, `Buffer` are not
  reachable from the main world.

Spec: `tests/e2e/regression.spec.ts`.

### R-L2-2 — every IPC channel has a validator

- **Source-side**: `tests/unit/ipc-registry-coverage.test.ts` enumerates
  `IPC_REGISTRY` and asserts every entry exposes a `validator`
  function, a `handler` function, a `channel` string, and a
  `kind` of `'invoke'` or `'send'`.
- **Runtime-side**: `tests/e2e/regression.spec.ts` calls
  `journalAppend({ totally: 'wrong' })` and asserts the
  `ipc:journal:append:validation-failed` log entry is written
  (cross-check that the wrapper actually runs the validator).

### R-L2-3 — secure webPreferences invariant

- **Source-side**: `tests/unit/security-defaults.test.ts` reads
  `src/window.ts` and asserts the constants
  (`contextIsolation`, `sandbox`, `nodeIntegration`, `webSecurity`).
- **Runtime-side**: `tests/e2e/regression.spec.ts` enumerates every
  living BrowserWindow via `BrowserWindow.getAllWindows()` and reads
  each `webContents.getLastWebPreferences()` to verify the applied
  prefs match.

### R-L2-4 — CSP integrity

- **Source-side**: `tests/unit/csp.test.ts` reads
  `src/renderer/index.html`, parses the CSP, and asserts:
  - `default-src 'self'`
  - `script-src 'self'` AND no `'unsafe-inline'` AND no `'unsafe-eval'`
  - `object-src 'none'`
  - `base-uri 'none'` (or `'self'`)
- **Runtime-side**: `tests/e2e/regression.spec.ts` reads the
  BUILD ARTIFACT `dist/renderer/index.html` (post-build) and asserts
  the same script-src strictness — catches any build step that
  rewrites the CSP after the source check passes.

## Unit-test inventory

- `tests/unit/ipc-validation.test.ts` — 9 tests, positive + negative
  cases for `validators.ping/echo/journalAppend`.
- `tests/unit/ipc-registry-coverage.test.ts` — 3 tests, registry shape
  and naming convention.
- `tests/unit/security-defaults.test.ts` — 6 tests, secure-default
  preflight on `src/window.ts`.
- `tests/unit/csp.test.ts` — 6 tests, CSP directive verification on
  `src/renderer/index.html`.

Total: 24 unit + 13 e2e = 37 tests.
