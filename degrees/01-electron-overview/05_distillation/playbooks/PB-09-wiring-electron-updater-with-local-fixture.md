# PB-09 — Wiring `electron-updater` with a local fixture server

For Playwright-driven tests of update flow without packaging or remote servers.

## Step 1 — Install

```bash
npm install electron-updater
```

## Step 2 — `src/updater.ts`

See P-12 for the full pattern. Key call shape:

```typescript
import { autoUpdater } from 'electron-updater'

;(autoUpdater as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true
autoUpdater.setFeedURL({ provider: 'generic', url: 'http://127.0.0.1:8765/updates' })

autoUpdater.on('update-available', (info) => logger.info('updater:update-available', { v: info.version }))
autoUpdater.on('update-not-available', (info) => logger.info('updater:update-not-available', { v: info.version }))
autoUpdater.on('error', (err) => logger.error('updater:error', { message: err.message }))
await autoUpdater.checkForUpdates()
```

The `forceDevUpdateConfig = true` cast bypasses the unpackaged-app short-circuit (G-10).

## Step 3 — `scripts/local-update-server.mjs`

```javascript
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const FIXTURE_DIR = process.env.UPDATE_FIXTURE_DIR ?? './scripts/fixtures'
const PORT = process.env.UPDATE_PORT ?? 8765

createServer((req, res) => {
  // CRITICAL: strip query string. electron-updater appends ?noCache=<token> (G-08).
  const pathOnly = (req.url ?? '').split('?')[0]

  if (pathOnly.endsWith('/latest-mac.yml')) {
    const file = path.join(FIXTURE_DIR, 'latest-mac.yml')
    if (!existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'text/yaml' })
    res.end(readFileSync(file))
    return
  }
  // Serve the .zip if requested
  if (pathOnly.endsWith('.zip')) {
    const zip = path.join(FIXTURE_DIR, path.basename(pathOnly))
    if (!existsSync(zip)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'application/zip' })
    res.end(readFileSync(zip))
    return
  }
  res.writeHead(404); res.end()
}).listen(PORT)
```

## Step 4 — Fixture manifest

`scripts/fixtures/latest-mac.yml`:

```yaml
version: 9.9.9
files:
  - url: app-9.9.9-arm64.zip
    sha512: <real-sha512-of-the-zip>
    size: 1234
path: app-9.9.9-arm64.zip
sha512: <same-sha512>
releaseDate: '2026-05-17T00:00:00.000Z'
```

## Step 5 — Playwright test

```typescript
// tests/e2e/updater.spec.ts
test('BT-L5-6: update-available fires for newer-version manifest', async () => {
  // Start fixture server in the test process
  const server = startUpdateServer({ fixtureDir: '...' })
  const port = server.address().port
  try {
    const { app, window, readLogLines } = await launchApp({
      env: { UPDATE_URL: `http://127.0.0.1:${port}/updates` },
    })
    await window.evaluate(() => window.api.updaterCheck())
    await expect.poll(() =>
      readLogLines().some(l => l.event === 'updater:update-available')
    ).toBe(true)
    await app.close()
  } finally {
    server.close()
  }
})
```

## Diagnostic snippets

```bash
# Test the server manually:
curl -v http://127.0.0.1:8765/updates/latest-mac.yml
curl -v "http://127.0.0.1:8765/updates/latest-mac.yml?noCache=abc"
```

Both should return the manifest.

## Evidence

- `01_research/18-auto-update.md`
- `03_pocs/L5-packaging-signing-update/src/updater.ts`
- `03_pocs/L5-packaging-signing-update/scripts/local-update-server.mjs`
- `04_logs/expectation-gap-ledger.md#entry-7`, `#entry-9`
