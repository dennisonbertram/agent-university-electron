# Lesson 01 — The Three-Process Model

**Prerequisites**: none  
**Next**: [02-secure-renderer-defaults.md](./02-secure-renderer-defaults.md)

## Mental Model

Electron runs three types of OS processes. Understanding the boundary between them is the foundation of every correct Electron design.

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                  │
│  - Full Node API, Electron APIs (app, BrowserWindow,    │
│    ipcMain, Menu, Tray, globalShortcut, ...)             │
│  - ONE per app instance                                  │
│  - src/main.ts                                           │
├─────────────────┬───────────────────────────────────────┤
│  Preload Script │  Renderer Process (Chromium)           │
│  (sandboxed     │  - DOM + Web APIs only                 │
│   Node subset)  │  - NO Node, NO Electron (by default)  │
│  - contextBridge│  - ONE per BrowserWindow               │
│  bridge         │  - src/renderer/renderer.ts            │
│  src/preload.ts │                                        │
└─────────────────┴───────────────────────────────────────┘
        IPC (ipcMain.handle / ipcRenderer.invoke)
```

## The Main Process

- Singleton. Starts when `electron` binary runs `src/main.ts`.
- Has full Node.js API: `fs`, `net`, `child_process`, etc.
- Has all Electron system APIs: `app`, `BrowserWindow`, `Tray`, `Menu`, `globalShortcut`, `ipcMain`, `powerMonitor`, `crashReporter`, `autoUpdater`, `safeStorage`, `systemPreferences`, `dialog`.
- Can create BrowserWindows. Each window spawns a Renderer process.
- Lifecycle: `app:ready` → windows active → `window-all-closed` → `before-quit` → `will-quit` → exit.

## The Renderer Process

- One per BrowserWindow (or WebContentsView). Runs a Chromium page.
- No Node.js, no native modules, no Electron APIs — intentionally.
- Why: Renderer runs untrusted HTML/JS. Giving it Node access means XSS = arbitrary code execution on the host OS.
- Accesses host capabilities ONLY through the preload bridge.
- Source: `src/renderer/renderer.ts` (compiled to `dist/renderer/renderer.js`).

## The Preload Script

- Runs inside the renderer's process but before page JS loads.
- Has access to a limited Node API subset AND `contextBridge` and `ipcRenderer`.
- Under `sandbox: true`: `require()` of npm packages or relative files is BLOCKED. Any relative `require()` silently aborts the preload — `window.api` ends up undefined and you see a white screen (G-01).
- Must be bundled with esbuild (`--external:electron`) to use any imports under sandbox.
- Exposes a narrow API to the renderer via `contextBridge.exposeInMainWorld('api', {...})`.

```typescript
// src/preload.ts — correct pattern
import { contextBridge, ipcRenderer } from 'electron'
// No require('./ipc') or require('anything') — bundle with esbuild instead

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
  // Each method is a narrow wrapper — NOT ipcRenderer itself
})
```

## IPC — The Communication Channel

Main ↔ Renderer communicate only through IPC:

```
Renderer:  window.api.ping()
              ↓ (preload bridges to ipcRenderer.invoke)
Preload:   ipcRenderer.invoke('app:ping')
              ↓ (IPC message sent to main)
Main:      ipcMain.handle('app:ping', handler)
              ↓ (response sent back)
Renderer:  result = await window.api.ping()
```

There are two IPC patterns:
- **invoke/handle** (request-response): renderer calls `ipcRenderer.invoke(ch, arg)`, main replies with `ipcMain.handle(ch, handler)`. Preferred.
- **send/on** (fire-and-forget): renderer calls `ipcRenderer.send(ch)`, main registers `ipcMain.on(ch, handler)`. Use only when no response needed.
- **Main → Renderer push**: `win.webContents.send(ch, data)` from main; preload registers `ipcRenderer.on(ch, handler)` and forwards to a window.api callback.

## Capability Matrix

| Capability | Main | Preload | Renderer |
|---|:---:|:---:|:---:|
| Node.js `fs`, `net` | YES | Partial (sandbox=true: NO) | NO |
| `app`, `BrowserWindow` | YES | NO | NO |
| `ipcMain.handle` | YES | NO | NO |
| `ipcRenderer.invoke` | NO | YES | NO |
| `contextBridge` | NO | YES | NO |
| `window.*` (DOM) | NO | YES (via `window`) | YES |
| Native modules | YES | NO (sandbox) | NO |
| `safeStorage` | YES | NO | NO |
| `systemPreferences` | YES | NO | NO |
| `crashReporter` | YES | NO | NO |

## What Goes Where — Design Rule

- **Business logic**: main process (has Node, native modules, OS APIs)
- **UI logic**: renderer (has DOM, CSS, Web APIs)
- **Bridge wiring**: preload (narrow, typed wrappers only)
- **File I/O, crypto, DB**: main process only
- **Display state, form data**: renderer only

Never put secrets, file paths, or sensitive ops in the renderer. They belong in main and are exposed only as named operations via `contextBridge`.

## Key Takeaways

1. Main = Node + Electron APIs. Renderer = Chromium page only.
2. Preload bridges them via `contextBridge` — not by passing `ipcRenderer` through.
3. Under `sandbox: true`, preload cannot `require()` — bundle it with esbuild.
4. IPC is the only communication channel. Every channel needs a handler in main.
5. The security model exists because renderers can run untrusted web content.

Evidence: `../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../01_research/02-three-process-model.md`, `../../05_distillation/gotchas/G-01-sandbox-preload-cannot-require-relative-files.md`
