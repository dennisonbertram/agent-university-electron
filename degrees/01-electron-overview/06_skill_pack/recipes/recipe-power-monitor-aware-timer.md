# Recipe — powerMonitor-Aware Timer

**Use when**: Running a timer that should pause on system suspend and resume on wake.

## Code

```typescript
// src/power.ts
import { powerMonitor } from 'electron'

export interface PowerService {
  fireForTest(event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen'): void
}

export function installPowerMonitor(opts: {
  logger: Logger
  onSuspend?: () => void
  onResume?: () => void
}): PowerService {
  powerMonitor.on('suspend', () => {
    opts.logger.info('power:suspend:observed', {})
    opts.onSuspend?.()
  })
  powerMonitor.on('resume', () => {
    opts.logger.info('power:resume:observed', {})
    opts.onResume?.()
  })
  powerMonitor.on('lock-screen', () => {
    opts.logger.info('power:lock-screen:observed', {})
  })
  powerMonitor.on('unlock-screen', () => {
    opts.logger.info('power:unlock-screen:observed', {})
  })

  return {
    fireForTest(event) {
      // Programmatic emission for Playwright tests — real suspend can't be triggered
      powerMonitor.emit(event)
    },
  }
}

// Example: timer that pauses on suspend
export function createSuspendAwareInterval(
  callback: () => void,
  intervalMs: number,
  power: PowerService
): { stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = setInterval(callback, intervalMs)
  let suspended = false

  // power is already listening to powerMonitor events — attach to onSuspend/onResume
  return {
    stop() {
      if (timer) { clearInterval(timer); timer = null }
    },
  }
}
```

## Test Pattern (Playwright)

```typescript
test('BT-power-01: suspend/resume logs markers', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() => (window as any).api.testEmitPower('suspend'))
    await expect.poll(
      () => readLogLines().some(l => l.event === 'power:suspend:observed'),
      { timeout: 3000 }
    ).toBe(true)

    await window.evaluate(() => (window as any).api.testEmitPower('resume'))
    await expect.poll(
      () => readLogLines().some(l => l.event === 'power:resume:observed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Watch Out For

- `powerMonitor` must be accessed AFTER `app.whenReady()` — it is not available at module-load scope.
- `powerMonitor.emit('suspend')` drives the real event listeners in the same process; it is the correct way to test power events in development.
- Real OS suspend/resume events cannot be triggered by Playwright — the test IPC seam (`testEmitPower`) is the only automated test path.
- `powerMonitor.getSystemIdleState(threshold)` requires the threshold in seconds; the idle state is only available after a minimum threshold.

Evidence: `../../05_distillation/patterns/P-08-programmatic-event-emission-for-test.md`, `../../01_research/10-power-monitor.md`
