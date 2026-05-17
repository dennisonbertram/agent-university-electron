# AP-02 — Exposing `ipcRenderer` (or `ipcRenderer.send`) wholesale via contextBridge

**Severity**: high (security)
**Surface**: contextBridge / preload.

## What this looks like

```typescript
// preload — WRONG: exposes the whole IPC surface
contextBridge.exposeInMainWorld('api', {
  send: ipcRenderer.send,
  invoke: ipcRenderer.invoke,
})

// or worse, the whole module:
contextBridge.exposeInMainWorld('electron', require('electron'))
```

## Why this is wrong

- The renderer can now send to ANY channel, including internal IPC routes you never intended to expose.
- An XSS payload can drive the entire IPC surface, regardless of validators on individual channels (it just picks the channel that doesn't validate strictly).
- Exposing `ipcRenderer.on` directly leaks the `IpcRendererEvent.sender` — full access to the WebContents, bypassing contextIsolation (evidence: `01_research/04-ipc-patterns.md` line 102).

## Better approach

Expose narrow, purpose-built methods that bind specific channels:

```typescript
contextBridge.exposeInMainWorld('api', {
  ping: (): Promise<{ ts: number }> => ipcRenderer.invoke('app:ping'),
  journalAppend: (entry: { text: string }) => ipcRenderer.invoke('journal:append', entry),
  onTick: (cb: (n: number) => void): () => void => {
    const handler = (_event: Electron.IpcRendererEvent, n: number) => cb(n)
    ipcRenderer.on('tick', handler)
    return () => ipcRenderer.removeListener('tick', handler)
  },
})
```

Always wrap `ipcRenderer.on` in a closure that extracts only the needed value — never expose the event object.

## Test / lint that catches it

Static-source check on `src/preload.ts`: assert that no top-level value of the `exposeInMainWorld` object is `ipcRenderer.send`, `ipcRenderer.invoke`, `ipcRenderer.on`, or `ipcRenderer` itself.

## Evidence

- `01_research/05-security-model.md` lines 144-154
- `01_research/04-ipc-patterns.md` lines 91-114
- `03_pocs/L2-secure-ipc/src/preload.ts` (canonical narrow surface)
