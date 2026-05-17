# G-16 — `File.path` removed in Electron 32

**Severity**: medium
**Surface**: Drag-and-drop, renderer file access
**Discovered in**: Research review (`01_research/21-failure-modes.md#FM-15`)

## Symptom

Renderer code accessing `file.path` on a dropped File object throws `TypeError: Cannot read properties of undefined (reading 'path')`. Code that worked on Electron 31 breaks on Electron 32+.

## Root cause

`File.path` was a nonstandard Electron-only property exposing the OS path of a File the user dropped on the renderer. It was removed in Electron 32 in favor of the explicit `webUtils.getPathForFile(file)` API.

## Fix

Expose `webUtils.getPathForFile` via preload:

```typescript
// src/preload.ts
import { contextBridge, webUtils } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  // ... other methods
})
```

```typescript
// src/renderer/renderer.ts
dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file) {
    const path = window.api.getFilePath(file)
    window.api.openFile(path)
  }
})
```

## Test that catches a regression

`tests/e2e/drag-drop.spec.ts` (L3) — asserts the drop handler receives an absolute path and a `dragdrop:received` log marker fires. Without `webUtils.getPathForFile` the test fails.

## Evidence

- `01_research/21-failure-modes.md#FM-15`
- `01_research/22-version-compatibility.md` lines 48-51
- `03_pocs/L3-storage-and-native-io/src/preload.ts`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Invariants" 1
