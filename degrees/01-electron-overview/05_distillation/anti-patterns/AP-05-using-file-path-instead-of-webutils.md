# AP-05 — Using `file.path` instead of `webUtils.getPathForFile(file)` (post Electron 32)

**Severity**: medium (will break on Electron 32+)
**Surface**: Drag-and-drop in renderer.

## What this looks like

```typescript
// WRONG (Electron 32+)
const file = e.dataTransfer?.files[0]
const path = file?.path                  // ← undefined since Electron 32
window.api.openFile(path)
```

## Why this is wrong

- `File.path` was a nonstandard Electron-only property. It was removed in Electron 32 (evidence: `01_research/22-version-compatibility.md` lines 48-51).
- Existing code that reads `file.path` returns `undefined`, often without an early error — the failure surfaces deep inside the handler that tries to open the (undefined) path.

## Better approach

Use `webUtils.getPathForFile(file)` via preload:

```typescript
// src/preload.ts
import { contextBridge, webUtils } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  openFile: (path: string) => ipcRenderer.invoke('file:open', path),
})

// src/renderer/renderer.ts
const file = e.dataTransfer?.files[0]
if (file) {
  const path = window.api.getFilePath(file)
  await window.api.openFile(path)
}
```

## Test / lint that catches it

Static-source check on `src/renderer/`: grep for `\.path` accessor on `File` types; should be absent. The L3 regression test asserts the preload exposes `getFilePath`.

## Evidence

- `01_research/21-failure-modes.md#FM-15`
- `01_research/22-version-compatibility.md` lines 48-51
- `03_pocs/L3-storage-and-native-io/src/preload.ts`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Invariants" 1
