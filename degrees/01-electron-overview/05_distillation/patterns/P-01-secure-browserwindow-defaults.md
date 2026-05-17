# P-01 — Secure BrowserWindow defaults via a single factory

**When to use**: every new BrowserWindow in an Electron app.
**Evidence**: L2 (`03_pocs/L2-secure-ipc/src/window.ts`), L4, L5, capstone — all use this verbatim.

## Pattern

```typescript
// src/window.ts
import { BrowserWindow } from 'electron'
import path from 'node:path'

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
} as const

export function createMainWindow(opts: { width?: number; height?: number } = {}): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.js')
  const indexHtml = path.join(__dirname, 'renderer', 'index.html')
  const win = new BrowserWindow({
    width: opts.width ?? 1024,
    height: opts.height ?? 768,
    show: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  })
  void win.loadFile(indexHtml)
  return win
}
```

Add a regression test that statically inspects `src/window.ts` for the literal `SECURE_WEB_PREFERENCES` constant and verifies all four flags are present at their canonical values.

## Why it works

- The factory becomes the only place a `new BrowserWindow(...)` lives. A grep-based regression test (`new BrowserWindow(` outside `src/window.ts`) catches anyone adding a window with custom (weaker) defaults.
- Spreading `SECURE_WEB_PREFERENCES` makes it impossible to forget one of the four flags.
- `as const` makes the values literal-typed; a typo in a call site fails to compile.

## Tradeoffs

- A second BrowserWindow with different webPreferences (e.g., a settings window with different prefs) must go through a separate factory that ALSO starts from `SECURE_WEB_PREFERENCES`.
- The `preload` path must be absolute; using `__dirname` makes the factory ESM-incompatible. The L2-capstone stack uses CommonJS via `tsc`, so this is fine.

## Variants

- **Per-window factory** (`createSettingsWindow`, `createPopover`) — each starts from `SECURE_WEB_PREFERENCES`.
- **`BaseWindow + WebContentsView`** (Electron 30+) — same `webPreferences` placement, different containing object.

## Evidence

- `03_pocs/L2-secure-ipc/src/window.ts`
- `03_pocs/L-capstone-pulse/src/window.ts:15-20`
- `03_pocs/L2-secure-ipc/poc-report.md` §5 invariant 2
- `01_research/05-security-model.md` lines 6-20
