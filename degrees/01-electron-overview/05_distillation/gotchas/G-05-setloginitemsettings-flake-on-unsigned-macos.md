# G-05 — `setLoginItemSettings({ openAtLogin: true })` does not round-trip on unsigned dev (macOS 13+)

**Severity**: medium
**Surface**: Auto-launch, `app.setLoginItemSettings`
**Discovered in**: L4 GREEN of BT-L4-8 (`04_logs/expectation-gap-ledger.md#entry-5`)

## Symptom

After `app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })`, the immediately-subsequent `app.getLoginItemSettings().openAtLogin` returns `false` approximately half the time, `true` the rest. Three consecutive Playwright runs produce different observed values. The disable side (`openAtLogin: false`) is reliable.

## Root cause

macOS 13+ routes `setLoginItemSettings` through `SMAppService` (Service Management) which requires a signed app bundle. On an unsigned dev binary, the call silently succeeds at the API level but does not persist to the new SM database; the read-back is non-deterministic. The legacy `LSSharedFileList` fallback only kicks in for older macOS or specific shapes of `openAsHidden` argument.

## Fix

For tests against unsigned dev binaries:

```typescript
// BT-L4-8 form
await window.api.autolaunch.set(true)
// assert ONLY:
//   - requested === true
//   - log entry `autolaunch:set` fired with the value
// do NOT assert observed === true on unsigned dev
```

For production:
- Sign the app with a Developer ID Application cert before testing the round-trip.
- Nudge the user to System Settings → Login Items if `getLoginItemSettings().status === 'requires-approval'`.

## Test that catches a regression

For unsigned dev, assert the `requested` side + log marker; for signed packaged builds, run a manual smoke test that reads back the OS setting after a setLoginItemSettings call.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-5`
- `01_research/21-failure-modes.md#FM-09`
- `01_research/23-open-questions.md#OQ-03`
- `03_pocs/L4-deep-macos-integration/poc-report.md` §"Expectation gaps surfaced"
