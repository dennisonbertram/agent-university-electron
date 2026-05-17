# G-10 — `electron-updater` short-circuits in unpackaged dev mode

**Severity**: medium
**Surface**: Auto-update, dev-mode testing
**Discovered in**: L5 BT-L5-6 GREEN (`04_logs/expectation-gap-ledger.md#entry-9`)

## Symptom

You call `autoUpdater.setFeedURL({ provider: 'generic', url: ... })` then `autoUpdater.checkForUpdates()`. The HTTP request is never made. The local update-server access log is empty. `update-not-available` fires with the current version. Playwright BT for `update-available` flow never gets a chance.

## Root cause

`electron-updater` detects an unpackaged process (`!app.isPackaged`) and short-circuits the entire check. This is intentional safety — production users should never be served updates from a dev build — but it makes Playwright testing of the updater impossible without packaging.

## Fix

Set the undocumented-in-typedef `forceDevUpdateConfig` property on the autoUpdater singleton BEFORE `setFeedURL` / `checkForUpdates`:

```typescript
import { autoUpdater } from 'electron-updater'

;(autoUpdater as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true
autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
await autoUpdater.checkForUpdates()
```

The cast is required because the property is documented but the TypeScript typedef in electron-updater 6.8.3 doesn't expose it.

## Test that catches a regression

`tests/e2e/updater.spec.ts > BT-L5-6` (L5) — without `forceDevUpdateConfig = true`, the test times out waiting for `update-available`.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-9`
- `03_pocs/L5-packaging-signing-update/poc-report.md` §"Expectation gaps surfaced" Entry 9
- `03_pocs/L5-packaging-signing-update/src/updater.ts`
