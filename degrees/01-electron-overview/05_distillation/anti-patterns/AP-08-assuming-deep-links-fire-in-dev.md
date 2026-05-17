# AP-08 — Assuming `open-url` fires in dev without packaging

**Severity**: medium (test failures, dev-only false-positive)
**Surface**: Deep links, custom protocols.

## What this looks like

```typescript
// "Why doesn't the open-url handler fire when I open pulse:// from Safari?"
app.setAsDefaultProtocolClient('pulse')
app.on('open-url', (event, url) => {
  console.log('got URL:', url) // never logged in dev
})
// running via `npx electron .` ← OS doesn't route to non-bundle apps
```

## Why this is wrong

macOS URL-scheme routing requires the app to be a `.app` bundle registered with Launch Services. `npx electron .` invocations are NOT bundle-registered. The OS silently routes the URL nowhere (or launches a second `electron` process that exits, depending on macOS version).

## Better approach

Two paths, separate concerns:

1. **For automated tests**, use programmatic emission (see P-08):
   ```typescript
   // test:emit-open-url IPC seam
   app.emit('open-url',
     { preventDefault: () => undefined } as Electron.Event,
     'pulse://start')
   ```

2. **For real OS routing testing**, package the app:
   ```bash
   npm run make
   open out/<App>.app  # registers with Launch Services
   open pulse://start  # now routes to the bundle
   ```

## Test / lint that catches it

`tests/e2e/lifecycle.spec.ts > BT-L4-7` uses the IPC seam, so the test passes without packaging. A manual smoke test post-packaging exercises real OS routing.

## Evidence

- `01_research/21-failure-modes.md#FM-06`
- `01_research/11-deep-links-protocol.md` lines 13-16
- `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-7 row
- `03_pocs/L-capstone-pulse/src/main.ts:520-523`
