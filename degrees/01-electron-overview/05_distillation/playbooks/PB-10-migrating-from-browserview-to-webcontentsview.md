# PB-10 — Migrating from `BrowserView` to `WebContentsView` (Electron 30+)

`BrowserView` was deprecated in Electron 30 in favor of `WebContentsView` inside a `BaseWindow`.

## Old API (deprecated)

```typescript
// DEPRECATED in Electron 30
import { BrowserWindow, BrowserView } from 'electron'

const win = new BrowserWindow({ width: 1024, height: 768 })
const view = new BrowserView({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    preload: '/path/to/preload.js',
  },
})
win.setBrowserView(view)
view.setBounds({ x: 0, y: 100, width: 1024, height: 668 })
view.webContents.loadFile('renderer/index.html')
```

## New API (Electron 30+)

```typescript
import { BaseWindow, WebContentsView } from 'electron'

const baseWin = new BaseWindow({ width: 1024, height: 768 })
const view = new WebContentsView({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    preload: '/path/to/preload.js',
  },
})
baseWin.contentView.addChildView(view)
view.setBounds({ x: 0, y: 100, width: 1024, height: 668 })
view.webContents.loadFile('renderer/index.html')
```

## Key differences

| Aspect | BrowserView | WebContentsView |
| --- | --- | --- |
| Container | `BrowserWindow` (carries its own webContents) | `BaseWindow` (no implicit webContents) |
| Attach method | `win.setBrowserView(view)` | `baseWin.contentView.addChildView(view)` |
| Multiple views | `win.addBrowserView(view2)` | `baseWin.contentView.addChildView(view2)` |
| Removal | `win.removeBrowserView(view)` | `baseWin.contentView.removeChildView(view)` |
| Reorder | `win.setTopBrowserView(view)` | `baseWin.contentView.addChildView(view, index)` |

## Migration steps

1. **Find all `new BrowserView(`** call sites and replace with `new WebContentsView(`.
2. **Find all `new BrowserWindow(` that host BrowserViews** and replace with `new BaseWindow(`. WARNING: if the window itself was loading content via `win.loadFile`, you've lost the implicit webContents — add a primary `WebContentsView` to host that content.
3. **Replace `setBrowserView` / `addBrowserView`** with `contentView.addChildView`.
4. **Replace `removeBrowserView`** with `contentView.removeChildView`.
5. **Update tests** that rely on `win.getBrowserViews()` — use `baseWin.contentView.children` instead.

## Gotchas

- A `BaseWindow` does NOT have its own webContents. If your old code used `win.webContents.send(...)`, you must now send to each `view.webContents` instead.
- Position is in CSS pixels in both APIs, but the parent-coordinate origin differs in edge cases (rare).
- IPC sender validation in main MUST check `event.sender` (or `event.senderFrame`) — the WebContentsView's webContents is a separate sender from the BaseWindow's.

## Evidence

- `01_research/22-version-compatibility.md` lines 48-51 (Electron 30 breaking)
- `01_research/21-failure-modes.md#FM-13`
- `01_research/06-windowing-and-webcontents.md`
