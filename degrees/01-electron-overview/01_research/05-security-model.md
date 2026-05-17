# Security Model — Electron

Version: Electron 42.1.0 [S3, S4, S5]

## The Security Defaults (Electron 20+)

```typescript
// These are secure defaults — DO NOT CHANGE without documented justification
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // default since Electron 12
    sandbox: true,            // default since Electron 20
    nodeIntegration: false,   // default since Electron 5
    webSecurity: true,        // default always
    // preload: path.join(__dirname, 'preload.js') — MUST specify explicitly
  },
})
```

Changing any of these is a security regression. Document the reason if you must. [S3]

## The 20-Point Security Checklist [S3]

1. **Only load secure content** — Use HTTPS/WSS/FTPS, not HTTP/WS
2. **No nodeIntegration for remote content** — never set `nodeIntegration: true` for windows loading remote URLs
3. **Enable contextIsolation** in all renderers (default, keep it)
4. **Enable process sandboxing** (default since 20, keep it)
5. **Use `session.setPermissionRequestHandler`** for any session loading remote content
6. **Do not disable webSecurity** — kills same-origin policy
7. **Define a Content-Security-Policy** — restrictive rules, no `unsafe-inline`, no `unsafe-eval`
8. **Do not enable allowRunningInsecureContent**
9. **Do not enable experimental features**
10. **Do not use enableBlinkFeatures**
11. **No `allowpopups` on `<webview>`** unless required
12. **Verify `<webview>` options** before attachment
13. **Disable or limit navigation** — use `will-navigate` guards
14. **Disable or limit new window creation** — use `setWindowOpenHandler`
15. **No `shell.openExternal` with untrusted content** — can execute arbitrary commands
16. **Use a current Electron version** (within supported window)
17. **Validate IPC message sender** for sensitive channels
18. **Avoid file:// protocol** — use custom `protocol.handle` scheme
19. **Check `@electron/fuses`** — disable runAsNode, nodeCliInspect
20. **Do not expose Electron APIs to untrusted web content**

## Content Security Policy (CSP)

### Via HTTP response header (preferred for HTTPS-loaded apps)

```typescript
import { session } from 'electron'

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ],
    },
  })
})
```

### Via meta tag (for file:// / local apps)

```html
<!-- src/renderer/index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'">
```

IMPORTANT: `unsafe-inline` allows XSS attacks. Avoid it. Use a bundled CSS file instead of inline styles.

## Navigation Guards

### Prevent external navigation (will-navigate)

```typescript
import { app } from 'electron'
import { URL } from 'node:url'

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl)
    // Only allow navigation within local app content
    if (parsed.origin !== 'null' && !navigationUrl.startsWith('file://')) {
      event.preventDefault()
      console.warn('[security] blocked navigation to:', navigationUrl)
    }
  })
})
```

GOTCHA: Use `URL` parser, NOT `string.startsWith()`. The string `https://myapp.com.evil.com` would pass a `startsWith('https://myapp.com')` check. [S3]

### Block new window creation (setWindowOpenHandler)

```typescript
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // If you need to open URLs in browser, use shell.openExternal safely
    if (isTrustedUrl(url)) {
      setImmediate(() => shell.openExternal(url))
    }
    return { action: 'deny' }
  })
})
```

## Permission Handler

By default Electron auto-approves all permissions. Override:

```typescript
import { session } from 'electron'

session.defaultSession.setPermissionRequestHandler(
  (webContents, permission, callback) => {
    // Only grant notifications to local content
    if (permission === 'notifications') {
      callback(true)
      return
    }
    // Deny everything else from remote content
    callback(false)
  }
)
```

[S3]

## contextBridge Security Rules [S4]

### DO

```typescript
// Expose narrow, purpose-built functions
contextBridge.exposeInMainWorld('api', {
  loadPreferences: () => ipcRenderer.invoke('prefs:load'),
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
})
```

### DO NOT

```typescript
// WRONG: exposes ipcRenderer.send wholesale — renderer can send to any channel
contextBridge.exposeInMainWorld('api', {
  send: ipcRenderer.send,
})

// WRONG: direct module exposure — violates least privilege
contextBridge.exposeInMainWorld('electron', require('electron'))
```

## Fuses (@electron/fuses)

Post-package security hardening. Disable runtime flags that could be exploited:

```typescript
// In forge config or a post-package script:
import { FuseV1Options, FuseVersion } from '@electron/fuses'

const fuses = [
  { fuseId: FuseV1Options.RunAsNode, enabled: false },       // prevents node repl abuse
  { fuseId: FuseV1Options.EnableCookieEncryption, enabled: true },
  { fuseId: FuseV1Options.EnableNodeOptionsEnvironmentVariable, enabled: false },
  { fuseId: FuseV1Options.EnableNodeCliInspectArguments, enabled: false },
]
```

Run AFTER packaging, before notarization. Modifies the binary in-place. [S3]

## Remote Module Status

`@electron/remote` is a separate third-party package. The built-in `remote` module was removed from Electron core. Do NOT use `@electron/remote` in new apps — it undermines contextIsolation security by exposing main-process objects to renderers. Use `contextBridge` + `ipcMain.handle` instead. [S3]

## webSecurity Implications

`webSecurity: false` disables same-origin policy and CORS. Symptoms that might tempt you to disable it: "failed to load resource from different origin." Fix: configure CORS on the remote server or use `session.webRequest` to modify headers. Never disable webSecurity.

## IPC Sender Validation (Complete Pattern)

```typescript
import { ipcMain, BrowserWindow } from 'electron'

function validateSender(event: Electron.IpcMainInvokeEvent): boolean {
  const frameUrl = event.senderFrame?.url ?? ''
  // Only accept messages from local app content
  return frameUrl.startsWith('file://') || frameUrl.startsWith('app://')
}

ipcMain.handle('sensitive:action', (event, arg: unknown) => {
  if (!validateSender(event)) {
    throw new Error('Unauthorized IPC sender')
  }
  // validate arg types
  if (typeof arg !== 'string' || arg.length > 1000) {
    throw new Error('Invalid argument')
  }
  return performSensitiveAction(arg)
})
```

## sandbox: true Implications for Preload [S5]

With `sandbox: true` (default since Electron 20):
- Preload cannot import arbitrary npm packages via `require()`
- Must use a bundler (webpack, esbuild) to bundle preload as a single file
- Only whitelisted modules available in preload (see `02-three-process-model.md`)
- This is why Electron Forge's webpack/vite plugin configures preload bundling separately

If you see errors like `Cannot find module 'lodash'` in preload, the cause is sandbox restrictions.

## Security Regression Indicators

These patterns are red flags in a code review:
- `nodeIntegration: true` — grants full Node access to renderer
- `contextIsolation: false` — exposes Electron internals to web page
- `sandbox: false` — removes OS-level process isolation
- `webSecurity: false` — kills same-origin policy
- `allowRunningInsecureContent: true` — allows HTTP in HTTPS context
- Exposing `ipcRenderer` object directly via contextBridge
- Not validating IPC message arguments
- Using `shell.openExternal(userInputUrl)` without sanitization
- `eval()` of any IPC-received data
