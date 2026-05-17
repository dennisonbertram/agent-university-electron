# P-08 — Programmatic event emission for tests (`powerMonitor.emit`, `app.emit`)

**When to use**: testing handler logic for OS events that cannot be driven from CI / Playwright.
**Evidence**: L4 BT-L4-5/6/7/12 (`03_pocs/L4-deep-macos-integration/poc-report.md`); capstone BT-C-2 (`03_pocs/L-capstone-pulse/poc-report.md`).

## Pattern

```typescript
// src/power.ts
import { powerMonitor } from 'electron'

export function installPowerService(opts: { logger: Logger; engine: FocusEngine | null }) {
  const onSuspend = () => {
    opts.logger.info('power:suspend:observed', {})
    opts.engine?.onPowerSuspend()
  }
  powerMonitor.on('suspend', onSuspend)
  // ... resume / lock-screen / unlock-screen

  return {
    fireForTest(event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen') {
      // Electron's powerMonitor IS an EventEmitter; emit() drives the handler chain.
      powerMonitor.emit(event)
    },
  }
}
```

```typescript
// src/main.ts — gated under testHooksEnabled()
{
  channel: 'test:emit-power-event',
  validate: validateTestEmitPower,
  handler: (arg, ctx) => {
    ctx.power.fireForTest(arg.event)
    return { ok: true }
  },
}
```

```typescript
// tests/e2e/power.spec.ts
test('BT-C-2: powerMonitor suspend pauses focus session', async ({ }) => {
  // ... start a focus session ...
  await app.evaluate(({ ipcMain }) => {
    // (or use the IPC seam to invoke 'test:emit-power-event')
  })
  await window.api.testEmitPower('suspend')
  expect(await window.api.focusState()).toMatchObject({ kind: 'paused' })
})
```

## Why it works

- `powerMonitor`, `app`, and most Electron event surfaces ARE Node EventEmitters. `.emit(...)` runs the same listener chain as a real OS event.
- Test driver and production code share the listener — no parallel branch.
- The seam is observable: every emit also logs (`power:suspend:observed`) so the test asserts on the log marker.

## Tradeoffs

- Skips OS-side error injection (e.g., a suspend that fails to deliver — does that even happen?). Acceptable for behavioral tests; insufficient for chaos testing.
- Some events emitted programmatically may not flow through the OS-level state changes (e.g., a fake `suspend` doesn't actually suspend the laptop). Document the simulation in the POC report.

## Variants

- **`app.emit('open-url', evt, url)`** — drives the deep-link handler chain.
- **`app.emit('second-instance', evt, argv, cwd)`** — drives the protocol-route-from-argv handler chain.
- **`app.emit('will-quit', evt)`** — drives the cleanup chain (R-L4-2 / R-C-7 globalShortcut.unregisterAll path).

## Evidence

- `02_planning/test-strategy.md` REF-01, REF-06
- `03_pocs/L4-deep-macos-integration/poc-report.md` §"Honest reporting of simulated paths"
- `03_pocs/L-capstone-pulse/src/main.ts:512-527` (4 emit-based test seams)
- `03_pocs/L-capstone-pulse/poc-report.md` §"What's exercised by what mechanism"
