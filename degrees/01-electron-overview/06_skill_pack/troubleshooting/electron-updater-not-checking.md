# Troubleshooting — electron-updater Not Checking for Updates

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

`autoUpdater.checkForUpdatesAndNotify()` is called but:
- No `checking-for-update` log marker fires
- No `update-available` or `update-not-available` fires
- The update server receives no request
- Or: update server receives request but returns 404

---

## Cause → Diagnostic → Fix

### Cause 1: `forceDevUpdateConfig` not set (G-10)

`electron-updater` refuses to run in development mode unless `forceDevUpdateConfig` is explicitly enabled. In production builds `app.isPackaged` is true and this is irrelevant, but in dev the property must be cast.

**Diagnostic**

```bash
grep -n 'forceDevUpdateConfig' src/updater.ts
```

If the line is absent, this is the cause.

**Fix**

```typescript
import { autoUpdater } from 'electron-updater'

// TypeScript: cast required because property is not in the public type
;(autoUpdater as any).forceDevUpdateConfig = true
```

Must be set BEFORE calling `checkForUpdatesAndNotify()`.

---

### Cause 2: `dev-app-update.yml` missing or malformed

When `forceDevUpdateConfig = true`, `electron-updater` looks for `dev-app-update.yml` in the project root.

**Diagnostic**

```bash
cat dev-app-update.yml
```

A minimal fixture file:
```yaml
provider: generic
url: http://localhost:8080
```

If the file is missing or has syntax errors, the updater silently exits.

**Fix**

Create `dev-app-update.yml` in the project root. Point `url` at your local update fixture server.

---

### Cause 3: Update fixture server returns 404 for `latest-mac.yml`

`electron-updater` fetches `<url>/latest-mac.yml` (macOS) or `<url>/latest.yml` (Windows). If the server doesn't serve this file, the updater logs `update-not-available` or throws.

**Diagnostic**

```bash
curl http://localhost:8080/latest-mac.yml
# Should return YAML content; 404 means file not found or server not running
```

**Fix**

Ensure the fixture file exists at the served path:

```yaml
# fixtures/latest-mac.yml
version: 9.9.9
files:
  - url: MyApp-9.9.9.dmg
    sha512: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==
    size: 100000000
path: MyApp-9.9.9.dmg
sha512: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==
releaseDate: '2025-01-01T00:00:00.000Z'
```

The `version` must be newer than the app's current `package.json` version to trigger `update-available`.

---

### Cause 4: Server does not strip `?noCache=<token>` query (G-08)

`electron-updater` appends `?noCache=<random>` to prevent HTTP caching. Some static file servers or CDNs return 404 when the query string doesn't match a known path.

**Diagnostic**

```bash
curl "http://localhost:8080/latest-mac.yml?noCache=abc123"
# Must return the YAML; 404 or error means the server rejects the query param
```

**Fix**

The server must strip the query and serve the file regardless:

```javascript
// local-update-server.mjs (Node.js)
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = http.createServer((req, res) => {
  // Strip query string: /latest-mac.yml?noCache=abc -> /latest-mac.yml
  const filePath = req.url?.split('?')[0] ?? '/'
  const fullPath = path.join(__dirname, 'fixtures', filePath)

  try {
    const content = fs.readFileSync(fullPath)
    res.writeHead(200)
    res.end(content)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
```

---

### Cause 5: All 6 updater events not logged

If the updater IS checking but you're missing events, you may not have all 6 event listeners attached.

**Diagnostic**

```bash
grep -n 'autoUpdater.on' src/updater.ts
# Should show: checking-for-update, update-available, update-not-available,
#              update-downloaded, error, download-progress
```

**Fix**

```typescript
const events = [
  'checking-for-update',
  'update-available',
  'update-not-available',
  'update-downloaded',
  'error',
  'download-progress',
] as const

for (const evt of events) {
  autoUpdater.on(evt, (info) => {
    logger.info({ event: `updater:${evt}`, info })
  })
}
```

---

### Cause 6: `installUpdater()` called after `app.quit()` / too late in lifecycle

If `installUpdater()` is called after the app has already received a quit signal, the check may be skipped.

**Fix**

Call `installUpdater()` inside `app.whenReady()`:

```typescript
app.whenReady().then(async () => {
  createMainWindow()
  installUpdater()   // after window is ready
})
```

---

## Quick Diagnostic Sequence

```bash
# 1. Confirm forceDevUpdateConfig is set
grep 'forceDevUpdateConfig' src/updater.ts

# 2. Confirm dev-app-update.yml exists
cat dev-app-update.yml

# 3. Start local update server and test
node local-update-server.mjs &
curl http://localhost:8080/latest-mac.yml
curl "http://localhost:8080/latest-mac.yml?noCache=test123"

# 4. Run app and watch logs
NODE_ENV=test npm start &
tail -f ~/Library/Logs/<your-app>/main.log | grep updater
```

---

## Related

- [../lessons/10-auto-update.md](../lessons/10-auto-update.md) — complete auto-update architecture
- [../recipes/recipe-electron-updater-generic-provider.md](../recipes/recipe-electron-updater-generic-provider.md) — full implementation
- [../labs/lab-09-electron-updater-local-fixture.md](../labs/lab-09-electron-updater-local-fixture.md) — hands-on exercise
- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md) — items 13–17

Evidence: `../../../05_distillation/playbooks/PB-07-electron-updater-not-checking.md`, `../../../05_distillation/patterns/P-12-electron-updater-with-generic-provider.md`
