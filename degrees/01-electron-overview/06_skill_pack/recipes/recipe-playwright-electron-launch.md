# Recipe — Playwright Electron Launch

**Use when**: Writing end-to-end tests for an Electron app.

## Code

```typescript
// tests/e2e/helpers.ts
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = path.join(__dirname, '..', '..')  // project root

export interface LaunchResult {
  app: ElectronApplication
  window: Page
  logDir: string
  userDataDir: string
  readLogLines: () => Array<Record<string, unknown>>
}

export async function launchApp(opts: {
  env?: Record<string, string>
} = {}): Promise<LaunchResult> {
  const logDir = mkdtempSync(path.join(tmpdir(), 'electron-log-'))
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'electron-userdata-'))
  mkdirSync(logDir, { recursive: true })

  const app = await _electron.launch({
    args: [path.join(ROOT, 'dist', 'main.js')],
    env: {
      ...process.env,
      LOG_DIR: logDir,
      USER_DATA_DIR: userDataDir,
      NODE_ENV: 'test',
      ...(opts.env ?? {}),
    },
  })

  const window = await app.firstWindow()

  return {
    app,
    window,
    logDir,
    userDataDir,
    readLogLines: () => {
      const logPath = path.join(logDir, 'main.log')
      try {
        return readFileSync(logPath, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(l => JSON.parse(l))
      } catch { return [] }
    },
  }
}
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,   // Electron tests share dist/ — no parallel
  workers: 1,
  reporter: 'list',
  use: { actionTimeout: 5000 },
  outputDir: './test-output', // NOT test-results/ — Playwright wipes that (G-11)
})
```

## Test Shape

```typescript
// tests/e2e/feature.spec.ts
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('BT-01: feature does something', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    // 1. Trigger action via window.api
    const result = await window.evaluate(() => (window as any).api.someMethod('arg'))
    expect(result).toEqual({ ok: true })

    // 2. Assert log marker
    await expect.poll(
      () => readLogLines().some(l => l.event === 'feature:done'),
      { timeout: 5000 }
    ).toBe(true)
  } finally {
    // Always close — leaked processes accumulate
    await app.close()
  }
})
```

## Test Pattern for Multiple Tests with Shared App

```typescript
// If multiple tests can share one app instance:
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'
import type { LaunchResult } from './helpers'

let ctx: LaunchResult

test.beforeAll(async () => {
  ctx = await launchApp()
})
test.afterAll(async () => {
  await ctx.app.close()
})

test('BT-01: first assertion', async () => {
  const result = await ctx.window.evaluate(() => (window as any).api.ping())
  expect(result.ts).toBeGreaterThan(0)
})
```

## Watch Out For

- `_electron.launch` (from `@playwright/test`) is NOT the same as `electron.launch`. Use the underscore-prefixed version.
- `fullyParallel: false` + `workers: 1` is mandatory — Electron tests share `dist/main.js` and cannot run in parallel without worker-level isolation.
- `test-results/` is wiped by Playwright at the start of each run (G-11). Never write your own test output there.
- `app.firstWindow()` blocks until a window opens. If the app has no visible window, it may time out. Ensure `show: true` is set in the BrowserWindow options during tests.
- Always `await app.close()` in a `finally` block — leaked Electron processes cause subsequent tests to fail.

Evidence: `../../05_distillation/playbooks/PB-06-testing-electron-app-with-playwright.md`, `../../05_distillation/gotchas/G-11-playwright-wipes-test-results-dir.md`
