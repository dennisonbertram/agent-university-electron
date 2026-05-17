# IPC Patterns — Electron

Version: Electron 42.1.0 [S2, S4]

## Overview

IPC (Inter-Process Communication) is the ONLY way renderer processes communicate with the main process. contextBridge enforces this boundary. There are four canonical patterns.

## Pattern 1: invoke/handle (PREFERRED — renderer → main, request/response)

Added in Electron 7. Promise-based. The canonical way to request data from main.

```typescript
// src/ipc.ts — main process
import { ipcMain } from 'electron'

export function registerIpcHandlers(): void {
  /** Responds to app:ping with current timestamp */
  ipcMain.handle('app:ping', async (_event): Promise<{ ts: number }> => {
    return { ts: Date.now() }
  })
}

// In main.ts:
// app.whenReady().then(() => { registerIpcHandlers(); createWindow() })
```

```typescript
// src/preload.ts — preload script
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: (): Promise<{ ts: number }> => ipcRenderer.invoke('app:ping'),
})
```

```typescript
// src/renderer/renderer.ts — renderer (no require)
const result = await window.api.ping()
console.log(result.ts)
```

### Error Handling in invoke/handle

CRITICAL: Errors thrown inside `ipcMain.handle` are serialized and only the `message` property is forwarded to the renderer. Stack traces, error types, and custom properties are lost. [S2]

```typescript
// Main process
ipcMain.handle('journal:append', async (_event, entry: unknown) => {
  if (typeof entry !== 'string') {
    throw new Error('entry must be a string') // Only 'message' reaches renderer
  }
  await appendEntry(entry)
})

// Renderer receives: Error { message: 'entry must be a string' }
// Does NOT receive: stack, type info, custom fields
```

Pattern: define a typed error envelope and serialize it into the return value instead of throwing for expected errors.

## Pattern 2: send/on (renderer → main, fire-and-forget)

No response. Use when the renderer doesn't need confirmation.

```typescript
// Main
ipcMain.on('log:entry', (_event, message: string) => {
  console.log('[renderer]', message)
})

// Preload
contextBridge.exposeInMainWorld('api', {
  log: (message: string): void => ipcRenderer.send('log:entry', message),
})
```

## Pattern 3: webContents.send (main → renderer, push)

Main initiates. Must hold a reference to the renderer's `WebContents`.

```typescript
// Main — push theme change to renderer
import { nativeTheme, BrowserWindow } from 'electron'

nativeTheme.on('updated', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors)
})
```

```typescript
// Preload — expose listener
contextBridge.exposeInMainWorld('api', {
  onThemeChanged: (cb: (dark: boolean) => void): void => {
    // CORRECT: wrap in closure, do not expose ipcRenderer.on directly
    ipcRenderer.on('theme:changed', (_event, dark) => cb(dark))
  },
})
```

SECURITY: Never expose `ipcRenderer.on` directly — the callback receives an `IpcRendererEvent` that exposes `sender`, leaking ipcRenderer. Wrap in a closure that extracts only the needed value. [S3]

### Main → ALL renderers (broadcast)

```typescript
import { BrowserWindow } from 'electron'

function broadcastToAll(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send(channel, ...args)
  })
}
```

## Pattern 4: MessageChannelMain (high-throughput / renderer-to-renderer)

For high-frequency data transfer or direct renderer-to-renderer communication. Main sets up a MessageChannelMain and transfers ports.

```typescript
// Main process
import { MessageChannelMain } from 'electron'

const { port1, port2 } = new MessageChannelMain()
win1.webContents.postMessage('port', null, [port1])
win2.webContents.postMessage('port', null, [port2])
```

## Anti-Pattern: sendSync (NEVER USE)

`ipcRenderer.sendSync()` blocks the renderer thread until main replies. Any slowness in main (disk I/O, DB query) blocks the entire renderer — freezing UI.

```typescript
// WRONG — blocks renderer
const result = ipcRenderer.sendSync('get-config')

// CORRECT — use invoke
const result = await ipcRenderer.invoke('get-config')
```

[S2]

## Serialization Rules

IPC uses the HTML Structured Clone Algorithm. [S2]

### What CAN be sent across IPC

- Primitives: string, number, boolean, null, undefined, BigInt
- Arrays, plain objects (no custom prototype)
- ArrayBuffer, TypedArray
- Map, Set, Date, RegExp, Error

### What CANNOT be sent

- DOM objects (Element, Location, DOMMatrix)
- Functions (via send/invoke — functions can only cross via contextBridge at setup time)
- C++-backed Electron objects: `BrowserWindow`, `WebContents`, `WebFrame`
- Node.js C++ objects: `process.env` references, Stream instances

Attempting to send incompatible objects will throw or silently become null.

## Channel Naming Convention (per conventions.md)

Use `verb:noun` namespaced form:

```
app:get-version
app:ping
journal:append
journal:list
focus:start
focus:stop
focus:status
theme:changed
power:suspend
power:resume
```

Document every channel in the POC README's "IPC Surface" section.

## IPC Sender Validation

For security-sensitive handlers, validate the sender's origin:

```typescript
import { ipcMain } from 'electron'

ipcMain.handle('secrets:get', (event) => {
  const frameUrl = event.senderFrame?.url ?? ''
  if (!frameUrl.startsWith('file://')) {
    return null // reject non-local frames
  }
  return getSecrets()
})
```

[S3]

## Typed IPC Pattern (TypeScript end-to-end)

Define channel types once, use in main, preload, and renderer:

```typescript
// src/ipc-channels.ts (shared types — import in preload and main)
export interface IpcChannels {
  'app:ping': {
    args: []
    response: { ts: number }
  }
  'journal:append': {
    args: [entry: string]
    response: void
  }
}

// Renderer gets strong types via window.api declared in api.d.ts
```

## Removing Listeners (Prevent Memory Leaks)

```typescript
// Preload — return cleanup function
contextBridge.exposeInMainWorld('api', {
  onThemeChanged: (cb: (dark: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dark: boolean) => cb(dark)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },
})

// Renderer — call cleanup on unmount
const cleanup = window.api.onThemeChanged(setDark)
// on component unmount:
cleanup()
```
