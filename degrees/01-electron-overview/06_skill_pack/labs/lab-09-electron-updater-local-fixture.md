# Lab 09 — electron-updater with Local Fixture Server

**Goal**: Wire electron-updater and test update-available detection with a local HTTP fixture server.

**Prerequisites**: [lab-08-packaging-and-fuses.md](./lab-08-packaging-and-fuses.md), [lessons/10-auto-update.md](../lessons/10-auto-update.md)

**Duration**: ~30 minutes

**POC Reference**: [examples/example-l5-packaging.md](../examples/example-l5-packaging.md)

## Goal

By the end, you should have:
- `src/updater.ts` that wires electron-updater with the generic provider
- `scripts/local-update-server.mjs` that strips the `?noCache` query parameter
- A Playwright test that starts the fixture server and verifies `update-available` fires

## Steps

### 1. Install electron-updater

```bash
npm install electron-updater
```

### 2. Create src/updater.ts

See [recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md):

```typescript
import { autoUpdater } from 'electron-updater'

export function installUpdater(opts: { logger: Logger; feedUrl: string }) {
  // G-10: required for testing in unpackaged builds
  ;(autoUpdater as any).forceDevUpdateConfig = true
  autoUpdater.setFeedURL({ provider: 'generic', url: opts.feedUrl })

  autoUpdater.on('checking-for-update', () =>
    opts.logger.info('updater:checking', {}))
  autoUpdater.on('update-available', (info) =>
    opts.logger.info('updater:update-available', { version: info.version }))
  autoUpdater.on('update-not-available', (info) =>
    opts.logger.info('updater:update-not-available', { version: info.version }))
  autoUpdater.on('download-progress', (p) =>
    opts.logger.info('updater:download-progress', { pct: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) =>
    opts.logger.info('updater:update-downloaded', { version: info.version }))
  autoUpdater.on('error', (err) =>
    opts.logger.error('updater:error', { message: err.message }))

  return {
    checkForUpdates: async () => autoUpdater.checkForUpdates(),
  }
}
```

Read `UPDATE_URL` from env in main.ts:
```typescript
const feedUrl = process.env.UPDATE_URL ?? 'http://127.0.0.1:8765/updates'
const updater = installUpdater({ logger, feedUrl })
```

Add IPC channel:
```typescript
{
  channel: 'updater:check',
  validate: () => undefined,
  handler: async (_arg, ctx) => {
    await ctx.updater.checkForUpdates()
    return { ok: true }
  },
}
```

### 3. Create scripts/local-update-server.mjs

```javascript
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = process.env.UPDATE_FIXTURE_DIR ?? path.join(__dirname, 'fixtures')
const PORT = Number(process.env.UPDATE_PORT ?? 8765)

export function startUpdateServer(fixtureDir = FIXTURE_DIR) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // CRITICAL: strip ?noCache=<token> — G-08
      const pathOnly = (req.url ?? '').split('?')[0]
      if (pathOnly.endsWith('/latest-mac.yml')) {
        const file = path.join(fixtureDir, 'latest-mac.yml')
        if (!existsSync(file)) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { 'Content-Type': 'text/yaml' })
        res.end(readFileSync(file))
        return
      }
      res.writeHead(404); res.end()
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}
```

### 4. Create fixture manifest

`scripts/fixtures/latest-mac.yml`:
```yaml
version: 9.9.9
files:
  - url: MyApp-9.9.9-arm64.zip
    sha512: dummysha512forlabpurposesonly
    size: 1234
path: MyApp-9.9.9-arm64.zip
sha512: dummysha512forlabpurposesonly
releaseDate: '2026-01-01T00:00:00.000Z'
```

Current app version must be < 9.9.9 (set `"version": "0.0.1"` in package.json).

### 5. Playwright test

```typescript
// tests/e2e/updater.spec.ts
import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'
import { startUpdateServer } from '../../scripts/local-update-server.mjs'

test('BT-upd-01: update-available fires for newer version', async () => {
  const server = await startUpdateServer()
  const port = (server as any).address().port
  const { app, window, readLogLines } = await launchApp({
    env: { UPDATE_URL: `http://127.0.0.1:${port}/updates` }
  })
  try {
    await window.evaluate(() => (window as any).api.updaterCheck())
    await expect.poll(
      () => readLogLines().some(l => l.event === 'updater:update-available'),
      { timeout: 8000 }
    ).toBe(true)
  } finally {
    await app.close()
    server.close()
  }
})
```

## Verify

- `updater:checking` fires first
- `updater:update-available` fires with `version: "9.9.9"`
- Server logs show GET requests with `?noCache=...` stripped correctly

```bash
# Test server manually:
curl -v "http://127.0.0.1:8765/updates/latest-mac.yml?noCache=abc"
# Should return the YAML manifest
```

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `updater:update-not-available` fires | App version >= fixture version | Set `"version": "0.0.1"` in package.json |
| 404 from server | `?noCache` not stripped | Check path splitting in server |
| `forceDevUpdateConfig` TypeScript error | Type def doesn't expose property | Use `(autoUpdater as any).forceDevUpdateConfig = true` |
| `updater:error` fires | Network error or invalid manifest | Verify server is running, YAML is valid |

See [troubleshooting/electron-updater-not-checking.md](../troubleshooting/electron-updater-not-checking.md).

Evidence: [recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md), `../../05_distillation/patterns/P-12-electron-updater-with-generic-provider.md`
