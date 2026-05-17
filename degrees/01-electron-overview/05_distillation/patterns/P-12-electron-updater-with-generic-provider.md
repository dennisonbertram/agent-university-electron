# P-12 — `electron-updater` with `generic` provider + local fixture server

**When to use**: testing auto-update flow without a public release server.
**Evidence**: L5 BT-L5-6/7 (`03_pocs/L5-packaging-signing-update/src/updater.ts`, `scripts/local-update-server.mjs`).

## Pattern

```typescript
// src/updater.ts
import { autoUpdater } from 'electron-updater'
import type { Logger } from './log'

export function installUpdater(opts: { logger: Logger; feedUrl: string; currentVersion: string }) {
  const { logger, feedUrl } = opts

  // Required in dev mode — bypass the !app.isPackaged short-circuit.
  ;(autoUpdater as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true

  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })

  autoUpdater.on('checking-for-update', () => logger.info('updater:checking', {}))
  autoUpdater.on('update-available', (info) => logger.info('updater:update-available', { version: info.version }))
  autoUpdater.on('update-not-available', (info) => logger.info('updater:update-not-available', { version: info.version }))
  autoUpdater.on('download-progress', (p) => logger.info('updater:download-progress', { pct: p.percent }))
  autoUpdater.on('update-downloaded', (info) => logger.info('updater:update-downloaded', { version: info.version }))
  autoUpdater.on('error', (err) => logger.error('updater:error', { message: err.message }))

  return {
    checkForUpdates: async () => autoUpdater.checkForUpdates(),
    getState: () => ({
      lastEvent: lastEvent, version: lastVersion, currentVersion: opts.currentVersion,
      feedUrl, provider: 'generic',
    }),
  }
}
```

```javascript
// scripts/local-update-server.mjs
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

const FIXTURE_DIR = process.env.UPDATE_FIXTURE_DIR ?? './scripts/fixtures'

createServer((req, res) => {
  // CRITICAL: strip query string. electron-updater appends ?noCache=<token>.
  const pathOnly = (req.url ?? '').split('?')[0]
  if (pathOnly.endsWith('/latest-mac.yml')) {
    res.writeHead(200, { 'Content-Type': 'text/yaml' })
    res.end(readFileSync(`${FIXTURE_DIR}/latest-mac.yml`))
    return
  }
  // serve the .zip if requested
  res.writeHead(404)
  res.end()
}).listen(process.env.UPDATE_PORT ?? 8765)
```

```yaml
# scripts/fixtures/latest-mac.yml
version: 9.9.9
files:
  - url: app.zip
    sha512: ...
    size: 1234
path: app.zip
sha512: ...
releaseDate: '2026-05-17T00:00:00.000Z'
```

## Why it works

- `provider: 'generic'` requires only HTTP — no S3 / GitHub Releases / Squirrel.Mac scaffolding for tests.
- `forceDevUpdateConfig = true` bypasses the unpackaged-app short-circuit so Playwright can drive the flow.
- Stripping query string handles the `?noCache=<token>` cache-buster (G-08).
- `update-available` + `update-not-available` are observable via log markers — tests grep them.

## Tradeoffs

- `forceDevUpdateConfig` is a property of the autoUpdater singleton; the TypeScript typedef in electron-updater 6.8.3 doesn't expose it, so the cast `(autoUpdater as { forceDevUpdateConfig: boolean })` is required.
- The fixture server runs on a fixed port; multiple parallel test workers need port allocation.

## Variants

- **GitHub Releases provider** for production: `provider: 'github', owner: '...', repo: '...'`.
- **S3 provider** for private releases — `provider: 's3', bucket: '...'`.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-7`, `#entry-9`
- `03_pocs/L5-packaging-signing-update/src/updater.ts`
- `03_pocs/L5-packaging-signing-update/scripts/local-update-server.mjs`
- `03_pocs/L5-packaging-signing-update/poc-report.md` BT-L5-6, BT-L5-7
- `01_research/18-auto-update.md`
