# Recipe — Global Shortcut with Cleanup

**Use when**: Registering any global keyboard shortcut.

## Code

```typescript
// src/shortcuts.ts
import { app, globalShortcut } from 'electron'

export interface ShortcutController {
  fireForTest(accelerator: string): void
}

export function installShortcuts(opts: {
  logger: Logger
  onFire?: (accelerator: string) => void
}): ShortcutController {
  const handlers = new Map<string, () => void>()

  const register = (accelerator: string) => {
    const handler = () => {
      opts.logger.info(`shortcut:${accelerator}:fired`, { accelerator })
      opts.onFire?.(accelerator)
    }
    handlers.set(accelerator, handler)
    const registered = globalShortcut.register(accelerator, handler)
    if (registered) {
      opts.logger.info('shortcut:registered', { accelerator })
    } else {
      opts.logger.warn('shortcut:register:failed', { accelerator })
    }
    return registered
  }

  register('CmdOrCtrl+Shift+P')

  // MANDATORY: unregister on quit — prevents leaked accelerators on some macOS versions
  app.on('will-quit', () => {
    try {
      globalShortcut.unregisterAll()
      opts.logger.info('shortcut:cleanup:will-quit', { count: handlers.size })
    } catch (err) {
      opts.logger.warn('shortcut:cleanup:failed', { message: String(err) })
    }
  })

  return {
    fireForTest(accelerator: string) {
      handlers.get(accelerator)?.()
    },
  }
}
```

## Test Pattern

```typescript
it('R-shortcut-01: shortcuts.ts unregisters in will-quit', () => {
  const src = readFileSync('src/shortcuts.ts', 'utf8')
  expect(src).toMatch(/app\.on\('will-quit'/)
  expect(src).toMatch(/globalShortcut\.unregisterAll\(\)/)
})
```

## Watch Out For

- `globalShortcut.register` returns `false` — no exception — if the accelerator is claimed by another app or system binding. Always check the return value.
- `globalShortcut.unregisterAll()` in `will-quit` is mandatory. On some macOS versions, an unclean shutdown leaves the accelerator reserved against the system event tap.
- Shortcuts are system-global: they fire even when your app is in the background. This is the expected behavior — if you want app-only shortcuts, use window-level key listeners instead.
- Playwright cannot trigger OS-level shortcuts. Use the `fireForTest` method (or a test IPC seam) for testing.

Evidence: `../../05_distillation/patterns/P-10-globalshortcut-register-and-will-quit-unregister.md`, `../../05_distillation/gotchas/G-17-globalshortcut-conflict-silent-failure.md`
