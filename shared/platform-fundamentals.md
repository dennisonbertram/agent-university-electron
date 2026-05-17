# Platform Fundamentals — Electron

Concepts that apply across every POC and every future degree in this repo.

> **Status**: Stub. To be populated during Phase 1 research. Every claim must be verifiable from a cited research file.

## The Three-Process Mental Model

Electron apps are NOT single-process web apps. They are:

1. **One main process** (Node.js context, full OS access, owns the app lifecycle, creates windows).
2. **N renderer processes** (one per BrowserWindow; Chromium context; sandboxed; runs HTML/CSS/JS).
3. **N preload scripts** (one per renderer; runs in renderer's isolated world; bridges main↔renderer).

Code in one cannot directly call code in another. **Everything crosses a process boundary via IPC.**

## Lifecycle

The app's lifetime is owned by the `app` module in the main process. Key events: `ready`, `window-all-closed`, `before-quit`, `will-quit`, `quit`, `activate` (macOS dock click), `second-instance` (when single-instance lock is held).

## IPC Patterns

- Prefer `ipcMain.handle` + `ipcRenderer.invoke` (request/response with Promise).
- Use `BrowserWindow.webContents.send` + `ipcRenderer.on` for main→renderer events.
- Never expose `ipcRenderer` directly to the renderer — wrap it in `contextBridge.exposeInMainWorld('api', { ... })`.

## Security Defaults (modern apps)

```js
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // required
    sandbox: true,            // required
    nodeIntegration: false,   // required
    preload: path.join(__dirname, 'preload.js'),
  }
});
```

Plus a strict CSP meta tag in every HTML file and a `will-navigate` handler that blocks unexpected navigations.

## Native Modules

Native (C++) modules must be rebuilt against Electron's bundled Node version (not the system Node). Tools: `@electron/rebuild`, `electron-builder install-app-deps`, or electron-forge's auto-rebuild plugin.

## macOS Specifics

- Dock vs no-dock: set `app.dock.hide()` for menu-bar-only apps; configure in `Info.plist` via `LSUIElement: true` when packaging.
- Template images: PNG with `Template` suffix; macOS auto-inverts for light/dark.
- Code signing required for Gatekeeper; notarization required for macOS 10.15+.
- Universal binary: arm64 + x64; electron-forge has a maker for it.

(more added as research progresses)
