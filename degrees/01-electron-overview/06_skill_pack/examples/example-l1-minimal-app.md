# Example — L1: Minimal Electron App

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

The L1 implementation is the simplest possible Electron app: one BrowserWindow, one IPC channel (echo), structured logging, and a preload bridge. It establishes the three-process model without any macOS-specific features.

---

## Patterns Demonstrated

| Pattern | File | Recipe |
|---|---|---|
| Secure BrowserWindow factory | `src/window.ts` | [../recipes/recipe-secure-window.md](../recipes/recipe-secure-window.md) |
| IPC registry with validator | `src/ipc.ts` | [../recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md) |
| Preload contextBridge exposure | `src/preload.ts` | [../reference/ipc-channel-conventions.md](../reference/ipc-channel-conventions.md) |
| Structured JSONL logger | `src/log.ts` | [../recipes/recipe-structured-jsonl-logger.md](../recipes/recipe-structured-jsonl-logger.md) |
| Pre-ready boot ordering | `src/main.ts` | [../recipes/recipe-crashreporter-pre-ready.md](../recipes/recipe-crashreporter-pre-ready.md) |
| CSP in HTML | `src/renderer/index.html` | [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md) |

---

## Source File Map

| File | Description |
|---|---|
| `src/main.ts` | Entry point; crashReporter → singleInstanceLock → whenReady → window |
| `src/window.ts` | `createMainWindow()` with `SECURE_WEB_PREFERENCES` |
| `src/preload.ts` | `contextBridge.exposeInMainWorld('api', { ping, echo })` |
| `src/ipc.ts` | `IPC_REGISTRY` with `app:ping` and `app:echo` channels |
| `src/log.ts` | `createLogger(module)` returns `{ debug, info, warn, error }` |
| `src/renderer/index.html` | HTML with CSP meta tag |
| `src/renderer/renderer.ts` | Calls `window.api.echo()` on button click |
| `package.json` | Build scripts: `build:main`, `build:preload`, `build:renderer` |
| `tsconfig.json` | `"module": "CommonJS"`, `"target": "ES2022"` |

---

## Key Learning Points

1. **Three files for three processes**: `main.ts` (main), `preload.ts` (preload), `renderer.ts` (renderer). They are built separately and cannot import each other.
2. **`__dirname` in preload**: Points to where preload.js is on disk — required for `path.join(__dirname, 'preload.js')` in window options.
3. **IpcValidationError** serialization: The `code` property does NOT survive IPC. See [../troubleshooting/ipc-validation-error-shape.md](../troubleshooting/ipc-validation-error-shape.md).
4. **Boot log markers**: `crash:reporter-started` must appear before `app:ready` in logs.

---

## Corresponding Lab

[../labs/lab-01-hello-electron.md](../labs/lab-01-hello-electron.md) — build this from scratch step by step.

---

## Corresponding Lessons

- [../lessons/01-three-process-model.md](../lessons/01-three-process-model.md)
- [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md)
- [../lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md)
- [../lessons/07-app-lifecycle-and-single-instance.md](../lessons/07-app-lifecycle-and-single-instance.md)
- [../lessons/11-crash-reporting-and-observability.md](../lessons/11-crash-reporting-and-observability.md)

Evidence: `../../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`, `../../../05_distillation/patterns/P-06-pre-ready-boot-ordering.md`
