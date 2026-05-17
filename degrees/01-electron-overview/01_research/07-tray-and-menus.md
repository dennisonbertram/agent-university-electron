# Tray and Menus — Electron

Version: Electron 42.1.0 [S6, S24]

## Tray API

### Constructor

```typescript
import { Tray, nativeImage } from 'electron'
import path from 'node:path'

// CRITICAL: Assign to module-level variable, never a local variable
// Local variable → garbage collected → tray disappears silently
let tray: Tray | null = null

function createTray(): void {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'assets/trayTemplate.png')
  )
  tray = new Tray(icon)
  tray.setToolTip('My App')
}
```

GC GOTCHA: If you declare `const tray = new Tray(...)` inside a function with no outer reference, it WILL be garbage collected and disappear within seconds. Always hold in outer scope. [S6]

### Template Image Rules (macOS)

Template images are the correct format for macOS status bar icons. macOS automatically handles light/dark mode inversion.

Rules [S6]:
1. Filename MUST end in `Template` (e.g., `trayTemplate.png`, `trayTemplate@2x.png`)
2. Bundlers (webpack, vite) may hash/rename filenames — configure to preserve Template suffix
3. Recommended sizes: **16×16 @ 72dpi** and **32×32 @ 144dpi** (for @2x)
4. @2x images MUST be 144dpi or they appear grainy on Retina
5. Images should be monochrome (black + alpha) — macOS composites the color

```
assets/
  trayTemplate.png      (16×16 @ 72dpi)
  trayTemplate@2x.png   (32×32 @ 144dpi)
```

In Vite config, add assets directory to static copy (no hashing):
```typescript
// vite.main.config.ts
import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
})
```

### Key Methods

```typescript
// macOS title in status bar (text next to icon)
tray.setTitle('Focus 23:45', { fontType: 'monospacedDigit' })
// fontType options: 'monospaced' | 'monospacedDigit' | undefined

tray.getTitle() // returns current title

tray.setToolTip('My App — Click to open')

tray.setImage(nativeImage.createFromPath('newIcon.png'))

// macOS: image shown when icon is pressed/highlighted
tray.setPressedImage(nativeImage.createFromPath('pressedIcon.png'))

// Returns bounding rect of tray icon (macOS/Windows only)
const bounds = tray.getBounds() // { x, y, width, height }

// Windows: suppress double-click event so every click fires
tray.setIgnoreDoubleClickEvents(true) // macOS
```

### Context Menu

```typescript
import { Menu, MenuItem } from 'electron'

function setTrayMenu(tray: Tray): void {
  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Status',
      submenu: [
        { label: 'Focus Mode', type: 'radio', checked: isActive },
        { label: 'Idle', type: 'radio', checked: !isActive },
      ],
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit(), role: 'quit' },
  ])
  tray.setContextMenu(menu)
}
```

LINUX GOTCHA: After modifying individual `MenuItem` properties (e.g., `menu.items[0].checked = true`), you MUST call `tray.setContextMenu(menu)` again for the change to appear. macOS and Windows update automatically. [S6]

### Click Events

```typescript
// Left click (all platforms)
tray.on('click', (event, bounds, position) => {
  togglePopover()
})

// Right click (macOS/Windows)
tray.on('right-click', (event, bounds) => {
  tray.popUpContextMenu()
})

// Double click (macOS/Windows)
tray.on('double-click', (event, bounds) => {
  mainWindow?.show()
})
```

GOTCHA: On macOS, `mouse-up` event does NOT fire when a context menu is set via `setContextMenu()`. Use `click` or `mouse-down` instead. [S6]

### Tray Popover (Click-to-Toggle Window)

```typescript
let isPopoverVisible = false

tray.on('click', (_event, bounds) => {
  if (isPopoverVisible) {
    popoverWindow.hide()
    isPopoverVisible = false
  } else {
    // Position under tray icon
    const winBounds = popoverWindow.getBounds()
    const x = Math.round(bounds.x + bounds.width / 2 - winBounds.width / 2)
    const y = bounds.y + bounds.height
    popoverWindow.setPosition(x, y, false)
    popoverWindow.show()
    isPopoverVisible = true
  }
})

// Hide popover when it loses focus
popoverWindow.on('blur', () => {
  popoverWindow.hide()
  isPopoverVisible = false
})
```

## Application Menu (macOS)

```typescript
import { Menu, MenuItem, app } from 'electron'

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  },
  { role: 'window', submenu: [{ role: 'minimize' }] },
]

Menu.setApplicationMenu(Menu.buildFromTemplate(template))
```

For menu-bar-only apps (no dock): call `Menu.setApplicationMenu(null)` to remove the app menu entirely (or keep a minimal one). [S24]

### Dynamic Menu Updates

`Menu.getApplicationMenu()` does NOT support adding/removing items on the live instance. Rebuild and reset:

```typescript
function updateMenu(isActive: boolean): void {
  const template = buildTemplate(isActive)
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
```

Individual properties (enabled, checked, visible, label) CAN be mutated on live items:
```typescript
const menu = Menu.getApplicationMenu()
const item = menu?.getMenuItemById('toggle-focus')
if (item) item.checked = isActive
```

### Context Menu from Renderer

Context menus are built in main and triggered via IPC:

```typescript
// Preload
contextBridge.exposeInMainWorld('api', {
  showContextMenu: (x: number, y: number) =>
    ipcRenderer.invoke('menu:context', { x, y }),
})

// Main
ipcMain.handle('menu:context', (event, { x, y }) => {
  const menu = Menu.buildFromTemplate([
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
  ])
  menu.popup({
    window: BrowserWindow.fromWebContents(event.sender) ?? undefined,
    x, y
  })
})
```

## Accelerators

```typescript
{ label: 'New', accelerator: 'CmdOrCtrl+N', click: () => createNewItem() }
{ label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' }
{ label: 'Toggle Full Screen', accelerator: 'F11', role: 'togglefullscreen' }
```

`CmdOrCtrl` maps to Cmd on macOS, Ctrl on Windows/Linux. Prefer roles over custom click handlers for standard actions (copy, paste, quit, etc.) as roles get the right label per OS.
