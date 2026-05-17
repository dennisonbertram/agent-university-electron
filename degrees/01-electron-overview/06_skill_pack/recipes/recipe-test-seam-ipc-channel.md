# Recipe — Test-Seam IPC Channel

**Use when**: Testing OS events (powerMonitor, open-url, second-instance, notification actions) that Playwright cannot trigger directly.

## Code

```typescript
// src/ipc.ts
export const TEST_CHANNELS = {
  TEST_EMIT_POWER: 'test:emit-power-event',
  TEST_EMIT_OPEN_URL: 'test:emit-open-url',
  TEST_FIRE_SHORTCUT: 'test:fire-shortcut',
  TEST_TRIGGER_WILL_QUIT: 'test:trigger-will-quit',
} as const

export function testHooksEnabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.MY_APP_TEST_HOOKS === '1'
}

const TEST_REGISTRY = [
  {
    channel: TEST_CHANNELS.TEST_EMIT_POWER,
    validate: (arg: unknown) => {
      const events = ['suspend', 'resume', 'lock-screen', 'unlock-screen']
      if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
      const a = arg as any
      if (!events.includes(a.event)) throw new IpcValidationError(`event must be one of: ${events.join(', ')}`)
      return { event: a.event as string }
    },
    handler: ({ event }: { event: string }, ctx: HandlerContext) => {
      ctx.power.fireForTest(event as any)
      return { ok: true }
    },
  },
  {
    channel: TEST_CHANNELS.TEST_EMIT_OPEN_URL,
    validate: (arg: unknown) => {
      if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
      const a = arg as any
      if (typeof a.url !== 'string') throw new IpcValidationError('url must be string')
      return { url: a.url as string }
    },
    handler: ({ url }: { url: string }, _ctx: HandlerContext) => {
      app.emit('open-url', new Event('open-url'), url)
      return { ok: true }
    },
  },
  {
    channel: TEST_CHANNELS.TEST_FIRE_SHORTCUT,
    validate: (arg: unknown) => {
      if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
      const a = arg as any
      if (typeof a.accelerator !== 'string') throw new IpcValidationError('accelerator must be string')
      return { accelerator: a.accelerator as string }
    },
    handler: ({ accelerator }: { accelerator: string }, ctx: HandlerContext) => {
      ctx.shortcuts.fireForTest(accelerator)
      return { ok: true }
    },
  },
]

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  // Always register production channels
  for (const entry of IPC_REGISTRY) {
    ipcMain.handle(entry.channel, /* ... */)
  }
  // Conditionally register test channels
  if (testHooksEnabled()) {
    for (const entry of TEST_REGISTRY) {
      ipcMain.handle(entry.channel, /* ... */)
    }
  }
}
```

Preload exposes test methods unconditionally (stable API surface):

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('api', {
  // Production methods...
  ping: () => ipcRenderer.invoke('app:ping'),
  // Test seams (always exposed in preload; gated in main)
  testEmitPower: (event: string) => ipcRenderer.invoke('test:emit-power-event', { event }),
  testEmitOpenUrl: (url: string) => ipcRenderer.invoke('test:emit-open-url', { url }),
  testFireShortcut: (accelerator: string) => ipcRenderer.invoke('test:fire-shortcut', { accelerator }),
})
```

## Test Pattern

```typescript
// Playwright: drive an OS event via test seam
test('BT-power-01: suspend logs marker', async () => {
  const { app, window, readLogLines } = await launchApp()  // NODE_ENV=test set by launchApp
  try {
    await window.evaluate(() => (window as any).api.testEmitPower('suspend'))
    await expect.poll(
      () => readLogLines().some(l => l.event === 'power:suspend:observed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})

// Verify channels are NOT accessible without test mode:
test('R-seam-01: test channels reject in production mode', async () => {
  const { app, window } = await launchApp({ env: { NODE_ENV: 'production' } })
  try {
    const err = await window.evaluate(() =>
      (window as any).api.testEmitPower('suspend').catch((e: Error) => e.message)
    )
    expect(err).toMatch(/No handler registered/)
  } finally { await app.close() }
})
```

## Watch Out For

- Test channels follow the SAME validator + handler pattern as production channels. They ARE production code — just conditionally registered.
- Preload exposes test methods unconditionally to keep the API surface stable. A call to a test method in non-test mode rejects with `No handler registered for 'test:...'` — same shape as any other missing channel.
- `testHooksEnabled()` checks BOTH `NODE_ENV === 'test'` AND a named flag env var. The named flag lets you activate test hooks without changing `NODE_ENV` (useful in hybrid scenarios).
- `app.emit('open-url', new Event('open-url'), url)` drives the real `open-url` listener — not a mock. The simulation IS the production path.

Evidence: `../../05_distillation/patterns/P-07-test-seam-ipc-channels-gated-by-env.md`, `../../05_distillation/patterns/P-08-programmatic-event-emission-for-test.md`
