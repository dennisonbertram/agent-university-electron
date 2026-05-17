# Example — L2: Secure IPC

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

The L2 implementation extends L1 with a complete IPC registry, navigation guards, permission handler, and Content Security Policy. It demonstrates the full security layer for a production Electron app.

---

## Patterns Demonstrated

| Pattern | File | Recipe/Lesson |
|---|---|---|
| IPC registry with validators + error logging | `src/ipc.ts` | [../recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md) |
| Navigation guards (will-navigate, setWindowOpenHandler) | `src/security.ts` | [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md) |
| Permission request handler | `src/security.ts` | [../checklists/security-checklist.md](../checklists/security-checklist.md) |
| Test-seam channels | `src/ipc.ts` | [../recipes/recipe-test-seam-ipc-channel.md](../recipes/recipe-test-seam-ipc-channel.md) |
| CSP meta tag | `src/renderer/index.html` | [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md) |

---

## Source File Map

| File | Description |
|---|---|
| `src/security.ts` | `installSecurityHandlers(win)`: navigation guards, window open handler, permission handler |
| `src/ipc.ts` | Full `IPC_REGISTRY` with `IpcValidationError`, `registerIpc()`, `TEST_REGISTRY`, `testHooksEnabled()` |
| `src/preload.ts` | Exposes production and test methods via `contextBridge` |
| `tests/security.spec.ts` | Playwright: blocked navigation, denied window.open, denied permissions |
| `tests/ipc.spec.ts` | Playwright: valid/invalid IPC payloads, test seam channels |

---

## Key Learning Points

1. **`will-navigate` event**: Registered on `webContents`, fires before navigation. Return a canceled event to block.
2. **`setWindowOpenHandler`**: Returns `{ action: 'deny' }` to block `window.open()` from renderer.
3. **`session.setPermissionRequestHandler`**: Deny-by-default handler fires for camera, mic, location, etc.
4. **Validation log markers**: `ipc:<channel>:validation-failed` is the test contract for invalid inputs.
5. **G-02 ambient .d.ts gotcha**: If you have `src/electron.d.ts` that re-declares electron types, it can break TypeScript compilation silently.

---

## Corresponding Lab

[../labs/lab-02-secure-ipc-roundtrip.md](../labs/lab-02-secure-ipc-roundtrip.md) — implement a validated IPC channel and test it.

---

## Corresponding Lessons

- [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md)
- [../lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md)
- [../lessons/12-testing-electron-apps.md](../lessons/12-testing-electron-apps.md)

Evidence: `../../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`, `../../../05_distillation/patterns/P-07-test-seam-ipc-channels-gated-by-env.md`
