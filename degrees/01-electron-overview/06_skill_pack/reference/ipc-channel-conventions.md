# IPC Channel Conventions

Naming and structural conventions for all IPC channels.

Back to [../index.md](../index.md) | [api-cheatsheet.md](./api-cheatsheet.md)

---

## Channel Naming

```
<domain>:<verb>[-<object>]
```

Examples:
- `app:ping`
- `storage:save`
- `storage:load`
- `notification:show`
- `window:toggle`
- `test:emit-power-event`

### Rules

| Rule | Example |
|---|---|
| Lowercase kebab-case | `deep-link:open` not `deepLink:Open` |
| Domain prefix required | `storage:save` not just `save` |
| Verb before noun | `data:get` not `data:getter` |
| Test channels prefixed `test:` | `test:emit-power-event` |
| Events (main→renderer) use same format | `app:state-changed` |

---

## Channel Categories

### Production Channels (always available)

| Channel | Direction | Handler in |
|---|---|---|
| `app:ping` | renderer → main | `ipc.ts` |
| `app:version` | renderer → main | `ipc.ts` |
| `app:quit` | renderer → main | `ipc.ts` |
| `storage:save` | renderer → main | `storage.ts` |
| `storage:load` | renderer → main | `storage.ts` |
| `window:toggle` | renderer → main | `window.ts` |
| `window:hide` | renderer → main | `window.ts` |
| `notification:show` | renderer → main | `notifications.ts` |
| `tray:set-state` | renderer → main | `tray.ts` |
| `shortcuts:register` | renderer → main | `shortcuts.ts` |
| `biometric:prompt` | renderer → main | `biometric.ts` |
| `update:check` | renderer → main | `updater.ts` |
| `update:install` | renderer → main | `updater.ts` |

### Main → Renderer Push Events

| Channel | Payload | When |
|---|---|---|
| `app:state-changed` | `{ state: AppState }` | On state machine transition |
| `updater:status` | `{ event: string; info?: unknown }` | On updater events |
| `deep-link:received` | `{ action: string; params: Record<string, string> }` | On deep link |
| `power:event` | `{ event: 'suspend' \| 'resume' \| 'lock-screen' \| ... }` | On power events |

Use `webContents.send(channel, payload)` from main; listen with `ipcRenderer.on(channel, cb)` in preload, exposed via `contextBridge`.

### Test Channels (gated by `testHooksEnabled()`)

| Channel | Purpose |
|---|---|
| `test:emit-power-event` | Simulate power monitor events |
| `test:emit-open-url` | Simulate deep link `open-url` |
| `test:fire-shortcut` | Simulate global shortcut trigger |
| `test:trigger-will-quit` | Simulate app quit sequence |
| `test:get-log-path` | Return current log file path |
| `test:set-app-state` | Force app state for testing |

---

## Registry Structure

All channels are registered via a central registry. No `ipcMain.handle` calls outside `registerIpc()`.

```typescript
// src/ipc.ts
interface RegistryEntry<TIn, TOut> {
  channel: string
  validate: (raw: unknown) => TIn
  handler: (validated: TIn, ctx: HandlerContext) => Promise<TOut> | TOut
}

const IPC_REGISTRY: RegistryEntry<unknown, unknown>[] = [
  {
    channel: 'app:ping',
    validate: () => ({}),
    handler: () => ({ ok: true, ts: Date.now() }),
  },
  // ...
]

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  for (const entry of IPC_REGISTRY) {
    ipcMain.handle(entry.channel, async (_event, arg) => {
      const validated = entry.validate(arg)
      return entry.handler(validated, ctx)
    })
  }
  if (testHooksEnabled()) {
    for (const entry of TEST_REGISTRY) {
      ipcMain.handle(entry.channel, async (_event, arg) => {
        const validated = entry.validate(arg)
        return entry.handler(validated, ctx)
      })
    }
  }
}
```

---

## Validation

Every production channel MUST have a validator. The validator throws `IpcValidationError` for invalid input. The main `registerIpc` wrapper catches it and logs `ipc:<channel>:validation-failed`.

```typescript
export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IpcValidationError'
  }
}
```

Note: the `code` field does NOT round-trip through Electron's IPC. Only `message` survives. See [../troubleshooting/ipc-validation-error-shape.md](../troubleshooting/ipc-validation-error-shape.md).

---

## Preload Exposure Pattern

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('api', {
  // One method per channel
  ping: () => ipcRenderer.invoke('app:ping'),
  storageSave: (key: string, data: unknown) =>
    ipcRenderer.invoke('storage:save', { key, data }),
  storageLoad: (key: string) =>
    ipcRenderer.invoke('storage:load', { key }),
  // Push events from main
  onStateChanged: (cb: (state: AppState) => void) => {
    ipcRenderer.on('app:state-changed', (_e, payload) => cb(payload.state))
  },
  // Test seams (exposed unconditionally; gated in main)
  testEmitPower: (event: string) =>
    ipcRenderer.invoke('test:emit-power-event', { event }),
})
```

---

## Anti-Patterns

| Anti-Pattern | Why | Fix |
|---|---|---|
| `ipcMain.handle` outside `registerIpc` | Breaks centralized registry | Move to IPC_REGISTRY |
| `ipcRenderer.sendSync` | Blocks renderer thread; poor error semantics | Use `invoke` |
| `contextBridge.exposeInMainWorld('api', { ipcRenderer })` | Exposes full IPC surface | Expose named methods only |
| String literal channel names scattered in code | Impossible to audit | Use `const CHANNELS = { ... } as const` |
| No validator on a channel | Security hole | Every channel gets a validator |

---

## Related

- [../lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md) — IPC architecture lesson
- [../recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md) — complete registry implementation
- [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md) — test channel pattern
- [../checklists/security-checklist.md](../checklists/security-checklist.md) — IPC security items 11–15

Evidence: `../../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`, `../../../05_distillation/patterns/P-07-test-seam-ipc-channels-gated-by-env.md`
