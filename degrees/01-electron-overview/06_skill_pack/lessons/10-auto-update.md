# Lesson 10 — Auto-Update

**Prerequisites**: [09-code-signing-and-notarization.md](./09-code-signing-and-notarization.md)  
**Next**: [11-crash-reporting-and-observability.md](./11-crash-reporting-and-observability.md)

## electron-updater Overview

`electron-updater` (from electron-builder) handles checking for updates, downloading, and prompting to install. It supports multiple providers: GitHub Releases, S3, Generic HTTP, and others.

For self-hosted or internal apps, use the **generic provider** — it requires only an HTTP server serving a `latest-mac.yml` (or `latest.yml`) manifest.

```bash
npm install electron-updater
```

## The updater.ts Module

```typescript
// src/updater.ts
import { autoUpdater } from 'electron-updater'
import type { Logger } from './log'

export interface UpdaterService {
  checkForUpdates(): Promise<void>
  getState(): object
}

export function installUpdater(opts: {
  logger: Logger
  feedUrl: string
  currentVersion: string
}): UpdaterService {
  const { logger, feedUrl } = opts

  // REQUIRED in dev mode: bypass the !app.isPackaged short-circuit
  ;(autoUpdater as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true

  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })

  autoUpdater.on('checking-for-update', () =>
    logger.info('updater:checking', {}))
  autoUpdater.on('update-available', (info) =>
    logger.info('updater:update-available', { version: info.version }))
  autoUpdater.on('update-not-available', (info) =>
    logger.info('updater:update-not-available', { version: info.version }))
  autoUpdater.on('download-progress', (p) =>
    logger.info('updater:download-progress', { pct: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) =>
    logger.info('updater:update-downloaded', { version: info.version }))
  autoUpdater.on('error', (err) =>
    logger.error('updater:error', { message: err.message }))

  return {
    checkForUpdates: async () => { await autoUpdater.checkForUpdates() },
    getState: () => ({ feedUrl, currentVersion: opts.currentVersion }),
  }
}
```

## Two Critical Gotchas

**G-10 — forceDevUpdateConfig**:

`autoUpdater` short-circuits in unpackaged (`!app.isPackaged`) builds by default. Testing the update flow in dev requires:
```typescript
;(autoUpdater as { forceDevUpdateConfig: boolean }).forceDevUpdateConfig = true
```
The TypeScript typedef in electron-updater 6.8.3 doesn't expose this property, hence the cast.

**G-08 — ?noCache query string**:

`electron-updater` appends `?noCache=<random-token>` to EVERY feed URL request:
```
GET /updates/latest-mac.yml?noCache=1234567890
```

Your update server MUST strip this query string before path-matching, or every request returns 404:

```javascript
// server.mjs — CRITICAL: strip query before path matching
const pathOnly = (req.url ?? '').split('?')[0]
if (pathOnly.endsWith('/latest-mac.yml')) { /* serve it */ }
```

## Local Fixture Server (for Tests)

```javascript
// scripts/local-update-server.mjs
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const FIXTURE_DIR = process.env.UPDATE_FIXTURE_DIR ?? './scripts/fixtures'
const PORT = Number(process.env.UPDATE_PORT ?? 8765)

createServer((req, res) => {
  const pathOnly = (req.url ?? '').split('?')[0]
  if (pathOnly.endsWith('/latest-mac.yml')) {
    const file = path.join(FIXTURE_DIR, 'latest-mac.yml')
    if (!existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': 'text/yaml' })
    res.end(readFileSync(file))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, () => console.log(`Update fixture server on :${PORT}`))
```

## Fixture Manifest

```yaml
# scripts/fixtures/latest-mac.yml
version: 9.9.9
files:
  - url: MyApp-9.9.9-arm64.zip
    sha512: <sha512-of-zip>
    size: 1234
path: MyApp-9.9.9-arm64.zip
sha512: <same-sha512>
releaseDate: '2026-01-01T00:00:00.000Z'
```

For testing only `update-available` (not download), set version to anything > current and provide a dummy zip (or no zip — the download will fail, but that's after `update-available` fires).

## Playwright Test Pattern

```typescript
test('update-available fires for newer-version manifest', async () => {
  const server = createServer(...)  // start local fixture server
  const port = server.address().port
  const { app, window, readLogLines } = await launchApp({
    env: { UPDATE_URL: `http://127.0.0.1:${port}/updates` },
  })
  try {
    await window.evaluate(() => window.api.updaterCheck())
    await expect.poll(
      () => readLogLines().some(l => l.event === 'updater:update-available'),
      { timeout: 5000 }
    ).toBe(true)
  } finally {
    await app.close()
    server.close()
  }
})
```

## Provider Reference

| Provider | Use Case | Config |
|---|---|---|
| `generic` | Self-hosted HTTP, test fixtures | `{ provider: 'generic', url: 'http://...' }` |
| `github` | GitHub Releases | `{ provider: 'github', owner: '...', repo: '...' }` |
| `s3` | AWS S3 bucket | `{ provider: 's3', bucket: '...' }` |
| `spaces` | DigitalOcean Spaces | `{ provider: 'spaces', name: '...' }` |

## IPC Exposure

Expose updater control via IPC for renderer-triggered checks:

```typescript
// In IPC registry:
{
  channel: 'updater:check',
  validate: () => undefined,
  handler: async (_arg, ctx) => {
    await ctx.updater.checkForUpdates()
    return { ok: true }
  },
}
```

## Key Takeaways

1. `forceDevUpdateConfig = true` is required for testing in dev/unpackaged builds.
2. Strip `?noCache=<token>` from URLs on the server side — electron-updater always appends it.
3. Generic provider requires only HTTP — no cloud credentials for local testing.
4. Log all six updater events — tests grep for `updater:update-available`.
5. Use `UPDATE_URL` env var to point the updater at the fixture server.

Evidence: `../../05_distillation/patterns/P-12-electron-updater-with-generic-provider.md`, `../../05_distillation/playbooks/PB-09-wiring-electron-updater-with-local-fixture.md`, `../../05_distillation/gotchas/G-08-electron-updater-feed-url-nocache-query.md`, `../../05_distillation/gotchas/G-10-electron-updater-requires-forcedevupdateconfig.md`, `../../01_research/18-auto-update.md`
