# AP-01 — `nodeIntegration: true` in the renderer

**Severity**: critical (security)
**Surface**: BrowserWindow webPreferences.

## What this looks like

```typescript
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,        // ← WRONG
    contextIsolation: false,       // ← often paired with this
  },
})
```

## Why this is wrong

- Renderer is a Chromium tab. Granting it `require()` access gives any XSS payload full Node.js: `child_process.execSync`, `fs.unlinkSync('~/.ssh/id_rsa')`, etc.
- `nodeIntegration: false` has been the default since Electron 5; flipping it back is a documented security regression (evidence: `01_research/05-security-model.md` lines 217-220).
- Any remote content loaded into such a renderer can compromise the user's machine.

## Better approach

Keep `nodeIntegration: false` (the default) and use the IPC + contextBridge pattern. Expose narrow, purpose-built functions via preload (see P-01, P-02):

```typescript
// preload — exposes narrow surface
contextBridge.exposeInMainWorld('api', {
  readJournal: () => ipcRenderer.invoke('journal:list'),
})
```

## Test / lint that catches it

Static-source check across all BrowserWindow construction sites: grep for `nodeIntegration` and assert the literal `false` follows (or the flag is absent so the default applies). Add to your regression test suite.

## Evidence

- `01_research/05-security-model.md` lines 217-220
- `01_research/02-three-process-model.md` lines 86-95
- `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 2
