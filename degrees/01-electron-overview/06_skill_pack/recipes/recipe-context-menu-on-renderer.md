# Recipe — Context Menu on Renderer Right-Click

**Use when**: Showing a custom context menu when the user right-clicks in the renderer.

## Code

```typescript
// src/main.ts (or a dedicated contextmenu.ts)
import { Menu, MenuItem, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'

export function installContextMenu(win: BrowserWindow, logger: Logger): void {
  // Method 1: Handle via IPC from renderer
  ipcMain.on('show-context-menu', (event) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Copy',
        role: 'copy',
      },
      {
        label: 'Paste',
        role: 'paste',
      },
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => {
          win.webContents.inspectElement(0, 0)
        },
        visible: process.env.NODE_ENV === 'development',
      },
    ])
    menu.popup({ window: win })
    logger.info('context-menu:shown', {})
  })
}
```

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('api', {
  // ...other methods...
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
})
```

```typescript
// src/renderer/renderer.ts
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  window.api.showContextMenu()
})
```

## Alternative: Tray Context Menu

For tray context menus (different from renderer context menus):

```typescript
// src/tray.ts
import { Menu } from 'electron'

const menu = Menu.buildFromTemplate([
  { label: 'Open', click: () => win.show() },
  { label: 'Settings', click: () => openSettings() },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() },
])
trayInstance.setContextMenu(menu)
```

## Test Pattern

```typescript
test('BT-contextmenu-01: context menu IPC does not throw', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() => (window as any).api.showContextMenu())
    await expect.poll(
      () => readLogLines().some(l => l.event === 'context-menu:shown'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Watch Out For

- `ipcMain.on` (not `ipcMain.handle`) is appropriate here since showing a menu is fire-and-forget — no response needed.
- `menu.popup()` is non-blocking and returns immediately. The menu interaction happens asynchronously.
- Tray context menus (`tray.setContextMenu(menu)`) are separate from renderer right-click menus. The tray menu updates must rebuild and re-set the entire menu object — it's not live-updated.
- The `Inspect Element` item should only be visible in development (`process.env.NODE_ENV === 'development'`).

Evidence: `../../01_research/07-tray-and-menus.md`
