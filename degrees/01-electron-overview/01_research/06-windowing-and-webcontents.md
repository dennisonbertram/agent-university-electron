# Windowing and WebContents — Electron

Version: Electron 42.1.0 [S23, S29]

## BrowserWindow: Key Constructor Options

```typescript
import { BrowserWindow } from 'electron'
import path from 'node:path'

const win = new BrowserWindow({
  // Dimensions
  width: 800,
  height: 600,
  minWidth: 400,
  minHeight: 300,
  maxWidth: 1600,

  // Appearance
  frame: true,             // false for frameless (custom title bar)
  transparent: false,      // true for transparent background (requires frame: false on some platforms)
  vibrancy: 'popover',    // macOS: blur behind window; options below
  titleBarStyle: 'hiddenInset', // macOS: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover'
  trafficLightPosition: { x: 20, y: 20 }, // macOS custom traffic light position

  // Behavior
  show: false,             // defer show until ready-to-show
  alwaysOnTop: false,
  fullscreen: false,
  resizable: true,
  movable: true,
  modal: false,
  parent: undefined,       // BrowserWindow ref for child/modal relationship

  // Background
  backgroundColor: '#ffffff', // Prevents white flash on load

  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,   // keep true
    sandbox: true,            // keep true
    nodeIntegration: false,   // keep false
    devTools: true,           // can disable in production
    webSecurity: true,        // keep true
  },
})
```

## Anti-Flash Pattern (show: false + ready-to-show)

```typescript
const win = new BrowserWindow({ show: false, backgroundColor: '#1e1e1e' })
win.loadFile('index.html')
win.once('ready-to-show', () => {
  win.show()
})
```

CAVEAT: `ready-to-show` will NOT fire if `paintWhenInitiallyHidden: false`. Don't set that flag if using this pattern. [S23]

## Loading Content

```typescript
// Local file (development and packaged)
win.loadFile(path.join(__dirname, 'renderer/index.html'))

// URL (for dev server hot reload)
win.loadURL('http://localhost:5173')

// In Electron Forge with Vite plugin, the URL is set by the plugin:
// win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL) in dev
// win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)) in prod
```

## vibrancy Options (macOS)

```typescript
win.setVibrancy('popover')    // Frosted glass popover
win.setVibrancy('menu')       // Matches macOS menu appearance
win.setVibrancy('hud')        // Heads-up display style
win.setVibrancy('sidebar')    // Sidebar appearance (Finder-like)
win.setVibrancy('tooltip')    // Tooltip appearance
win.setVibrancy('under-window') // Full frosted glass
win.setVibrancy(null)         // Remove vibrancy
```

Vibrancy requires `transparent: true` and `frame: false` or `titleBarStyle` other than `default` in some configurations. Test on real macOS hardware — simulator behavior may differ.

## Popover-Style Window (Tray Popover Pattern)

```typescript
function createPopover(): BrowserWindow {
  const popover = new BrowserWindow({
    width: 340,
    height: 400,
    frame: false,
    transparent: true,
    vibrancy: 'popover',
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  // Position under tray icon
  function positionUnderTray(tray: Tray): void {
    const trayBounds = tray.getBounds()
    const windowBounds = popover.getBounds()
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    const y = trayBounds.y + trayBounds.height + 4 // 4px gap
    popover.setPosition(x, y)
  }

  return popover
}
```

GOTCHA: `tray.getBounds()` is macOS/Windows only. On Linux, positioning must be calculated differently. [S6]

## BrowserView vs WebContentsView

**BrowserView is DEPRECATED since Electron 30.** [S29]

```typescript
// DEPRECATED — do not use in new code
const view = new BrowserView()
win.setBrowserView(view)

// CORRECT — use WebContentsView
import { WebContentsView, BaseWindow } from 'electron'
const view = new WebContentsView({ webPreferences: { ... } })
const baseWin = new BaseWindow()
baseWin.contentView.addChildView(view)
```

## Multi-Window Apps

```typescript
let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: false,
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null  // de-reference on close
  })

  settingsWindow.loadFile(path.join(__dirname, 'renderer/settings.html'))
}
```

INVARIANT: Always null-out window references in the `closed` event handler. Otherwise the reference keeps the GC'd BrowserWindow object alive and operations on it will throw. [S23]

## WindowOpenHandler (Popup Security)

```typescript
win.webContents.setWindowOpenHandler(({ url, features }) => {
  // All window.open() calls from renderer go through here
  if (url.startsWith('https://')) {
    shell.openExternal(url)  // open in browser
  }
  return { action: 'deny' } // never open in Electron
})
```

## setVisibleOnAllWorkspaces (macOS Menu Bar Apps)

```typescript
// For popover windows that should appear over all spaces/fullscreen apps:
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
win.setAlwaysOnTop(true, 'floating')
```

## Click-Through Overlay

```typescript
// Pass mouse events through to windows below (useful for HUD overlays)
win.setIgnoreMouseEvents(true, { forward: true })
// Re-enable on mouse enter:
win.setIgnoreMouseEvents(false)
```

## DevTools

```typescript
// Open DevTools programmatically (dev only)
win.webContents.openDevTools({ mode: 'detach' })

// Check if DevTools is open
win.webContents.isDevToolsOpened()
```

## WebContents Key Events

```typescript
win.webContents.on('did-finish-load', () => {
  // Page finished loading (navigation complete)
})

win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  // Navigation failed — white screen condition
  console.error(`Load failed: ${errorDescription} (${errorCode})`)
})

win.webContents.on('crashed', () => {
  // Renderer crashed — recreate or reload
  win.webContents.reload()
})

win.webContents.on('unresponsive', () => {
  // Renderer hung — show "wait or force quit" dialog
})
```
