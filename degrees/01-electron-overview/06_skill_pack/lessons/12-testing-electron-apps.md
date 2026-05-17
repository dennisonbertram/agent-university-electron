# Lesson 12 — Testing Electron Apps

**Prerequisites**: [11-crash-reporting-and-observability.md](./11-crash-reporting-and-observability.md)  
**Back to curriculum**: [../curriculum.md](../curriculum.md)

## Testing Strategy Overview

Electron apps need three testing layers:

| Layer | Tool | Scope | ABI |
|---|---|---|---|
| Unit (main logic) | Vitest | Handler contexts, validators, parsers | System Node |
| Behavioral/E2E | Playwright `_electron` | Full app boot, IPC, log markers | Electron |
| Static regression | Vitest (readFile) | Source-code invariants | System Node |

The two-ABI problem (system Node vs. Electron) means you need separate pretest scripts:
```json
{
  "scripts": {
    "pretest": "npm rebuild better-sqlite3 --build-from-source",
    "pretest:e2e": "electron-rebuild"
  }
}
```

## Playwright `_electron` Setup

```bash
npm install --save-dev @playwright/test
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,  // Electron tests share dist/ — no parallel
  workers: 1,
  reporter: 'list',
  use: { actionTimeout: 5000 },
  outputDir: './test-output',  // NOT test-results/ — Playwright wipes that (G-11)
})
```

## Launch Helper

```typescript
// tests/e2e/helpers.ts
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = path.join(__dirname, '..', '..')

export async function launchApp(opts: {
  env?: Record<string, string>
} = {}): Promise<{
  app: ElectronApplication
  window: Page
  logDir: string
  userDataDir: string
  readLogLines: () => Array<Record<string, unknown>>
}> {
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

## Behavioral Test Shape

```typescript
// tests/e2e/ping.spec.ts
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('BT-01: ping returns timestamp', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    const result = await window.evaluate(() => window.api.ping())
    expect(result).toHaveProperty('ts')
    expect(typeof result.ts).toBe('number')

    // Verify log marker
    await expect.poll(
      () => readLogLines().some(l => l.event === 'ipc:app:ping:served'),
      { timeout: 3000 }
    ).toBe(true)
  } finally {
    await app.close()
  }
})
```

Key patterns:
1. `window.evaluate()` runs code in the renderer (has access to `window.api`)
2. `readLogLines()` reads the structured log file
3. `expect.poll()` with timeout for async log markers
4. Always `app.close()` in `finally` — leaked Electron processes accumulate

## Test-Seam IPC Channels

For OS events that Playwright can't drive:

```typescript
// tests/e2e/power.spec.ts
test('BT-02: suspend/resume logs markers', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    // Drive powerMonitor.emit via test seam
    await window.evaluate(() => window.api.testEmitPower('suspend'))
    await expect.poll(
      () => readLogLines().some(l => l.event === 'power:suspend:observed'),
      { timeout: 3000 }
    ).toBe(true)

    await window.evaluate(() => window.api.testEmitPower('resume'))
    await expect.poll(
      () => readLogLines().some(l => l.event === 'power:resume:observed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally {
    await app.close()
  }
})
```

Test seam channels are gated by `NODE_ENV=test` in the IPC registry. See [lessons/03-ipc-patterns-and-validation.md](./03-ipc-patterns-and-validation.md).

## Static Regression Tests

Grep source files to enforce invariants:

```typescript
// tests/unit/regression.spec.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('static regression invariants', () => {
  it('R-01: tray.ts holds module-scope tray instance', () => {
    const src = readFileSync('src/tray.ts', 'utf8')
    expect(src).toMatch(/^let trayInstance/m)
  })

  it('R-02: shortcuts.ts unregisters in will-quit', () => {
    const src = readFileSync('src/shortcuts.ts', 'utf8')
    expect(src).toMatch(/app\.on\('will-quit'/)
    expect(src).toMatch(/globalShortcut\.unregisterAll\(\)/)
  })

  it('R-03: notification.show() preceded by failed listener', () => {
    const src = readFileSync('src/notifications.ts', 'utf8')
    expect(src).toMatch(/notification\.on\('failed'[\s\S]+?notification\.show\(\)/m)
  })

  it('R-04: SECURE_WEB_PREFERENCES has all four flags', () => {
    const src = readFileSync('src/window.ts', 'utf8')
    expect(src).toMatch(/contextIsolation:\s*true/)
    expect(src).toMatch(/sandbox:\s*true/)
    expect(src).toMatch(/nodeIntegration:\s*false/)
    expect(src).toMatch(/webSecurity:\s*true/)
  })

  it('R-05: no new BrowserWindow outside window.ts', () => {
    const main = readFileSync('src/main.ts', 'utf8')
    expect(main).not.toMatch(/new BrowserWindow\(/)
  })
})
```

Static regression tests are cheap (no process spawn) and catch refactoring accidents.

## Playwright Gotchas

**G-11**: Playwright wipes `test-results/` at the start of each run. If you redirect test stdout to a file, put it in `test-output/` instead.

**Parallel tests**: Do NOT set `fullyParallel: true`. Electron tests share `dist/main.js`. Parallel launches compete for the same compiled entry point. Use `workers: 1`.

**Electron devtools**: Pass `--no-sandbox` if you get sandbox permission errors on Linux:
```typescript
args: ['--no-sandbox', path.join(ROOT, 'dist/main.js')]
```

## Vitest for Unit Tests

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
  },
})
```

Unit tests run under system Node. They cannot load native modules rebuilt for Electron. Use IPC seam pattern for modules that need native deps.

## Test Env Variables

```
LOG_DIR=<tmp>           fresh log dir per test
USER_DATA_DIR=<tmp>     fresh userData per test
NODE_ENV=test           gates test:* IPC channels
TOUCH_ID_UNAVAILABLE=1  forces biometric off
TOUCH_ID_FORCE_AVAILABLE=1  forces biometric on
DIALOG_STUB=1           stubs file dialogs
```

## Key Takeaways

1. Use Playwright `_electron.launch` (not `chromium.launch`) for full Electron process tests.
2. `LOG_DIR` and `USER_DATA_DIR` env vars enable test isolation — fresh dirs per test.
3. Log markers are the assertion surface — `expect.poll(() => logLines.some(...))`.
4. Test-seam IPC channels let tests drive OS events that Playwright can't trigger.
5. Static regression tests (readFile + grep) are cheap and catch refactoring accidents.
6. `workers: 1` — Electron tests cannot run in parallel.
7. Never use `test-results/` for your own output files — Playwright wipes it.

Evidence: `../../05_distillation/playbooks/PB-06-testing-electron-app-with-playwright.md`, `../../05_distillation/patterns/P-07-test-seam-ipc-channels-gated-by-env.md`, `../../05_distillation/gotchas/G-11-playwright-wipes-test-results-dir.md`, `../../01_research/20-testing-strategies.md`
