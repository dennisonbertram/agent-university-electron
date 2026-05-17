# AP-03 — `ipcRenderer.sendSync` and `ipcMain.on` with `event.returnValue`

**Severity**: medium (performance / UX)
**Surface**: IPC pattern selection.

## What this looks like

```typescript
// renderer (or preload) — WRONG
const result = ipcRenderer.sendSync('get-config')

// main side — WRONG
ipcMain.on('get-config', (event) => {
  event.returnValue = readConfigSync() // blocks the renderer
})
```

## Why this is wrong

- `sendSync` blocks the renderer's main thread until main replies. Any disk I/O, DB query, or slow operation in main freezes the UI completely (no spinner, no input, no animations).
- The renderer cannot show feedback while the call is in flight.
- Even on fast paths, the synchronous IPC hop adds 1-5ms of latency that an async `invoke` doesn't.

## Better approach

Use `invoke`/`handle` (Promise-based) for every request/response:

```typescript
// preload
contextBridge.exposeInMainWorld('api', {
  getConfig: (): Promise<Config> => ipcRenderer.invoke('get-config'),
})

// main
ipcMain.handle('get-config', async (): Promise<Config> => readConfig())
```

For fire-and-forget with no response, use `send`/`on`:

```typescript
// preload
contextBridge.exposeInMainWorld('api', {
  log: (msg: string): void => ipcRenderer.send('log:entry', msg),
})
// main
ipcMain.on('log:entry', (_event, msg: string) => logger.info('renderer:log', { msg }))
```

## Test / lint that catches it

Grep `sendSync` and `event.returnValue` across `src/`; both should be absent.

## Evidence

- `01_research/04-ipc-patterns.md` lines 129-141
- `02_planning/test-strategy.md` (no sendSync allowed)
