# POC L2 — Secure IPC — Report

Built: 2026-05-17. **Outcome: PASS** — all 9 behavioral tests
(BT-L2-1..8 + BT-L2-5b), all 4 regression tests, and all 24 unit tests
pass on macOS 15.7.7 / arm64 with Electron 42.1.0 / Node 24.15.0.

Commit trail:

| Commit    | Phase      | Summary                                                              |
| --------- | ---------- | -------------------------------------------------------------------- |
| `69a1499` | RED        | Failing tests + skeleton `src/`; 11 real failures across both runners. |
| `477565d` | GREEN      | Full implementation; 24 unit + 9 e2e pass.                           |
| (this)    | REGRESSION | R-L2-1..4 + docs + log entries; 24 unit + 13 e2e pass.               |

---

## 1. What was built

Under `degrees/01-electron-overview/03_pocs/L2-secure-ipc/`:

- **Main process** (`src/main.ts`) — registers the deny-all permission
  handler, the IPC channel registry, and per-window security guards
  before any renderer is created. Runs a 200ms tick stream that pushes
  monotonically increasing `n` to the renderer via `webContents.send`.
- **Preload** (`src/preload.ts`) — `contextBridge.exposeInMainWorld('api', …)`
  with four narrow methods: `ping`, `echo`, `journalAppend`, `onTick`.
  Bundled by esbuild (NEW for L2 — see Decision 5) so it can import
  shared TS modules cleanly. The `rethrowingInvoke` helper recovers
  the `IpcValidationError` name across the IPC boundary.
- **Window factory** (`src/window.ts`) — exports `SECURE_WEB_PREFERENCES`
  and `createMainWindow()`. R-L2-3 enforces every new window goes
  through this factory.
- **IPC registry** (`src/ipc.ts`) — `IPC_REGISTRY` table mapping
  channel → `{ channel, kind, validator, handler }`. `registerIpc()`
  wraps each handler in `validate(arg)` → `handler(validatedArg)`,
  emitting `ipc:<ch>:served` on success and
  `ipc:<ch>:validation-failed` (level=warn) on validator failure.
- **Validators** (`src/ipc-validation.ts`) — hand-rolled `IpcValidationError`
  + per-channel validators. No Zod dependency.
- **Security guards** (`src/security.ts`) —
  `setWindowOpenHandler` returns `{ action: 'deny' }`; `will-navigate`
  + `will-redirect` prevent navigation to any non-`file://` origin;
  permission requests are denied across the session; `will-attach-webview`
  hardens any future webview.
- **Renderer** (`src/renderer/index.html` + `renderer.ts`) — strict CSP
  meta tag, minimal script. The behavioral tests do the work via
  Playwright `window.evaluate`.

---

## 2. Test outcomes

### RED commit `69a1499`

- **Vitest** — 4 failed | 20 passed (24 tests).
  Failures: validators not implemented (`'IpcValidationError: validator
  not implemented (RED skeleton)'`).
  CSP and security-defaults tests pass because the static config is
  correct from the start; they only fail under future regressions.
- **Playwright** — 7 failed | 2 passed (9 tests).
  - BT-L2-1: `Error: No handler registered for 'app:ping'`
  - BT-L2-3 / BT-L2-4: timeout waiting for `security:*:blocked` log entry
  - BT-L2-5 / BT-L2-5b: rejection has `name: 'Error'`, no validation log
  - BT-L2-7: `No handler registered for 'app:echo'`
  - BT-L2-8: `result.length === 0`
  - BT-L2-2 (isolation) and BT-L2-6 (CSP) pass — preload + CSP meta
    were wired with correct flags from the skeleton; their behaviors
    are properties of static config rather than dynamic handlers.

### GREEN commit `477565d`

- **Vitest** — 24/24 pass in 89ms.
- **Playwright** — 9/9 pass in 6.3s. BT-L2-5 required a fix to the
  error-name transport (see Decision 6 below).

### REGRESSION commit (this commit)

- **Vitest** — 24/24 pass (unchanged from GREEN).
- **Playwright** — 13/13 pass (9 BT + 4 R) in 7.1s.

Verbatim output captured in `04_logs/test-results.md` Entries 4–6.

---

## 3. Decisions made (also logged in `04_logs/decision-log.md`)

### D-5: esbuild for preload bundling

Adopted at L2. Eliminates L1's inline-channel-strings workaround. The
preload now imports `IPC_CHANNELS`, `PUSH_CHANNELS`, and
`IPC_VALIDATION_ERROR_PREFIX` from `./ipc` directly. `external: ['electron']`
in the esbuild config preserves the runtime `require('electron')` so
Electron's sandbox-preload whitelist still resolves correctly.

### D-6: Plain-object throw for typed IPC errors

Electron drops `Error.name` when serializing across the
ipcMain.handle → renderer boundary. Even setting `.name` on a fresh
Error in the preload didn't survive contextBridge cloning. The
working pattern: main throws `new Error('__IPCVE__:<msg>')`; the
preload strips the sentinel and throws a plain object
`{ name: 'IpcValidationError', message }`. The renderer's
`catch (err)` then sees `err.name === 'IpcValidationError'`.

This is a non-obvious behavior of Electron's contextBridge serialization
and is logged as `expectation-gap-ledger` Entry 3.

---

## 4. Expectation gaps logged

| #   | Title                                                                | Severity |
| --- | -------------------------------------------------------------------- | -------- |
| 3   | Electron contextBridge drops Error.name when cloning Error instances | medium   |

Full entry in `04_logs/expectation-gap-ledger.md`.

---

## 5. Invariants future POCs inherit

1. Every new IPC channel MUST be enrolled in `IPC_REGISTRY` with a
   validator. R-L2-2 fails otherwise.
2. Every new BrowserWindow MUST go through `createMainWindow()`
   (`SECURE_WEB_PREFERENCES`). R-L2-3 fails otherwise.
3. Strict CSP (no `unsafe-inline`, no `unsafe-eval` in script-src) must
   not be weakened. R-L2-4 + the unit `csp.test.ts` enforce this.
4. The structured-log contract from L1 is preserved.
5. Validation errors surface to the renderer as
   `{ name: 'IpcValidationError', message }` (a plain object), NOT
   an `Error` instance with `name` set. Change the preload pattern in
   sync with BT-L2-5 if you ever rework this.

---

## 6. Recommendations for L3

1. **Add atomic write-rename file persistence.** Use `fs.writeFile` to
   a temp file + `fs.rename`, both within `app.getPath('userData')`.
   Pair every persistence operation with an IPC validator (extend
   `IPC_REGISTRY`).
2. **Keep the `LOG_DIR` env-var pattern.** The Playwright helper in
   `tests/e2e/helpers.ts` is already L3-ready; copy it verbatim.
3. **Consider opening the secure baseline `webPreferences` for one
   small extension at L3**: `additionalArguments` or a constrained
   `preload` upgrade for the menu wiring. Document any extension in
   the decision log.
4. **Wire `dialog.show*Dialog` through `IPC_REGISTRY`.** The
   validator is trivial (no args, or a typed-options object); the
   important part is that the dialog flow inherits L2's centralized
   logging and validation.

---

## 7. Time spent (informal)

- Scaffold + failing tests (RED): ~30 min.
- Implementation (GREEN), including the IpcValidationError boundary
  workaround: ~45 min.
- Docs + regression tests (REGRESSION): ~25 min.

Total: ~1.7 hours.

---

## 8. Risks / blockers

None encountered after Decision 6 (plain-object error throw). The
remaining open items are L3+ scope.
