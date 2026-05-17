# Troubleshooting — White / Blank Screen on Launch

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

`BrowserWindow` opens but shows a blank white page. DevTools console may or may not show errors depending on where the failure is.

---

## Cause → Diagnostic → Fix

### Cause 1: `loadFile` path is wrong

**Diagnostic**

```bash
# Check what path is passed to loadFile
grep -n 'loadFile\|loadURL' src/window.ts
```

In development, the path must be relative to the project root. In a packaged build, the path must be relative to `process.resourcesPath`.

**Fix**

```typescript
// Correct pattern: always resolve from __dirname
const indexPath = path.join(__dirname, '../renderer/index.html')
win.loadFile(indexPath)
```

If the file doesn't exist at that path, `loadFile` silently loads a blank page in older Electron versions (42+ logs a `did-fail-load` event).

Listen for the event to catch it:
```typescript
win.webContents.on('did-fail-load', (_e, code, desc, url) => {
  logger.error({ event: 'window:load-failed', code, desc, url })
})
```

---

### Cause 2: Content Security Policy blocks the JS entry point

**Diagnostic**

Open DevTools → Console. Look for:
```
Refused to execute inline script because it violates the following Content Security Policy directive...
```

**Fix**

The `index.html` CSP meta tag must allow the bundled JS:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```

`unsafe-inline` on `script-src` is NOT permitted in secure apps. If you see that in your CSP, the inline script must become an external `<script src="renderer.js">`.

---

### Cause 3: `nodeIntegration: true` with `contextIsolation: true` (G-02 ambient type mismatch)

**Diagnostic**

Open DevTools console. Run:
```javascript
window.require  // should be undefined in a properly sandboxed window
```

If `nodeIntegration: true` and `contextIsolation: true` are both set, the renderer can crash silently because the preload runs in one context and `window.require` is undefined when the renderer runs.

**Fix**

Use `SECURE_WEB_PREFERENCES` — never enable `nodeIntegration`:
```typescript
const SECURE_WEB_PREFERENCES: Electron.WebPreferences = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  preload: path.join(__dirname, 'preload.js'),
}
```

---

### Cause 4: Preload script not built or wrong path

**Diagnostic**

```bash
# Check preload path resolves
ls dist/preload.js   # Must exist after build
```

Check the `webPreferences.preload` value in your `createMainWindow()`. If it points to `src/preload.ts` instead of `dist/preload.js`, Electron will silently fail to load the preload (cannot run TypeScript directly).

**Fix**

```bash
# Build preload separately (esbuild recommended)
npx esbuild src/preload.ts --bundle --platform=node --outfile=dist/preload.js --external:electron
```

Add to `package.json` scripts:
```json
"build:preload": "esbuild src/preload.ts --bundle --platform=node --outfile=dist/preload.js --external:electron"
```

---

### Cause 5: Renderer entry file not bundled

**Diagnostic**

Open DevTools → Network. See if `renderer.js` returns 404.

**Fix**

The renderer must be bundled before launch:
```bash
npx esbuild src/renderer.ts --bundle --platform=browser --outfile=dist/renderer/renderer.js
```

---

### Cause 6: `webSecurity: false` was set then removed (stale DevTools cache)

If you previously loaded remote content and then locked down to `webSecurity: true`, cached resources may cause a mismatch.

**Fix**

Delete the Electron app's user data directory:
```bash
rm -rf ~/Library/Application\ Support/<your-app-name>/
```

---

## Quick Verification Sequence

```bash
# 1. Confirm dist files exist
ls dist/main.js dist/preload.js dist/renderer/index.html

# 2. Run dev and watch console
npm start 2>&1 | grep -E 'error|failed|load'

# 3. Open DevTools programmatically if window is blank
win.webContents.openDevTools()
```

---

## Related

- [../recipes/recipe-secure-window.md](../recipes/recipe-secure-window.md) — secure BrowserWindow factory
- [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md) — CSP, navigation guards, sandbox
- [../quickstart.md](../quickstart.md) — step-by-step minimal app creation

Evidence: `../../../05_distillation/playbooks/PB-01-debugging-white-screen.md`
