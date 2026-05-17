# Lab 06 — Global Shortcut

**Goal**: Register a global shortcut, log when it fires, and unregister it in will-quit.

**Prerequisites**: [lab-04-tray-with-state.md](./lab-04-tray-with-state.md), [lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md)

**Duration**: ~20 minutes

**POC Reference**: [examples/example-l4-macos-integration.md](../examples/example-l4-macos-integration.md)

## Goal

By the end, you should have:
- `src/shortcuts.ts` that registers a shortcut and unregisters in `will-quit`
- A test IPC seam that fires the shortcut handler programmatically
- Log markers for registration, firing, and cleanup

## Steps

### 1. Create src/shortcuts.ts

See [recipes/recipe-global-shortcut-with-cleanup.md](../recipes/recipe-global-shortcut-with-cleanup.md):

```typescript
import { app, globalShortcut } from 'electron'

export function installShortcuts(opts: {
  logger: Logger
  onFire?: (accelerator: string) => void
}): ShortcutController {
  const { logger } = opts

  const register = (accelerator: string) => {
    const registered = globalShortcut.register(accelerator, () => {
      logger.info(`shortcut:${accelerator}:fired`, { accelerator })
      opts.onFire?.(accelerator)
    })
    if (registered) {
      logger.info('shortcut:registered', { accelerator })
    } else {
      logger.warn('shortcut:register:failed', { accelerator })
    }
    return registered
  }

  register('CmdOrCtrl+Shift+P')

  // MANDATORY: will-quit cleanup
  app.on('will-quit', () => {
    try {
      globalShortcut.unregisterAll()
      logger.info('shortcut:cleanup:will-quit', {})
    } catch (err) {
      logger.warn('shortcut:cleanup:failed', { message: String(err) })
    }
  })

  return {
    fireForTest: (accelerator: string) => {
      opts.onFire?.(accelerator)
      logger.info(`shortcut:${accelerator}:fired`, { accelerator, source: 'test' })
    },
  }
}
```

### 2. Add test IPC seam

```typescript
// In TEST_REGISTRY (gated by testHooksEnabled()):
{
  channel: 'test:fire-shortcut',
  validate: (arg) => {
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (typeof a.accelerator !== 'string') throw new IpcValidationError('accelerator must be string')
    return { accelerator: a.accelerator as string }
  },
  handler: ({ accelerator }, ctx) => {
    ctx.shortcuts.fireForTest(accelerator)
    return { ok: true }
  },
}
```

### 3. Static regression test

```typescript
it('R-shortcut-01: shortcuts.ts unregisters in will-quit', () => {
  const src = readFileSync('src/shortcuts.ts', 'utf8')
  expect(src).toMatch(/app\.on\('will-quit'/)
  expect(src).toMatch(/globalShortcut\.unregisterAll\(\)/)
})
```

### 4. Playwright test

```typescript
test('BT-shortcut-01: fire shortcut logs marker', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.testFireShortcut('CmdOrCtrl+Shift+P')
    )
    await expect.poll(
      () => readLogLines().some(l =>
        l.event === 'shortcut:CmdOrCtrl+Shift+P:fired'
      ),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})

test('BT-shortcut-02: will-quit cleanup fires', async () => {
  const { app, window, readLogLines } = await launchApp()
  await app.close()
  const lines = readLogLines()
  expect(lines.some(l => l.event === 'shortcut:cleanup:will-quit')).toBe(true)
})
```

## Verify

- `shortcut:registered` log marker fires on startup
- `shortcut:CmdOrCtrl+Shift+P:fired` fires when test seam is called
- `shortcut:cleanup:will-quit` fires when app closes
- Static regression test passes

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `shortcut:register:failed` on startup | Accelerator already claimed by another app | Try a different key combo |
| Shortcuts persist after app restart | `will-quit` handler not attached | Check static regression test |
| Test fires but real keyboard doesn't | Expected for Playwright — real keyboard input can't be sent to OS-level shortcuts | Test seam is the correct approach |

Evidence: [recipes/recipe-global-shortcut-with-cleanup.md](../recipes/recipe-global-shortcut-with-cleanup.md), `../../05_distillation/patterns/P-10-globalshortcut-register-and-will-quit-unregister.md`
