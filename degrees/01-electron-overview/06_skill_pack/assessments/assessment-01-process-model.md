# Assessment 01 — Process Model and IPC Architecture

Tests understanding of Electron's three-process model and IPC fundamentals.

Back to [../index.md](../index.md) | [assessment-02-security.md](./assessment-02-security.md)

---

## Questions

**Q1.** An Electron app has one `BrowserWindow`. How many Node.js processes are running when the window is open? Name each process and what it can access.

**Q2.** You need to read a file from the filesystem when the user clicks a button in the renderer. Write the minimum code path: renderer call → preload bridge → main handler → response. Do not skip any layer.

**Q3.** What is the `contextBridge` and why is it required when `contextIsolation: true`?

**Q4.** A developer writes this in `src/preload.ts`:
```typescript
contextBridge.exposeInMainWorld('api', require('electron'))
```
Name two security problems this introduces.

**Q5.** Describe the "IPC error round-trip problem" (G-03). What happens to a custom error class with a `code` property when thrown in `ipcMain.handle`?

**Q6.** Why is `ipcRenderer.sendSync` banned in production code? Name two reasons.

**Q7.** A new `ipcMain.handle('data:delete', ...)` handler is needed. A developer adds it directly in `main.ts` instead of the central registry. What invariant does this break, and what does it prevent?

**Q8.** What does `testHooksEnabled()` check, and where are test channels registered relative to production channels?

---

## Answer Key

**A1.** Three processes: (1) **Main process** — has Node.js + all Electron APIs, creates windows, manages OS integration. (2) **Renderer process** — Chromium page, DOM APIs only, no Node.js. (3) **Preload script** — runs before renderer, sandboxed Node context, has `contextBridge` and `ipcRenderer`.

**A2.**
```
// renderer.ts
const result = await window.api.readFile(path)

// preload.ts  
readFile: (path: string) => ipcRenderer.invoke('fs:read', { path })

// ipc.ts (IPC_REGISTRY entry)
channel: 'fs:read',
validate: (arg) => { /* validate arg.path is string */ return { path: arg.path } },
handler: async ({ path }) => { return { content: fs.readFileSync(path, 'utf-8') } }
```

**A3.** `contextBridge` is the secure bridge between preload and renderer when `contextIsolation: true`. It exposes a limited, named API surface. Without it, the preload's `window` modifications would be in an isolated context and invisible to the renderer. It prevents the renderer from accessing preload's Node.js scope.

**A4.** (1) Exposes the entire `ipcRenderer` object — the renderer can call any IPC channel, including channels that were never meant to be accessible from the renderer. (2) Exposes Node.js APIs that are part of the electron module, giving the renderer direct access to privileged APIs that should be restricted.

**A5.** G-03: Electron uses the Structured Clone Algorithm to serialize IPC messages. `Error` objects are serialized with only their `message` property. Custom properties like `.code`, `.details`, or anything added to the Error subclass are stripped in transit. The renderer receives `{ message: 'some text' }` with all custom fields missing. Fix: encode extra info in the message string, or return a discriminated union result object instead of throwing.

**A6.** (1) Blocks the renderer's JavaScript event loop synchronously — any delay in the main handler freezes the UI. (2) Error propagation is broken — if the main handler throws, the renderer receives `undefined` instead of an error. Additionally, it breaks the security model by creating a synchronous cross-process call path.

**A7.** Breaks the centralized registry invariant: all channels must be in `IPC_REGISTRY` and registered via `registerIpc()`. This prevents: (a) security audit — you can no longer grep one place to see all channels, (b) test seam hygiene — the rogue handler is always active, not conditional on `testHooksEnabled()`, (c) consistent error handling — the shared validator wrapper isn't applied.

**A8.** `testHooksEnabled()` returns `true` when `process.env.NODE_ENV === 'test'` OR `process.env.MY_APP_TEST_HOOKS === '1'`. Test channels are registered in a separate `TEST_REGISTRY` array, conditionally added to `ipcMain` only if `testHooksEnabled()` is true at app startup. Production channels are always registered.

---

## Relevant Files

- [../lessons/01-three-process-model.md](../lessons/01-three-process-model.md)
- [../lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md)
- [../recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md)
- [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md)
