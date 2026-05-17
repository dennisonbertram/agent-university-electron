
## 2026-05-17 — Capstone Pulse — Commit 1 (RED)

### Vitest (unit)

```
Test Files  4 failed | 11 passed (15)
     Tests  28 failed | 59 passed (87)
```

Failures are real — every assertion against the four stub modules
(focus-engine, journal-store, biometric, passphrase) throws
`Error: <module>: <export> not implemented (RED)`.

Passing tests are real assertions on already-built carry-forward modules
(protocol, ipc, ipc-validation, security-defaults, csp, forge-config,
entitlements, info-plist-template, single-instance-lock-order,
crash-start-ordering, tray-gc-safe).

### Playwright (e2e, sample run for BT-C-1)

```
✘  tests/e2e/focus.spec.ts:13:7 › BT-C-1 …
   Error: Timed out after 5000ms waiting for log event "focus:start:25min".
   Last 25 events include: …, journal-store:install-failed,
   passphrase:install-failed, biometric:install-failed,
   focus-engine:install-failed, …
```

Full RED logs:
- `03_pocs/L-capstone-pulse/test-output/RED.unit.log`
- `03_pocs/L-capstone-pulse/test-output/RED.e2e-focus-bt-c-1.log`


## 2026-05-17 — Capstone Pulse — Commit 2 (GREEN)

### Vitest (unit) — after `pretest` rebuilds better-sqlite3 for system Node

```
Test Files  15 passed (15)
     Tests  87 passed (87)
   Duration  ~250ms
```

### Playwright (e2e) — after `pretest:e2e` rebuilds better-sqlite3 for Electron

```
✓ BT-C-1  Cmd+Shift+P starts a 25-min focus session, tray + log + SQLite row
✓ BT-C-2  sleep + resume pauses + resumes with correct elapsed
✓ BT-C-3  notification action handler extends the session by +5min
✓ BT-C-4  timer expiry transitions focus → break + emits completion
✓ BT-C-5  pulse://log?text=hello world ⇒ SQLite row, encrypted, notif queued
✓ BT-C-6  Touch ID unavailable ⇒ journal:list returns requiresFallback
✓ BT-C-7  passphrase unlock — correct returns entries, wrong returns invalid
✓ BT-C-8  TOUCH_ID_FORCE_AVAILABLE + stubbed prompt ⇒ unlocked via touch-id
✓ BT-C-9  relaunch restores journal rows; focus state resets to idle
✓ BT-C-10 dock.hide() + LSUIElement=true
✓ BT-C-11 packaged Info.plist registers pulse:// + LSUIElement=true
✓ BT-C-11b better-sqlite3 native module unpacked outside the asar
✓ BT-C-11c entitlements declares hardened-runtime keys
✓ BT-C-12 packaged app boots; canonical log sequence + app:dock-hidden
14 passed (10.2s)
```

### `npm run package` (verbatim tail)

```
✔ Preparing native dependencies: 1 / 1
✔ Finalizing package
✔ Packaging for arm64 on darwin
✔ Packaging application
❯ Running postPackage hook
✔ Running postPackage hook
packaging:signing:skipped:no-credentials — see simulated-signing.md for the real-signing flow.
```

