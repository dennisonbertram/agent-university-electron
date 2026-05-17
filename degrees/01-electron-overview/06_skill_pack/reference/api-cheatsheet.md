# Electron API Cheatsheet

Quick-reference for commonly used Electron APIs, grouped by process.

Back to [../index.md](../index.md) | [glossary.md](./glossary.md)

---

## Main Process — App Lifecycle

| API | When to Use | Notes |
|---|---|---|
| `app.whenReady()` | Entry point for window/tray creation | Returns Promise; awaitable |
| `app.quit()` | Programmatic quit | Fires `before-quit` + `will-quit` |
| `app.exit(code)` | Force-exit without cleanup | Bypasses event handlers; avoid |
| `app.requestSingleInstanceLock()` | Enforce single instance | Must be before `whenReady` |
| `app.isPackaged` | Detect packaged vs dev | Boolean; use for path branching |
| `app.getPath(name)` | Get OS-specific paths | `userData`, `logs`, `temp`, `downloads` |
| `app.setAsDefaultProtocolClient(scheme)` | Register deep link scheme | Must be before `whenReady` on macOS |
| `app.setLoginItemSettings(settings)` | Auto-launch at login | `openAtLogin: true/false` |
| `app.getLoginItemSettings()` | Read current login item state | Round-trip unreliable in dev |
| `app.dock.hide()` | Hide from macOS Dock | Must be before first BrowserWindow |
| `app.dock.setBadge(text)` | Dock badge count | macOS only; platform guard required |

---

## Main Process — BrowserWindow

| API | Notes |
|---|---|
| `new BrowserWindow(options)` | Always use factory; never construct directly |
| `win.loadFile(path)` | Load local HTML file; use `path.join(__dirname, ...)` |
| `win.loadURL(url)` | Load remote URL; avoid in production |
| `win.webContents.openDevTools()` | Open DevTools programmatically |
| `win.webContents.send(channel, data)` | Push event from main → renderer |
| `win.webContents.on('did-fail-load', ...)` | Catch load failures |
| `win.show()` / `win.hide()` | Show/hide window |
| `win.focus()` | Bring to front |
| `win.setPosition(x, y)` | Position window (use for tray popovers) |
| `win.setVisibleOnAllWorkspaces(true)` | Keep visible when switching Spaces |
| `win.on('close', e => e.preventDefault())` | Intercept close (hide instead) |

**Required webPreferences** for every window:
```
contextIsolation: true
sandbox: true
nodeIntegration: false
webSecurity: true
preload: path.join(__dirname, 'preload.js')
```

---

## Main Process — IPC

| API | Notes |
|---|---|
| `ipcMain.handle(channel, handler)` | Register async request/response handler |
| `ipcMain.on(channel, handler)` | Register fire-and-forget handler |
| `ipcMain.removeHandler(channel)` | Unregister handler (for cleanup) |

**Do NOT use** `ipcMain.handleOnce` or `ipcRenderer.sendSync`.

---

## Main Process — Tray

| API | Notes |
|---|---|
| `new Tray(iconPath)` | Store in module-scope variable — never function-local |
| `tray.setContextMenu(menu)` | Set right-click menu |
| `tray.setToolTip(text)` | Hover tooltip |
| `tray.setTitle(text)` | Text next to icon (macOS) |
| `tray.setImage(path)` | Update icon dynamically |
| `tray.on('click', handler)` | Left-click handler |
| `tray.destroy()` | Clean up on quit |

Template images: filename must end in `Template` (e.g., `icon-Template.png`) for macOS dark/light mode adaptation.

---

## Main Process — Notification

| API | Notes |
|---|---|
| `new Notification(options)` | Create (does not show yet) |
| `notification.show()` | Trigger display |
| `notification.on('show', ...)` | Fires on success |
| `notification.on('failed', ...)` | **Attach BEFORE `.show()`** |
| `notification.on('click', ...)` | User clicks notification |
| `notification.on('action', ...)` | User clicks action button |
| `Notification.isSupported()` | Check before creating |

---

## Main Process — Global Shortcut

| API | Notes |
|---|---|
| `globalShortcut.register(accel, cb)` | Returns `false` on conflict (no throw) |
| `globalShortcut.unregisterAll()` | Call in `will-quit` event handler |
| `globalShortcut.unregister(accel)` | Unregister single shortcut |
| `globalShortcut.isRegistered(accel)` | Check before registering |

---

## Main Process — Dialogs

| API | Notes |
|---|---|
| `dialog.showOpenDialog(win, options)` | File picker; returns `{ filePaths, canceled }` |
| `dialog.showSaveDialog(win, options)` | Save dialog |
| `dialog.showMessageBox(win, options)` | Alert/confirm dialog |

---

## Main Process — Shell

| API | Notes |
|---|---|
| `shell.openExternal(url)` | Open in default browser (safe way to open URLs) |
| `shell.showItemInFinder(path)` | Reveal in Finder (macOS) |
| `shell.openPath(path)` | Open file with default app |

**Never** pass user-controlled strings to `shell.openExternal` without validation — this can execute arbitrary protocols.

---

## Main Process — System

| API | Notes |
|---|---|
| `powerMonitor.on('suspend', cb)` | System sleep — must be inside `whenReady` |
| `powerMonitor.on('resume', cb)` | System wake |
| `powerMonitor.on('lock-screen', cb)` | Screen lock |
| `powerMonitor.on('unlock-screen', cb)` | Screen unlock |
| `safeStorage.encryptString(str)` | Returns `Buffer`; OS keychain backed |
| `safeStorage.decryptString(buf)` | Returns `string` |
| `safeStorage.isEncryptionAvailable()` | Check before using |
| `crashReporter.start(options)` | Must be called BEFORE `whenReady` |
| `systemPreferences.canPromptTouchID()` | Check Touch ID availability |
| `systemPreferences.promptTouchID(reason)` | Prompt for Touch ID |
| `nativeTheme.shouldUseDarkColors` | Current dark/light mode |
| `nativeTheme.on('updated', cb)` | Theme change event |

---

## Preload — contextBridge

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Expose named async functions only
  // NEVER expose ipcRenderer directly
  ping: () => ipcRenderer.invoke('app:ping'),
  getData: (id: string) => ipcRenderer.invoke('data:get', { id }),
})
```

**Never** expose:
- `ipcRenderer` object directly
- `require`
- `process`
- `__dirname`

---

## Renderer — window.api (conventional)

Renderer calls `window.api.methodName(args)` which calls `ipcRenderer.invoke` in preload. All methods return Promises.

```typescript
// In renderer (TypeScript):
declare global {
  interface Window {
    api: {
      ping: () => Promise<{ ok: boolean }>
      getData: (id: string) => Promise<{ value: string }>
    }
  }
}
```

---

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `app.getVersion()` | from package.json | Current app version |
| `app.getName()` | from package.json | App name |
| `process.resourcesPath` | `/path/to/App.app/Contents/Resources` | Asset base path in packaged builds |
| `app.getPath('userData')` | `~/Library/Application Support/<name>` | User data storage |
| `app.getPath('logs')` | `~/Library/Logs/<name>` | Log file location |
| `app.getPath('temp')` | System temp dir | Temporary files |

---

## Related

- [ipc-channel-conventions.md](./ipc-channel-conventions.md) — channel naming conventions
- [log-format.md](./log-format.md) — structured log schema
- [fuses-reference.md](./fuses-reference.md) — all 6 hardening fuses
- [../lessons/01-three-process-model.md](../lessons/01-three-process-model.md) — which API belongs in which process

Evidence: `../../../05_distillation/distilled-principles.md`, `../../../05_distillation/before-you-build.md`
