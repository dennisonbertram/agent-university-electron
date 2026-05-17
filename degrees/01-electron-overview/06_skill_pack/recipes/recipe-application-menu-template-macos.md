# Recipe — Application Menu Template (macOS)

**Use when**: Setting up the macOS application menu (the menu bar at the top of the screen, NOT the tray).

## Code

```typescript
// src/menu.ts
import { Menu, app, shell } from 'electron'
import type { BrowserWindow } from 'electron'

export function buildApplicationMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS: app menu (first item uses app name)
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const },
        ]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
```

## Notes for Menu-Bar-Only Apps

If your app is menu-bar-only with `LSUIElement: true`, you typically do NOT need an application menu. The tray provides the user-visible controls. Set:

```typescript
// For menu-bar-only apps, suppress the application menu entirely:
Menu.setApplicationMenu(null)
```

## Test Pattern

```typescript
it('R-menu-01: application menu is set after ready', async () => {
  const { app, readLogLines } = await launchApp()
  try {
    // The test verifies the app starts without crashing — menu setup is hard to introspect
    await expect.poll(
      () => readLogLines().some(l => l.event === 'app:ready'),
      { timeout: 5000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

## Watch Out For

- Call `Menu.setApplicationMenu(menu)` inside `app.whenReady()` — the menu is not available before the app is ready.
- On macOS, the first submenu label is always the app name (pulled from `CFBundleDisplayName`). The string you pass doesn't matter — macOS overrides it. Use `app.getName()` for clarity.
- `Menu.setApplicationMenu(null)` removes the menu entirely — on macOS this means no system-level Edit menu and cut/copy/paste shortcuts may stop working in the renderer. Only do this for menu-bar-only apps.
- `role` values are strings from Electron's built-in menu role set. Using built-in roles ensures correct keyboard shortcut binding on each platform.

Evidence: `../../01_research/07-tray-and-menus.md`
