# Lab 04 — Tray with State

**Goal**: Build a tray icon that transitions between states (idle/active/paused) and verify via log markers.

**Prerequisites**: [lab-03-atomic-storage.md](./lab-03-atomic-storage.md), [lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md)

**Duration**: ~25 minutes

**POC Reference**: [examples/example-l4-macos-integration.md](../examples/example-l4-macos-integration.md)

## Goal

By the end, you should have:
- `src/tray.ts` with a module-scope `let trayInstance: Tray | null` (not function-local)
- State machine: `idle | active | paused`
- Log markers for each state transition
- A Playwright test that drives transitions via IPC and reads the log

## Steps

### 1. Create src/tray.ts

See [recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md) for the full recipe.

Key invariant:
```typescript
// src/tray.ts — LINE 1 or 2 (static regression test checks this)
let trayInstance: Tray | null = null  // MUST be module scope
let currentState: 'idle' | 'active' | 'paused' = 'idle'
```

For this lab, use a title string instead of template image (simpler):
```typescript
const STATE_TITLES = {
  idle: '●',
  active: '▶',
  paused: '⏸',
}

export function installTray(opts: { logger: Logger }): TrayController {
  // Use a 1x1 transparent PNG or any available image
  trayInstance = new Tray(nativeImage.createEmpty())
  trayInstance.setTitle(STATE_TITLES[currentState])
  trayInstance.setToolTip('Lab App')

  return {
    setState(next: 'idle' | 'active' | 'paused') {
      currentState = next
      trayInstance?.setTitle(STATE_TITLES[next])
      opts.logger.info('tray:state-changed', { state: next })
    },
    getState: () => currentState,
    destroy() { trayInstance?.destroy(); trayInstance = null },
  }
}
```

### 2. Add a test IPC channel for tray state

In `src/ipc.ts`, in the test registry (gated by `testHooksEnabled()`):
```typescript
{
  channel: 'test:set-tray-state',
  validate: (arg) => {
    const states = ['idle', 'active', 'paused']
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (!states.includes(a.state)) throw new IpcValidationError(`state must be one of ${states.join(', ')}`)
    return { state: a.state as 'idle' | 'active' | 'paused' }
  },
  handler: ({ state }, ctx) => {
    ctx.tray.setState(state)
    return { ok: true, state }
  },
},
```

### 3. Add static regression test

```typescript
it('R-tray-01: tray.ts has module-scope trayInstance', () => {
  const src = readFileSync('src/tray.ts', 'utf8')
  expect(src).toMatch(/^let trayInstance/m)
})
```

### 4. Playwright test

```typescript
test('BT-tray-01: tray state transitions log markers', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.testSetTrayState('active')
    )
    await expect.poll(
      () => readLogLines().some(l =>
        l.event === 'tray:state-changed' &&
        (l.payload as any)?.state === 'active'
      ),
      { timeout: 3000 }
    ).toBe(true)

    await window.evaluate(() =>
      (window as any).api.testSetTrayState('paused')
    )
    await expect.poll(
      () => readLogLines().some(l =>
        l.event === 'tray:state-changed' &&
        (l.payload as any)?.state === 'paused'
      ),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Verify

- `tray:installed` log marker fires on app start
- `tray:state-changed` fires with correct state on each transition
- Static regression test passes (module-scope `let trayInstance`)
- After running the test, Tray instance has not been GC'd (no crash, transitions work throughout)

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Tray disappears after a few seconds | `trayInstance` is function-local, GC'd | Move to module scope |
| `nativeImage.createEmpty()` shows no icon | Expected in lab — use template PNG for production | See recipe for asset path patterns |
| `tray:installed` never fires | `installTray` not called in `whenReady` | Check main.ts setup |

See [troubleshooting/tray-icon-disappears.md](../troubleshooting/tray-icon-disappears.md).

Evidence: [recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md), `../../05_distillation/patterns/P-05-module-scoped-tray-instance.md`
