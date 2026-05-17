# PB-01 — Debugging a white-screen Electron app

**Symptom**: Window opens but shows a blank page. Renderer doesn't render. No content.

## Decision tree

1. **Open DevTools** in the main process:
   ```typescript
   win.webContents.openDevTools({ mode: 'detach' })
   win.webContents.on('did-fail-load', (_e, code, desc) =>
     console.error(`Load failed: ${desc} (${code})`))
   ```

2. **Check the DevTools Console for CSP violations.** If you see "Refused to execute inline script because it violates the following Content Security Policy directive: ...", the renderer is being blocked. Remove `unsafe-inline` from script-src (or fix the inline script — see P-01 patterns).

3. **Check the DevTools Network tab for 404s.** If `index.html` references `renderer.js` and the bundler output is `renderer.bundle.js`, your `loadFile` URL is broken. Verify `path.join(__dirname, 'renderer/index.html')` resolves to the actual built file.

4. **Check the preload script logs.** If `window.api` is `undefined`, the preload crashed. Common causes:
   - Sandbox-preload tried to `require('./ipc')` (G-01). Look for silent abort with no error.
   - Preload threw synchronously. Wrap the entire preload in try/catch and `console.error` to surface it.

5. **Verify the bundler output exists.** `ls dist/renderer/index.html`. If missing, your `npm run build` didn't run.

6. **Check the main process log for `app:ready` but no `window:created`.** Means `whenReady().then(...)` ran but `new BrowserWindow(...)` threw or never executed.

7. **Check `did-fail-load` event.** If it fires with code -6 (`FILE_NOT_FOUND`), the renderer's loadFile path is wrong.

## Common root causes (in order of frequency)

| Cause | Fix |
| --- | --- |
| Sandboxed preload failed silently (G-01) | Bundle preload with esbuild or inline constants |
| `loadFile` path wrong | Use `path.join(__dirname, 'renderer/index.html')` and check `__dirname` post-build |
| CSP blocks inline script | Move inline `<script>` into a bundled file; remove `unsafe-inline` |
| Bundler didn't run | `npm run build` before `electron .` |
| Preload threw before contextBridge | Try/catch around all preload code; log to a file before `contextBridge.exposeInMainWorld` |

## Evidence

- `01_research/21-failure-modes.md#FM-01`
- `03_pocs/L1-hello-electron/poc-report.md` §"Risks" (the preload-sandbox debug took ~15min)
- `04_logs/expectation-gap-ledger.md#entry-1`
