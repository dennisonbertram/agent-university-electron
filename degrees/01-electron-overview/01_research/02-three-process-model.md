# Three-Process Model — Electron

Version: Electron 42.1.0 [S1, S5]

## Overview

Every Electron app has exactly three types of processes:

```
┌─────────────────────────────────────────────────────┐
│                   Main Process (1)                   │
│  Node.js runtime + Electron main-process modules     │
│  - Creates BrowserWindows                            │
│  - Manages app lifecycle                             │
│  - Accesses OS APIs: Tray, Menu, Dock, shortcuts     │
│  - Full fs, net, child_process access                │
└──────────┬───────────────────────────┬──────────────┘
           │ IPC (ipcMain / ipcRenderer) │
           ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  Preload Script      │    │  Preload Script           │
│  (per BrowserWindow) │    │  (per BrowserWindow)      │
│  Limited Node polyfill    │  contextBridge bridge      │
└──────────┬───────────┘    └──────────────────────────┘
           │ contextBridge (exposeInMainWorld)
           ▼
┌──────────────────────────────────────────────────────┐
│          Renderer Process (1 per BrowserWindow)       │
│  Chromium renderer — standard web platform only       │
│  - NO require(), NO Node APIs                         │
│  - HTML + CSS + TypeScript (bundled)                  │
│  - Accesses main via window.api (contextBridge)       │
└──────────────────────────────────────────────────────┘
```

## Main Process

### What It CAN Do

- Import any Node.js module (`fs`, `net`, `child_process`, etc.)
- Use any Electron main-process module: `app`, `BrowserWindow`, `ipcMain`, `Menu`, `Tray`, `Notification`, `globalShortcut`, `powerMonitor`, `dialog`, `session`, `protocol`, `shell`, `nativeTheme`, `safeStorage`, `systemPreferences`, `crashReporter`
- Create multiple `BrowserWindow` instances (each spawns a renderer)
- Spawn `UtilityProcess` for heavy/crash-prone background tasks
- Access the filesystem, network, native OS APIs
- Register global shortcuts, custom protocols, login items

### What It CANNOT Do

- Directly manipulate DOM — must send to renderer via IPC
- Use renderer-specific APIs (`document`, `window`, `localStorage`)
- Block for long periods — blocks UI event loop and freezes all windows

### Lifecycle

1. App starts → main process starts
2. `app.whenReady()` resolves → create BrowserWindows, register shortcuts/tray
3. Each BrowserWindow spawns a renderer process
4. On window close → renderer terminates (unless `hide()` is used)
5. `will-quit` → clean up global shortcuts, flush state
6. Process exits

### TypeScript Imports (main process)

```typescript
import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
// or type-scoped:
import { app } from 'electron/main'
```

## Renderer Process

### What It CAN Do

- Standard web platform: DOM, fetch, Web APIs, WebGL, WebWorkers
- CSS, HTML, bundled JavaScript/TypeScript
- Call `window.api.<method>()` exposed via contextBridge
- Web Workers for CPU-bound work
- Use the web Notification API (distinct from Electron's `Notification` class)

### What It CANNOT Do

- `require()` anything — no CommonJS in renderer (nodeIntegration: false by default)
- Access `fs`, `net`, `child_process`, or any Node.js module directly
- Import Electron renderer modules directly without a bundler alias (and even then, only specific ones)
- Talk directly to another renderer — must route through main

### Security Defaults (Electron 20+)

```typescript
// Secure by default since respective versions:
nodeIntegration: false  // since 5.0.0
contextIsolation: true  // since 12.0.0
sandbox: true           // since 20.0.0
```

DO NOT change these defaults. [S3]

### Renderer Entry Point

```html
<!-- src/renderer/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'">
  </head>
  <body>
    <script src="renderer.js"></script>
  </body>
</html>
```

## Preload Script

### Role

The preload script is the bridge between privileged (Node/Electron) and unprivileged (web) worlds. It runs inside the renderer context BEFORE web content loads, but in a separate JavaScript context (due to contextIsolation).

### What It CAN Do (with sandbox: true, Electron 20+)

The sandbox polyfills a limited subset of Node APIs [S5]:

Available `require()` modules in preload under sandbox:
- `electron` — only: `contextBridge`, `crashReporter`, `ipcRenderer`, `nativeImage`, `webFrame`, `webUtils`
- `events`
- `timers`
- `url`
- Node-prefixed: `node:events`, `node:timers`, `node:url`

Available globals: `Buffer`, `process`, `clearImmediate`, `setImmediate`

### What It CANNOT Do (under sandbox: true)

- Import arbitrary npm packages via CommonJS (no `require('lodash')`)
- Split into multiple files via CommonJS (polyfill limitation) — use a bundler
- Access `fs`, `net`, `child_process`
- Call most Electron main-process APIs directly

### Canonical Preload Pattern (TypeScript)

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

// Expose narrow, typed API to renderer
contextBridge.exposeInMainWorld('api', {
  // renderer → main (two-way)
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),

  // main → renderer (subscription)
  onThemeChanged: (cb: (dark: boolean) => void): void => {
    ipcRenderer.on('theme:changed', (_event, dark) => cb(dark))
  },
})
```

```typescript
// src/renderer/api.d.ts — type declaration for renderer
export interface IApi {
  ping: () => Promise<string>
  onThemeChanged: (cb: (dark: boolean) => void) => void
}

declare global {
  interface Window {
    api: IApi
  }
}
```

### Serialization Rules (contextBridge) [S4]

What CAN cross contextBridge:
- Primitives: string, number, boolean, null, undefined
- Plain objects (no custom prototype chain)
- Arrays
- Functions (exposed at the top level of the API object)
- Promises (automatically converted to async)

What CANNOT cross:
- Custom prototype chains (`class Foo {}` instances lose prototype)
- Symbols
- DOM objects (Element, etc.)
- C++-backed Electron objects (BrowserWindow, WebContents)
- Node.js stream objects

## UtilityProcess (Fourth Process Type)

Spawned from main process for crash isolation or heavy CPU work. Has Node.js environment. Can use MessagePort for direct renderer communication. [S1]

```typescript
import { utilityProcess } from 'electron'
const child = utilityProcess.fork('./heavy-worker.js')
```

## Communication Summary

| Direction | API | Notes |
|-----------|-----|-------|
| Renderer → Main (request/response) | `ipcRenderer.invoke` / `ipcMain.handle` | Preferred; Promise-based |
| Renderer → Main (fire-and-forget) | `ipcRenderer.send` / `ipcMain.on` | No response |
| Main → Renderer (push) | `webContents.send` + `ipcRenderer.on` | Requires reference to WebContents |
| Renderer ↔ Renderer | Route through main OR MessagePort | Direct not supported |

Full IPC patterns in `04-ipc-patterns.md`.
