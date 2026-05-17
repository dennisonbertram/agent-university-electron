# Failure Modes — Electron

Version: Electron 42.1.0

15 documented failure modes with symptom → cause → diagnostic → fix.

---

## FM-01: White Screen on App Launch

**Symptom**: App window opens but shows a blank white page. No content loads.

**Likely Causes**:
1. `loadFile()` path wrong — file doesn't exist at the given path
2. CSP blocks inline scripts — renderer's `<script>` tag blocked
3. Preload error — uncaught exception in preload prevents renderer from loading
4. Renderer bundle not built — referenced JS file doesn't exist

**Diagnostic**:
```typescript
win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  console.error(`Load failed: ${errorDescription} (${errorCode})`)
})
win.webContents.openDevTools({ mode: 'detach' })
```
Open DevTools console → look for CSP violations, 404 errors, SyntaxErrors.

**Fix**:
- Verify `loadFile()` uses `path.join(__dirname, 'renderer/index.html')`
- Check CSP meta tag; remove `unsafe-inline` from working state, add incrementally
- Add try/catch in preload; log errors before contextBridge.exposeInMainWorld
- Run build step; ensure bundler output exists

---

## FM-02: Native Module ABI Mismatch

**Symptom**: `Error: The module was compiled against a different Node.js version using NODE_MODULE_VERSION X. This version requires Y.`

**Cause**: Native module (e.g., better-sqlite3) compiled for system Node ABI, but Electron uses a different ABI.

**Diagnostic**:
```bash
node -e "console.log(process.versions.modules)" # system Node ABI
# vs. in Electron main: process.versions.modules
```

**Fix**:
```bash
./node_modules/.bin/electron-rebuild
# Or with Forge (handles automatically):
npm run start
```

[S22]

---

## FM-03: Sandbox + Preload CommonJS Split

**Symptom**: Preload throws `Cannot find module 'lodash'` or any npm package. Works without `sandbox: true`.

**Cause**: With `sandbox: true`, `require()` in preload is a polyfill with only whitelisted modules. Cannot load arbitrary npm packages.

**Diagnostic**: Check `sandbox` in webPreferences. Check what the preload is trying to require.

**Fix**:
- Use a bundler (Vite, webpack) to bundle the preload as a SINGLE file
- All dependencies get bundled INTO the preload output
- Configure Forge's VitePlugin with a `preload` entry
- Do NOT import npm packages that use Node built-ins unavailable in sandbox

[S5]

---

## FM-04: Tray Icon Disappears After a Few Seconds

**Symptom**: Tray icon shows briefly then vanishes. No error thrown.

**Cause**: `Tray` object was assigned to a local variable inside a function. When the function returns, the garbage collector destroys the Tray.

**Diagnostic**:
```typescript
// WRONG:
function createTray() {
  const tray = new Tray(icon) // ← local var, will be GC'd
  tray.setToolTip('App')
}
```

**Fix**:
```typescript
// CORRECT:
let tray: Tray | null = null // module-level reference

function createTray() {
  tray = new Tray(icon)
  tray.setToolTip('App')
}
```

[S6]

---

## FM-05: Notifications Silently Fail on macOS

**Symptom**: `notification.show()` is called, `show` event fires, but notification never appears in Notification Center. `failed` event fires with an error string.

**Cause**: App is not code-signed. macOS requires code signing for notifications.

**Diagnostic**:
```typescript
notification.on('failed', (_event, error) => {
  console.error('[notification] failed:', error)
  // "This app is not authorized to send notifications."
})
```

**Fix**:
- Sign app with Developer ID Application cert
- For development: use ad-hoc signing (`codesign --sign - app.app`) — may partially work
- Accept that notifications only fully work in signed packaged builds

[S7]

---

## FM-06: Deep Link Not Firing (macOS)

**Symptom**: Opening `myapp://action` from browser or `open` command does nothing. App launches but `open-url` event never fires.

**Cause**: App is not packaged. macOS URL scheme routing requires the app to be a proper `.app` bundle in `/Applications` (or similar). Works only in packaged builds.

**Diagnostic**:
```bash
# Check if scheme is registered:
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Support/lsregister -dump | grep "myapp"
```

**Fix**:
- Run `npm run make` and install/run the packaged app
- For development testing: use the signed packaged app
- On macOS, `open-url` only fires for packaged apps

[S26]

---

## FM-07: IPC Channel Typo (Silent Failure)

**Symptom**: `ipcRenderer.invoke('jounral:append')` resolves with undefined or never resolves. No error thrown.

**Cause**: Channel name typo in send/listen sides. Electron doesn't validate channel names.

**Diagnostic**:
```typescript
// Main process: register unhandled invoke logger
ipcMain.on('unhandled-invoke', (event, channel) => {
  console.warn('[ipc] unhandled invoke:', channel)
})
// Actually: add logging middleware or TypeScript's literal type checking
```

**Fix**:
- Define channel names as TypeScript string literal union
- Use a central `IPC_CHANNELS` constant object
- TypeScript will catch misspellings at compile time

---

## FM-08: Second BrowserWindow reference kept after close

**Symptom**: `TypeError: Object has been destroyed` when calling methods on a window that was closed.

**Cause**: BrowserWindow reference not nulled when the window is closed.

**Diagnostic**: Look for module-level `BrowserWindow | null` variables not reset in the `closed` event.

**Fix**:
```typescript
settingsWindow.on('closed', () => {
  settingsWindow = null // de-reference so GC can collect it
})
```

[S23]

---

## FM-09: Auto-Launch Not Working (macOS)

**Symptom**: `setLoginItemSettings({ openAtLogin: true })` returns success but app doesn't launch at login.

**Cause**: On macOS 13+, login items require approval from System Settings. App may show as `requires-approval` in `getLoginItemSettings().status`.

**Diagnostic**:
```typescript
const settings = app.getLoginItemSettings()
console.log('[autolaunch] status:', settings.status, 'openAtLogin:', settings.openAtLogin)
// status: 'requires-approval' → user must approve in System Settings
```

**Fix**:
- User must go to System Settings → General → Login Items and approve
- Log a notification or show UI prompting user to approve
- For non-sandboxed apps, the old API works; for sandboxed, use SMAppService

[S10]

---

## FM-10: globalShortcut Conflict (Silent Failure)

**Symptom**: `globalShortcut.register('CmdOrCtrl+Shift+P', handler)` returns `false`. Handler never fires.

**Cause**: Another application (or the system) holds the `CmdOrCtrl+Shift+P` shortcut. Electron cannot steal it.

**Diagnostic**:
```typescript
const registered = globalShortcut.register('CmdOrCtrl+Shift+P', handler)
if (!registered) {
  console.warn('[shortcuts] CmdOrCtrl+Shift+P taken by another app')
}
```

**Fix**:
- Choose a different accelerator
- Provide UI for user to rebind shortcuts
- Use `globalShortcut.isRegistered()` before registering (though it returns false for both "not registered" and "owned by another app")

[S8]

---

## FM-11: Updater Silent Failure (macOS)

**Symptom**: `autoUpdater.checkForUpdatesAndNotify()` called, no events fire, no error. No update check happens.

**Causes**:
1. App not code-signed (macOS requires signing for auto-update)
2. `app-update.yml` not present in packaged app resources
3. Feed URL unreachable or manifest malformed
4. `autoDownload` false but not handling `update-available` manually

**Diagnostic**:
```typescript
autoUpdater.logger = log
(log as any).transports.file.level = 'debug'
autoUpdater.on('error', err => log.error('[updater] error:', err))
```
Check `~/Library/Logs/<AppName>/app.log` for updater errors.

**Fix**:
- Sign the app
- Run `npm run make` (not just `npm run package`) — make writes `app-update.yml` to resources
- Test with `forceDevUpdateConfig = true` and local fixture server

[S18]

---

## FM-12: crashReporter Doesn't Capture Reports

**Symptom**: `crashReporter.start()` is called, process crashes, but `getLastCrashReport()` returns null and no file appears in `crashDumps`.

**Causes**:
1. `crashReporter.start()` called AFTER `app.ready` — renderers spawned before start are not monitored
2. `uploadToServer: true` but `submitURL` not set (error since v13)
3. Custom `crashDumps` path set AFTER starting crash reporter

**Diagnostic**:
- Move `crashReporter.start()` to the very top of `main.ts`, before any `app.on()`
- Check `getLastCrashReport()` return: it only returns uploaded reports, not local-only

**Fix**:
- Call `crashReporter.start()` as early as possible (first lines of main.ts)
- Set `app.setPath('crashDumps', customPath)` BEFORE `crashReporter.start()`
- Set `uploadToServer: false` if no submitURL

[S19]

---

## FM-13: WebContentsView / BrowserView Deprecation Confusion

**Symptom**: `win.setBrowserView()` works but shows a deprecation warning. Documentation shows `WebContentsView` but it requires `BaseWindow`.

**Cause**: BrowserView was deprecated in Electron 30. New API uses `WebContentsView` inside a `BaseWindow`. [S29]

**Fix**:
```typescript
// DEPRECATED:
const view = new BrowserView()
win.setBrowserView(view)

// CURRENT:
import { BaseWindow, WebContentsView } from 'electron'
const baseWin = new BaseWindow()
const view = new WebContentsView({ webPreferences: { ... } })
baseWin.contentView.addChildView(view)
```

---

## FM-14: Preload-to-Renderer Type Mismatch (contextBridge serialization)

**Symptom**: Custom class instance passed through contextBridge loses its prototype. Methods on the object are undefined in renderer.

**Cause**: contextBridge uses structured clone algorithm. Custom prototypes are stripped.

**Diagnostic**:
```typescript
// Main: expose class instance
class Config { getValue() { return 42 } }
contextBridge.exposeInMainWorld('api', { config: new Config() })

// Renderer: TypeError: window.api.config.getValue is not a function
```

**Fix**:
- Only expose plain objects, primitives, and functions at the top level
- Expose methods as individual functions, not as class instances

```typescript
const config = new Config()
contextBridge.exposeInMainWorld('api', {
  getConfigValue: () => config.getValue(), // extract method
})
```

[S4]

---

## FM-15: File.path Removed (Electron 32+)

**Symptom**: `TypeError: Cannot read properties of undefined (reading 'path')` when accessing `file.path` in renderer.

**Cause**: `File.path` (nonstandard property) was removed in Electron 32. [S29]

**Fix**:
```typescript
// REMOVED:
const path = file.path

// CORRECT: use webUtils in preload
contextBridge.exposeInMainWorld('api', {
  getFilePath: (file: File) => webUtils.getPathForFile(file),
})

// Renderer:
const filePath = window.api.getFilePath(file)
```
