# POC L4 — Deep macOS System Integration

L4 is the centerpiece of the standalone POC set. It exercises ten macOS
system-integration surfaces in one app, all riding on L2's secure-IPC
baseline and L3's atomic storage. Every surface lands behind a typed IPC
channel and is structured-logged so future POCs can observe the exact
event order without instrumenting in turn.

## What this POC proves

1. **Tray with state machine.** A module-scope `Tray` instance survives
   GC (FM-04, R-L4-1) and exposes a four-state machine `idle → focused
   → break → paused` with distinct title strings (`●` / `▶` / `◌` / `⏸`).
   The renderer-driven `tray:set-state` IPC flips the title inside one
   event-loop tick. (BT-L4-1, BT-L4-2.)
2. **Notifications under unsigned dev builds.** Every call to
   `Notification.show()` is preceded by a `failed` listener
   registration. On unsigned macOS dev builds the OS rejects the notify;
   the `failed` event fires; the service logs
   `notification:failed:unsigned` and resolves the IPC with
   `{ ok:false, failed: { error } }`. The signed-build path resolves
   `{ ok:true }`. (BT-L4-3, R-L4-3.)
3. **Global shortcut + lifecycle cleanup.**
   `globalShortcut.register('CmdOrCtrl+Shift+P', …)` runs at
   `whenReady`. The same module wires `app.on('will-quit', …)` →
   `globalShortcut.unregisterAll()` so zombie registrations cannot
   persist (R-L4-2). The test seam `test:fire-shortcut` invokes the
   registered handler directly so the e2e probe doesn't need an OS key
   event. (BT-L4-4, BT-L4-12.)
4. **powerMonitor save/restore.** On `suspend`, the tray's pre-event
   state is captured and the tray flips to `paused`; on `resume`, the
   prior state is restored. The test seam `test:emit-power-event` fires
   `powerMonitor.emit('suspend' | 'resume' | …)` programmatically per
   REF-06. (BT-L4-5.)
5. **Single-instance lock + deep-link routing.**
   `app.requestSingleInstanceLock()` is the very first runtime call —
   strictly BEFORE `whenReady()` (R-L4-5). The first instance receives
   `second-instance` with the second process's argv; we parse any
   `electron-l4://action?…` arg and dispatch the parsed link. The macOS
   `open-url` event handler is registered with the same
   `dispatchArgs(args, origin)` entry-point so both code paths converge.
   The strict parser rejects `electron-l4://`, `electron-l4://%`, and
   non-`electron-l4` schemes (R-L4-4). (BT-L4-6, BT-L4-7.)
6. **Auto-launch on login.** `app:set-autolaunch({ enabled })`
   wraps `setLoginItemSettings` and logs
   `autolaunch:set:requested` + `autolaunch:set:observed`. The
   `cleanupOnRemove()` path explicitly disables the login item; the
   sentinel `ensureLoginItemDisabledOnCleanup` keeps the literal
   `openAtLogin: false` token in the file for R-L4-6's static check.
   (BT-L4-8, R-L4-6.)
7. **nativeTheme push.** `app:set-theme({ source })` flips
   `nativeTheme.themeSource`; a synchronous broadcast emits a
   `theme:changed` push to every BrowserWindow. The `updated` event is
   also subscribed for system-driven changes. (BT-L4-9.)
8. **Dock badge + recent docs.** `dock:set-badge("3")` sets the dock
   badge; clearing with `""` works; a structured log fires for each
   transition. `app:add-recent({ filePath })` calls
   `app.addRecentDocument` — the test asserts the call succeeded and
   was logged; macOS does NOT expose the recent-items list to us, so
   the test limitation is documented. (BT-L4-10, BT-L4-11.)

## File layout

| File                    | Purpose                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `src/main.ts`           | Single-instance lock BEFORE whenReady; protocol register; open-url + second-instance routing; service installs; before-quit flush + will-quit cleanup. |
| `src/window.ts`         | Carry-forward secure-default `BrowserWindow` factory (L2 R-L2-3).                                |
| `src/preload.ts`        | Extended contextBridge surface with L4 invoke wrappers + push subscriptions.                     |
| `src/ipc.ts`            | IPC registry extended with L4 channels + gated test seams.                                       |
| `src/ipc-validation.ts` | Validators for every new arg shape.                                                              |
| `src/security.ts`       | Navigation + permission guards (carry-forward).                                                  |
| `src/storage.ts`        | Atomic journal (carry-forward).                                                                  |
| `src/menu.ts`           | Application + context menu (carry-forward).                                                      |
| `src/watch.ts`          | File watcher rooted at `userData/watched-folder` (carry-forward).                                |
| `src/log.ts`            | JSON-lines logger (carry-forward).                                                               |
| `src/tray.ts`           | Module-scope `Tray` + state-machine title table (R-L4-1).                                        |
| `src/notifications.ts`  | `Notification` + `failed` listener pair + 2s timeout fallback (R-L4-3).                          |
| `src/shortcuts.ts`      | `globalShortcut.register` + `app.on('will-quit', …)` → `unregisterAll` (R-L4-2).                 |
| `src/power.ts`          | suspend / resume / lock / unlock / on-ac / on-battery subscriptions + `fireForTest`.             |
| `src/lifecycle.ts`      | Single `dispatchArgs(args, origin)` for open-url and second-instance.                            |
| `src/protocol.ts`       | `parseDeepLink([parsed, null] / [null, error])` strict parser.                                   |
| `src/autolaunch.ts`     | `setLoginItemSettings` wrapper + `cleanupOnRemove` (R-L4-6).                                     |
| `src/theme.ts`          | `nativeTheme.themeSource` wrapper + synchronous push broadcast.                                  |
| `src/dock.ts`           | `dock.setBadge` + `addRecentDocument` with platform guards.                                      |
| `src/renderer/*`        | Strict CSP HTML + the L3 drop-zone wiring (carry-forward).                                       |

## IPC surface (L4-new only)

| Channel                       | Direction       | Arg shape                                            | Response shape                                   |
| ----------------------------- | --------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `tray:set-state`              | invoke          | `{ state: TrayState }`                               | `{ ok:true, view: TrayStateView }`               |
| `app:get-tray-state`          | invoke          | none                                                 | `TrayStateView`                                  |
| `notification:show`           | invoke          | `{ title, body, actions?, hasReply?, replyPlaceholder? }` | `{ ok, id, failed? }`                            |
| `app:set-autolaunch`          | invoke          | `{ enabled }`                                        | `{ requested, observed }`                        |
| `app:get-autolaunch`          | invoke          | none                                                 | `{ openAtLogin, status? }`                       |
| `app:set-theme`               | invoke          | `{ source }`                                         | `ThemeSnapshot`                                  |
| `app:get-theme`               | invoke          | none                                                 | `ThemeSnapshot`                                  |
| `dock:set-badge`              | invoke          | `{ badge }`                                          | `{ ok, badge }`                                  |
| `app:add-recent`              | invoke          | `{ filePath }`                                       | `{ ok }`                                         |
| `shortcut:fired` (push)       | main → renderer | n/a                                                  | `{ accelerator }`                                |
| `lifecycle:open-url` (push)   | main → renderer | n/a                                                  | `{ url, action, params, origin }`                |
| `theme:changed` (push)        | main → renderer | n/a                                                  | `ThemeSnapshot`                                  |
| `notification:failed` (push)  | main → renderer | n/a                                                  | `{ id, error }`                                  |

Gated test seams (only registered when `NODE_ENV === 'test'` OR
`L4_TEST_HOOKS === '1'`):

| Channel                       | Arg                                                | Response                |
| ----------------------------- | -------------------------------------------------- | ----------------------- |
| `test:fire-shortcut`          | `{ accelerator }`                                  | `{ ok, fired }`         |
| `test:emit-power-event`       | `{ event }`                                        | `{ ok }`                |
| `test:trigger-will-quit`      | none                                               | `{ ok }`                |
| `test:emit-open-url`          | `{ url }`                                          | `{ ok }`                |
| `test:emit-second-instance`   | `{ argv }`                                         | `{ ok }`                |

## Test seams (env-var-driven)

| Env var          | Effect                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| `LOG_DIR`        | Override the structured-log directory (carry-forward from L1).                 |
| `USER_DATA_DIR`  | Override `app.getPath('userData')` (carry-forward from L3 Decision 8).         |
| `DIALOG_STUB`    | Short-circuit `dialog.show*Dialog` (carry-forward).                            |
| `NODE_ENV=test`  | Exposes the L4 test seams listed above.                                        |
| `L4_TEST_HOOKS=1`| Alternate trigger for the same gate.                                           |

## Toolchain

Continues L1/L2/L3 — `tsc` for main, `esbuild` for the preload bundle,
static HTML copied to `dist/`. **No electron-forge** (deferred to L5).

## Running

```bash
npm install
npm run build
npm start
npm run test          # vitest unit (98 tests)
npm run test:e2e      # playwright (_electron) — 18 tests
```

## Invariants future POCs inherit

1. **Tray instance is held in a module-scope variable** so GC cannot
   reclaim it (FM-04). R-L4-1 enforces both statically (the file
   declares `let trayInstance` at module level) and at runtime
   (post-launch tray state survives a 2-second idle).
2. **Every globalShortcut.register is paired with a `will-quit` cleanup
   that calls `globalShortcut.unregisterAll()`** (R-L4-2).
3. **Every Notification.show is preceded by a `failed` listener**
   (R-L4-3). On unsigned dev builds the OS rejects the notification and
   the failure path is the only observable.
4. **`parseDeepLink` returns `[null, error]` for any malformed input**
   (R-L4-4); a partial parse is never returned.
5. **`app.requestSingleInstanceLock()` runs BEFORE `app.whenReady()`**
   in main.ts (R-L4-5).
6. **`setLoginItemSettings({ openAtLogin: false })` is declared in
   autolaunch.ts on a cleanup path** so a forcibly-removed app does
   not leave a registered login item behind (R-L4-6).
7. **All L4 channels run a validator before their handler** —
   carry-forward of R-L2-2 / R-L3-1 extended through the
   `ipc-registry-coverage.test.ts` check.
8. **CSP + secure webPreferences from L2 carry forward unchanged.**

## See also

- `test-plan.md` — Given/When/Then for every BT-L4-N and R-L4-N.
- `poc-report.md` — what happened during the build, expectation gaps,
  honest reporting of simulated paths.
- `../../04_logs/decision-log.md` — Decision 10 (test-only IPC seam
  gating).
- `../../04_logs/expectation-gap-ledger.md` — Entry 5
  (`setLoginItemSettings` on unsigned dev apps).
