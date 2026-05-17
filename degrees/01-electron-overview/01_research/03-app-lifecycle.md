# App Lifecycle — Electron

Version: Electron 42.1.0 [S10]

## Core Lifecycle Events (in order)

### 1. `will-finish-launching`

Fires before `ready`. Use for protocol registration on some platforms. Generally skip in favor of `whenReady()`.

### 2. `ready`

Single-shot. Fires once when Electron finishes initializing.

```typescript
import { app } from 'electron'

app.whenReady().then(() => {
  createWindow()
  registerTray()
  registerShortcuts()
})
```

INVARIANT: Most Electron APIs (BrowserWindow, globalShortcut, Tray, etc.) MUST be called after `ready`. Calling before throws. [S10]

### 3. `window-all-closed`

Fires when every BrowserWindow is closed.

**macOS-specific CRITICAL**: On macOS, closing all windows does NOT quit the app by convention. Apps remain active with just their Dock/menu bar icons. You MUST handle this event to diverge from default behavior:

```typescript
app.on('window-all-closed', () => {
  // macOS: do NOT quit — user can re-open from Dock or menu bar
  if (process.platform !== 'darwin') {
    app.quit()
  }
  // For menu-bar-only apps: also suppress on macOS
})
```

[S10]

### 4. `activate` (macOS only)

Fires when the app is activated — user clicks Dock icon, or app re-launched while already running.

```typescript
app.on('activate', (_event, hasVisibleWindows) => {
  if (!hasVisibleWindows) {
    createWindow()
  }
})
```

`hasVisibleWindows` boolean indicates whether any window is already showing. [S10]

### 5. `before-quit`

Fires before windows start closing during `app.quit()`. Can be cancelled.

Use for: warning the user, flushing state that hasn't been saved.

```typescript
app.on('before-quit', (event) => {
  if (hasPendingChanges) {
    event.preventDefault()
    showSaveDialog().then(() => app.quit())
  }
})
```

### 6. `will-quit`

Fires after all windows have closed, immediately before the process terminates. Can be cancelled.

Use for: cleanup — unregister globalShortcuts, flush crash reporter, close DB connections.

```typescript
app.on('will-quit', (event) => {
  globalShortcut.unregisterAll()
  db?.close()
})
```

CRITICAL: Unregister globalShortcuts here, not in `before-quit`. [S8]

### 7. `quit`

Fires when the app is quitting with the exit code. NOT fired on Windows during system shutdown/logout. [S10]

```typescript
app.on('quit', (_event, exitCode) => {
  console.log(`Exiting with code: ${exitCode}`)
})
```

### 8. `second-instance`

Fires in the PRIMARY instance when a SECOND instance is launched. Used for single-instance lock pattern AND deep link routing on Windows/Linux.

```typescript
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit() // This is the second instance; quit immediately
} else {
  app.on('second-instance', (event, argv, workingDirectory, additionalData) => {
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    // Deep link from argv (Windows/Linux)
    const url = argv.find(arg => arg.startsWith('myapp://'))
    if (url) handleDeepLink(url)
  })
}
```

[S10, S26]

### 9. `open-url` (macOS only)

Fires when macOS routes a custom URL scheme to the app. Register BEFORE `whenReady()` to catch launch URLs.

```typescript
// Register before whenReady
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

app.whenReady().then(() => { createWindow() })
```

Note: On macOS, `open-url` is the deep-link mechanism, not `second-instance`. [S26]

### 10. `open-file` (macOS only)

Fires when a file is opened via Finder, dock drop, or `open` CLI. Handle `event.preventDefault()` and process the path.

### 11. Orderings and edge cases

| Scenario | Events fired |
|----------|-------------|
| Normal quit (`app.quit()`) | `before-quit` → windows close → `window-all-closed` → `will-quit` → `quit` |
| User closes last window (macOS) | `window-all-closed` → (app stays alive if no quit called) |
| System logout/shutdown (Windows) | `quit` NOT fired reliably |
| Second instance launched | `second-instance` in first, second quits |
| Deep link opened (macOS) | `open-url` in first instance |

## Single-Instance Lock Pattern

```typescript
// src/main.ts — must be called as early as possible
import { app } from 'electron'

const gotLock = app.requestSingleInstanceLock({ fromCLI: process.argv })

if (!gotLock) {
  console.log('Another instance is running, quitting')
  app.quit()
  process.exit(0)
}

// Only primary instance reaches here
app.on('second-instance', (event, argv, cwd, additionalData) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow()
})
```

INVARIANT: `requestSingleInstanceLock()` must be called BEFORE `app.whenReady()`. [S10]

## macOS Menu-Bar-Only App Pattern

For apps with no dock icon (like the Pulse capstone):

```typescript
// Hide dock icon at startup for menu-bar-only apps
if (process.platform === 'darwin') {
  app.dock.hide()
}
```

Also set `LSUIElement = 1` in Info.plist to prevent dock icon appearing at launch. [S27]

## app.getPath() Keys

```typescript
import { app } from 'electron'

app.getPath('home')        // /Users/username
app.getPath('appData')     // ~/Library/Application Support (macOS)
app.getPath('userData')    // ~/Library/Application Support/<AppName>
app.getPath('sessionData') // separate from userData (Chromium session)
app.getPath('temp')        // OS temp dir
app.getPath('desktop')     // ~/Desktop
app.getPath('documents')   // ~/Documents
app.getPath('downloads')   // ~/Downloads
app.getPath('logs')        // ~/Library/Logs/<AppName> (macOS)
app.getPath('crashDumps')  // ~/Library/Application Support/<AppName>/Crashpad
```

IMPORTANT: Store app data in a subdirectory of `userData`, NOT directly in it — Chromium directories like `Cache`, `GPUCache`, `Local Storage` live there. [S10]

```typescript
// CORRECT
const dataFile = path.join(app.getPath('userData'), 'myapp', 'journal.json')

// WRONG — risks collision with Chromium dirs
const dataFile = path.join(app.getPath('userData'), 'journal.json')
```

## Version and Paths

```typescript
app.getVersion()    // app version from package.json
app.getName()       // app name from package.json
app.getAppPath()    // path to the app's root directory
app.getLocale()     // user locale string, e.g. 'en-US'
```
