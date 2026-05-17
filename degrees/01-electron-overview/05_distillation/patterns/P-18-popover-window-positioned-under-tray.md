# P-18 — Popover-style BrowserWindow under the Tray

**When to use**: menu-bar-only apps where the renderer is a popover, not a desktop window.
**Evidence**: capstone `window.ts` (`03_pocs/L-capstone-pulse/src/window.ts`).

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
  const width = opts.width ?? 420
  const height = opts.height ?? 520
  const preloadPath = path.join(__dirname, 'preload.js')
  const indexHtml = path.join(__dirname, 'renderer', 'index.html')

  const win = new BrowserWindow({
    width,
    height,
    show: true,                    // Playwright needs visible window for IPC
    frame: false,                  // Popover feel
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Production: alwaysOnTop: true, but disabled for Playwright focus stability.
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  })

  void win.loadFile(indexHtml)
  return win
}
```

Positioning under the tray (production polish, omitted in capstone Playwright tests):

```typescript
// On tray click:
tray.on('click', () => {
  const bounds = tray.getBounds()
  const win = createMainWindow()
  win.setBounds({
    x: Math.round(bounds.x + bounds.width / 2 - 210), // centered
    y: Math.round(bounds.y + bounds.height),
    width: 420,
    height: 520,
  })
  win.show()
})
```

## Why it works

- `frame: false` removes the OS chrome — the renderer's CSS provides the popover look.
- `resizable: false` + the disable flags lock the window to the popover affordance.
- `tray.getBounds()` returns the tray icon's screen coordinates on macOS/Windows; the popover positions itself below.
- `LSUIElement: true` in Info.plist (production) hides the Dock icon entirely; in dev, `app.dock.hide()` covers the same.

## Tradeoffs

- `alwaysOnTop: true` in production interferes with Playwright focus handling; disable for tests, enable for production builds.
- `tray.getBounds()` returns `{ x: 0, y: 0, width: 0, height: 0 }` on Linux — positioning fallback to screen center.
- Frameless windows need explicit close affordance in renderer CSS (a close `×` button) since the OS chrome isn't there.

## Variants

- **`BaseWindow + WebContentsView`** (Electron 30+) — same shape, different containing API. Useful when multiple WebContents share a window.

## Evidence

- `03_pocs/L-capstone-pulse/src/window.ts`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Honest deviations" 1
- `01_research/06-windowing-and-webcontents.md`
- `01_research/07-tray-and-menus.md` lines 74-79
