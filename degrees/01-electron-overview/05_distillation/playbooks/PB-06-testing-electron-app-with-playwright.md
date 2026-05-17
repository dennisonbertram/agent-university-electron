# PB-06 — Testing an Electron app with `playwright._electron`

End-to-end testing recipe used throughout L1-L5 + capstone.

## Setup

```bash
npm install --save-dev @playwright/test
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Electron tests are serial — they share dist/main.js
  workers: 1,
  reporter: 'list',
  use: { actionTimeout: 5000 },
  // Capture stdout to a sibling dir — `test-results/` is wiped by Playwright (G-11)
  outputDir: './test-results',
})
```

## Launch helper

```typescript
// tests/e2e/helpers.ts
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = path.join(__dirname, '..', '..')

export async function launchApp(opts: { env?: Record<string, string> } = {}): Promise<{
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
      const path = `${logDir}/main.log`
      try {
        return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
      } catch {
        return []
      }
    },
  }
}
```

## Behavioral test shape

```typescript
// tests/e2e/journal.spec.ts
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('BT-C-5: deep-link log inserts encrypted row', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() => window.api.testEmitOpenUrl('pulse://log?text=hello'))
    // Wait for the marker
    await expect.poll(() => readLogLines().some(l => l.event === 'journal:append:1-row'))
      .toBe(true)
    const rows = await window.evaluate(() => window.api.testGetRawJournalRows())
    expect(rows).toHaveLength(1)
    expect(rows[0].ciphertextBase64).not.toBe(Buffer.from('hello').toString('base64'))
  } finally {
    await app.close()
  }
})
```

## Key principles

1. **Use `_electron.launch` (not `chromium.launch`).** This launches a real Electron process, not a Chromium browser.
2. **Pass env vars for test isolation.** `LOG_DIR`, `USER_DATA_DIR`, `NODE_ENV=test`, plus any feature-specific flags.
3. **Read log lines after each action.** The JSON-lines log is your assertion surface; every meaningful event emits a marker (see P-02).
4. **Use `expect.poll` for async observability.** Some markers appear after a tick; polling with a 2-3s window is forgiving.
5. **Gate test IPC channels under `NODE_ENV=test`** (see P-07). They're production code structurally; test mode just registers them.
6. **`fullyParallel: false`, `workers: 1`.** Electron tests share `dist/`; parallel runs collide. If you need parallel, copy `dist/` per worker.
7. **Capture output to `test-output/`, not `test-results/`** (G-11) — Playwright wipes the latter.

## Evidence

- `01_research/20-testing-strategies.md` lines 1-100
- `03_pocs/L1-hello-electron/tests/e2e/helpers.ts`
- `03_pocs/L-capstone-pulse/tests/e2e/journal.spec.ts`
- `04_logs/expectation-gap-ledger.md#entry-10`
