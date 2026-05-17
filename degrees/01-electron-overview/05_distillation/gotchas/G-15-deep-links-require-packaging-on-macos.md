# G-15 — `open-url` event does not fire for unpackaged macOS apps

**Severity**: high
**Surface**: Deep links, custom protocols
**Discovered in**: L4 BT-L4-7 design (`01_research/21-failure-modes.md#FM-06`)

## Symptom

You register `app.setAsDefaultProtocolClient('pulse')` and an `app.on('open-url', ...)` handler. You run the app via `npx electron .`. You open `pulse://start` from another terminal or click a link. The `open-url` event never fires. The shell may or may not launch a second Electron instance, but the URL never reaches your handler.

## Root cause

macOS URL-scheme routing requires the app to be a proper `.app` bundle registered with Launch Services. An `npx electron .` invocation is not bundle-registered, so the OS does not route the URL to it. This is a Launch Services constraint, not an Electron limitation.

## Fix

Two paths:

1. **For tests**, simulate the event programmatically:
   ```typescript
   // src/main.ts — exposed via gated IPC seam
   app.emit('open-url',
     { preventDefault: () => undefined } as Electron.Event,
     'pulse://start')
   ```
2. **For real OS routing**, run `npm run make` and install the packaged `.app` bundle. macOS will then route `pulse://...` to your handler.

## Test that catches a regression

`tests/e2e/lifecycle.spec.ts > BT-L4-7` (L4) — uses `test:emit-open-url` IPC seam to drive `app.emit('open-url', ...)`. Without the seam, the test would have to package the app for every run.

## Evidence

- `01_research/21-failure-modes.md#FM-06`
- `01_research/11-deep-links-protocol.md` lines 13-16
- `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-7 row
- `03_pocs/L-capstone-pulse/src/main.ts:520-523` (`test:emit-open-url` seam)
