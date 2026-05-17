# P-07 — Test-seam IPC channels gated by env var

**When to use**: real OS events (powerMonitor, notification action, second-instance, open-url, key event) cannot be driven from Playwright.
**Evidence**: L4 `test:*` channels (`03_pocs/L4-deep-macos-integration/src/main.ts`), capstone (`03_pocs/L-capstone-pulse/src/main.ts:503-533`).

## Pattern

```typescript
// src/ipc.ts
export const TEST_CHANNELS = {
  TEST_FIRE_SHORTCUT: 'test:fire-shortcut',
  TEST_EMIT_POWER: 'test:emit-power-event',
  TEST_TRIGGER_WILL_QUIT: 'test:trigger-will-quit',
  TEST_EMIT_OPEN_URL: 'test:emit-open-url',
  TEST_EMIT_SECOND_INSTANCE: 'test:emit-second-instance',
  TEST_GET_RAW_JOURNAL_ROWS: 'test:get-raw-journal-rows',
} as const

export function testHooksEnabled(): boolean {
  return process.env.NODE_ENV === 'test'
      || process.env.L4_TEST_HOOKS === '1'
      || process.env.PULSE_TEST_HOOKS === '1'
}

const TEST_REGISTRY: ReadonlyArray<RegistryEntry> = [
  {
    channel: TEST_CHANNELS.TEST_EMIT_POWER,
    validate: validateTestEmitPower,
    handler: (arg, ctx) => {
      // Drives powerMonitor.emit('suspend' | 'resume' | ...)
      ctx.power.fireForTest(arg.event)
      return { ok: true }
    },
  },
  // ...
]

export function registerIpc(ipcMain: IpcMain, ctx: HandlerContext): void {
  for (const entry of IPC_REGISTRY) { /* always */ }
  if (testHooksEnabled()) {
    for (const entry of TEST_REGISTRY) { /* gated */ }
  }
}
```

The preload exposes wrappers unconditionally so the renderer API surface is stable across test/non-test:

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('api', {
  // ...production methods...
  testFireShortcut: (accel: string) => ipcRenderer.invoke('test:fire-shortcut', { accelerator: accel }),
  testEmitPower: (event: string) => ipcRenderer.invoke('test:emit-power-event', { event }),
})
```

In a non-test build, calling `window.api.testFireShortcut(...)` rejects with `No handler registered for 'test:fire-shortcut'` — same shape as any other missing channel.

## Why it works

- **Same plumbing as production channels** — validator + handler + log marker. The seam is not a special-case code path.
- **Env-var gate is explicit** — accidentally activating in production requires literally setting `NODE_ENV=test` or a named flag.
- **Renderer surface is stable** — the preload exposes wrappers either way, so renderer code doesn't branch.
- **Programmatic simulation matches reality** — `app.emit('open-url', evt, url)` runs the same listener chain as a real OS event.

## Tradeoffs

- Production main.ts contains the test handlers in source, even if not registered. Capstone notes this in README "Test seams" section.
- A future agent who sets `NODE_ENV=test` in production by mistake would expose the seam. Mitigate with a build-time `__DEV__` define for the capstone's polished form.

## Variants

- **Separate "test main" entry** — doubles the build matrix; we rejected this.
- **`app.evaluate(...)` from Playwright** — couples the test to main's internal state shape; rejected.

## Evidence

- `04_logs/decision-log.md#decision-10`
- `04_logs/decision-log.md#decision-12`
- `03_pocs/L-capstone-pulse/src/main.ts:503-533`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Invariants" 6
- `02_planning/test-strategy.md` REF-01/06
