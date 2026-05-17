# Troubleshooting — Deep Link Not Firing

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

Opening `myapp://action/foo` does nothing. The app does not launch, does not receive the URL, or the `open-url` / `second-instance` handler is never called.

---

## Cause → Diagnostic → Fix

### Cause 1: `open-url` listener registered AFTER `whenReady` (macOS)

On macOS, if the app is already running and a deep link fires, the `open-url` event is emitted on the `app` object immediately. If your listener is registered inside `app.whenReady().then(...)`, it misses events that fire during boot.

**Diagnostic**

```bash
grep -n 'open-url' src/main.ts
grep -n 'whenReady' src/main.ts
# The open-url line number must be LESS than the whenReady line number
```

**Fix**

```typescript
// CORRECT: before whenReady
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

app.whenReady().then(() => {
  createMainWindow()
})
```

---

### Cause 2: App not packaged (macOS only)

On macOS, `setAsDefaultProtocolClient` requires the app to be registered with Launch Services, which only happens when installed from a `.app` bundle. In development (`npm start`), the Electron binary is the "app", not your app.

**Diagnostic**

```bash
# This will return the Electron binary, not your app:
/usr/bin/lsregister -dump | grep 'myapp://'
```

**Fix** (Option A — for production)

Package the app, install from `out/`, then test:
```bash
npm run package
open out/MyApp-darwin-arm64/MyApp.app
# Now open myapp://action/test
```

**Fix** (Option B — for development testing)

Use a test seam to bypass OS routing:
```typescript
// Playwright test
await page.evaluate(() => (window as any).api.testEmitOpenUrl('myapp://action/test'))
```

The test seam calls `app.emit('open-url', ...)` directly, bypassing the OS. See [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md).

---

### Cause 3: Protocol registered with `packagerConfig.protocols` AND `extendInfo.CFBundleURLTypes` simultaneously (G-09)

Using both causes one to override the other in the built `Info.plist`. The result is unpredictable.

**Diagnostic**

```bash
grep -n 'protocols\|CFBundleURLTypes' forge.config.ts
```

If both appear, you have the conflict.

**Fix**

Use exactly one. The recommended approach is `packagerConfig.protocols`:

```typescript
packagerConfig: {
  protocols: [{ name: 'MyApp', schemes: ['myapp'] }]
}
```

Remove any `CFBundleURLTypes` from `extendInfo`. Verify the built plist:
```bash
plutil -p <App>.app/Contents/Info.plist | grep -A5 CFBundleURLTypes
```

---

### Cause 4: `setAsDefaultProtocolClient` called after `whenReady`

Registration must happen before `app.whenReady()` to cover cold-start deep links.

**Diagnostic**

```bash
grep -n 'setAsDefaultProtocolClient' src/main.ts
grep -n 'whenReady' src/main.ts
# setAsDefaultProtocolClient line must be < whenReady line
```

**Fix**

```typescript
// Line 1: crash reporter
// Line 2: single instance lock
app.setAsDefaultProtocolClient('myapp')   // BEFORE whenReady
// ...
app.whenReady().then(...)
```

---

### Cause 5: Windows/Linux — `second-instance` not handled

On Windows and Linux, deep links come via `second-instance`, not `open-url`. The URL is in `argv`.

**Diagnostic**

```bash
grep -n 'second-instance' src/main.ts
```

**Fix**

```typescript
app.on('second-instance', (_e, argv) => {
  const url = argv.find(a => a.startsWith('myapp://'))
  if (url) handleDeepLink(url)
  // also focus the existing window
  mainWindow?.show()
  mainWindow?.focus()
})
```

---

### Cause 6: Parser is too strict and rejects valid URLs silently

If `parseDeepLink()` throws on a valid URL and the caller doesn't log the error, it appears as "nothing happening."

**Diagnostic**

Add logging to `parseDeepLink`:
```typescript
try {
  const parsed = parseDeepLink(url)
  handleRoute(parsed)
} catch (e) {
  logger.error({ event: 'deep-link:parse-failed', url, err: String(e) })
}
```

Check the log file for `deep-link:parse-failed` entries.

---

## Quick Diagnostic Sequence

```bash
# 1. Check listener position
grep -n 'open-url\|whenReady\|setAsDefaultProtocol' src/main.ts

# 2. Verify plist has URL type
plutil -p <App>.app/Contents/Info.plist | grep -A8 CFBundleURLTypes

# 3. Check launch services registration (macOS)
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -dump | grep myapp

# 4. Re-register if needed
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f <App>.app
```

---

## Related

- [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md) — deep link architecture
- [../lessons/07-app-lifecycle-and-single-instance.md](../lessons/07-app-lifecycle-and-single-instance.md) — boot order, second-instance
- [../recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md) — full parseDeepLink + registration pattern
- [../labs/lab-07-deep-link-router.md](../labs/lab-07-deep-link-router.md) — hands-on exercise

Evidence: `../../../05_distillation/playbooks/PB-04-deep-link-not-firing.md`, `../../../05_distillation/patterns/P-11-deep-link-router-via-protocol-and-second-instance.md`
