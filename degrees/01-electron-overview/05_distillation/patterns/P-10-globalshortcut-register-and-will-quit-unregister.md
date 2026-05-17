# P-10 — Pair every `globalShortcut.register` with a `will-quit` cleanup

**When to use**: every `globalShortcut.register` call.
**Evidence**: L4 R-L4-2, capstone R-C-7 (`03_pocs/L-capstone-pulse/src/shortcuts.ts:68-77`).

## Pattern

```typescript
// src/shortcuts.ts
import { app, globalShortcut } from 'electron'

export function installShortcuts(opts: { logger: Logger; onFire?: (a: string) => void }) {
  const handlers = new Map<string, () => void>()

  const register = (accelerator: string) => {
    const handler = () => {
      logger.info(`shortcut:${accelerator}:fired`, { accelerator })
      opts.onFire?.(accelerator)
    }
    handlers.set(accelerator, handler)
    const registered = globalShortcut.register(accelerator, handler)
    if (registered) {
      logger.info('shortcut:registered', { accelerator })
    } else {
      logger.warn('shortcut:register:failed', { accelerator })
    }
  }

  register('CmdOrCtrl+Shift+P')
  register('CmdOrCtrl+Shift+J')

  // CRITICAL: R-L4-2 / R-C-7 invariant — must contain literal
  // `app.on('will-quit'` + `globalShortcut.unregisterAll()`.
  app.on('will-quit', () => {
    try {
      globalShortcut.unregisterAll()
      logger.info('shortcut:cleanup:will-quit', { count: handlers.size })
    } catch (err) { /* tolerated */ }
  })

  return { /* service surface */ }
}
```

A static regression test:

```typescript
test('R-L4-2: every shortcuts file unregisters in will-quit', () => {
  const src = readFileSync('src/shortcuts.ts', 'utf8')
  expect(src).toMatch(/app\.on\('will-quit'/)
  expect(src).toMatch(/globalShortcut\.unregisterAll\(\)/)
})
```

## Why it works

- macOS Quartz Event Tap doesn't auto-release on process exit; an unclean shutdown can leave accelerators reserved against the system lookup table on some macOS versions.
- Single `unregisterAll()` is sufficient; per-accelerator unregister is not needed.
- `will-quit` fires before the app process exits, which is the right timing.

## Tradeoffs

- Static-source regression check is brittle to refactors. If the literal `app.on('will-quit',` ever moves into a generic listener-attacher, the static check fails — that's the goal (visible regression alarm) but it can trip on legitimate restructures.

## Variants

- **Per-accelerator unregister on dynamic removal** — for apps that bind/unbind shortcuts based on UI state. Combine with the catch-all `will-quit` cleanup.

## Evidence

- `03_pocs/L-capstone-pulse/src/shortcuts.ts:68-77`
- `03_pocs/L4-deep-macos-integration/poc-report.md` R-L4-2
- `01_research/09-global-shortcuts.md`
