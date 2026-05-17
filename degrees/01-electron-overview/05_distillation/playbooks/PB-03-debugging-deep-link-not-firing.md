# PB-03 — Debugging a deep link that doesn't fire

**Symptom**: Opening `pulse://action` from another app does nothing. No log, no handler invocation, no second-instance event.

## Decision tree

1. **Are you running unpackaged?** If yes, that's the cause. macOS URL routing requires a `.app` bundle registered with Launch Services. `npx electron .` is NOT routed.
   - Fix for tests: programmatic emission (see P-08, G-15): `app.emit('open-url', evt, url)`.
   - Fix for real testing: `npm run make` + `open out/<App>.app`.

2. **Is the scheme registered?**
   ```bash
   /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Support/lsregister -dump \
     | grep -A 2 "pulse"
   ```
   If missing, `app.setAsDefaultProtocolClient` didn't run or didn't take effect.

3. **Is the `open-url` listener attached BEFORE `app.whenReady()`?** If attached after, a cold-launch URL (opening the URL when the app is not running) is lost.
   ```typescript
   // CORRECT — module-load scope
   app.on('open-url', (event, url) => { /* ... */ })
   app.whenReady().then(() => { /* ... */ })
   ```

4. **Did you call `requestSingleInstanceLock()`?** Without it, every URL spawns a new process; the original instance doesn't receive a `second-instance` event. The new process's `open-url` may also fire — but the URL is delivered to the FRESH instance, not the existing one.

5. **Is the `Info.plist`'s `CFBundleURLTypes` correctly populated in the packaged bundle?**
   ```bash
   plutil -p out/<App>.app/Contents/Info.plist | grep -A 8 CFBundleURLTypes
   ```
   Check the merge gotcha (G-09): `packagerConfig.protocols` overrides `extendInfo.CFBundleURLTypes`.

6. **Is the parser rejecting the URL?** Check the `deeplink:parse-failed` log marker. The strict parser (P-11) rejects non-ASCII action names, empty actions, malformed URLs.

## Diagnostic commands

```bash
# Quick test from terminal:
open "pulse://start?duration=5"

# Check Launch Services:
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Support/lsregister -dump | grep "pulse"

# Find which app is registered for the scheme:
defaults read com.apple.LaunchServices/com.apple.launchservices.secure | grep -B 5 "pulse"
```

## Evidence

- `01_research/21-failure-modes.md#FM-06`
- `01_research/11-deep-links-protocol.md`
- `03_pocs/L-capstone-pulse/src/protocol.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:124-143`
- `04_logs/expectation-gap-ledger.md#entry-8` (CFBundleURLTypes merge issue)
