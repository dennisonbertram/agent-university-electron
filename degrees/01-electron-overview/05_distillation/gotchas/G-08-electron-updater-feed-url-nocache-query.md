# G-08 — `electron-updater` appends `?noCache=<token>` to feed-URL requests

**Severity**: medium
**Surface**: Auto-update (electron-updater), local fixture server
**Discovered in**: L5 BT-L5-6 GREEN (`04_logs/expectation-gap-ledger.md#entry-7`)

## Symptom

You stand up a local update server matching `req.url.endsWith('/latest-mac.yml')`. The `electron-updater` client requests something like `/updates/latest-mac.yml?noCache=1jor721v9` (random token per invocation). Your `endsWith` matcher fails, server returns 404, and `electron-updater` emits `updater:error` with a misleading "Cannot find channel 'latest-mac.yml' update info: HttpError: 404".

## Root cause

`electron-updater` appends a cache-busting query string to feed-URL requests to bypass HTTP caches on the path. The implementation is not documented prominently and the query parameter looks like noise. A reader debugging the 404 may suspect the manifest format or provider config.

## Fix

Strip the query string before path-matching in your dev/test update server:

```javascript
// scripts/local-update-server.mjs
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

createServer((req, res) => {
  const pathOnly = (req.url ?? '').split('?')[0]
  if (pathOnly.endsWith('/latest-mac.yml')) {
    res.writeHead(200, { 'Content-Type': 'text/yaml' })
    res.end(readFileSync('./fixtures/latest-mac.yml'))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(8765)
```

## Test that catches a regression

`tests/e2e/updater.spec.ts > BT-L5-6` (L5) — asserts `update-available` log marker fires for a newer-version manifest. If the path-matching breaks, the test fails with the misleading `updater:error` payload.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-7`
- `03_pocs/L5-packaging-signing-update/poc-report.md` Entry 7
- `03_pocs/L5-packaging-signing-update/scripts/local-update-server.mjs`
