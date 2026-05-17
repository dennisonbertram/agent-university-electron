# Recipe — electron-updater with Generic Provider

**Use when**: Implementing auto-update with a self-hosted HTTP server.

## Code

```typescript
// src/updater.ts
import { autoUpdater } from 'electron-updater'

export interface UpdaterService {
  checkForUpdates(): Promise<void>
}

export function installUpdater(opts: {
  logger: Logger
  feedUrl: string
}): UpdaterService {
  // REQUIRED for testing in unpackaged builds (G-10)
  // The TypeScript typedef doesn't expose this property — cast required
  ;(autoUpdater as unknown as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true

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
    checkForUpdates: async () => { await autoUpdater.checkForUpdates() },
  }
}
```

```javascript
// scripts/local-update-server.mjs — fixture server for testing
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const FIXTURE_DIR = process.env.UPDATE_FIXTURE_DIR ?? './scripts/fixtures'

export function startUpdateServer(fixtureDir = FIXTURE_DIR, port = 0) {
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
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
```

## Fixture Manifest

```yaml
# scripts/fixtures/latest-mac.yml
version: 9.9.9
files:
  - url: MyApp-9.9.9-arm64.zip
    sha512: dummyvalue
    size: 1234
path: MyApp-9.9.9-arm64.zip
sha512: dummyvalue
releaseDate: '2026-01-01T00:00:00.000Z'
```

App `package.json` version must be < `9.9.9` for `update-available` to fire.

## Test Pattern

```typescript
test('updater:update-available fires for newer version', async () => {
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

## Watch Out For

- `forceDevUpdateConfig = true` is mandatory for testing in unpackaged builds. Without it, `checkForUpdates()` returns immediately with no events.
- The fixture server MUST strip `?noCache=<token>` from requests — electron-updater appends it to every URL (G-08).
- Use `port = 0` in tests (OS assigns a free port) to avoid conflicts with parallel tests.
- `update-downloaded` fires only if the app actually downloads the update. For testing `update-available` only, you don't need a real ZIP file in the fixture directory.

Evidence: `../../05_distillation/patterns/P-12-electron-updater-with-generic-provider.md`, `../../05_distillation/gotchas/G-08-electron-updater-feed-url-nocache-query.md`, `../../05_distillation/gotchas/G-10-electron-updater-requires-forcedevupdateconfig.md`
