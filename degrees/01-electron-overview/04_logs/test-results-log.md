
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

