# Dock and Auto-Launch — Electron

Version: Electron 42.1.0 [S10, S27]

## app.dock API (macOS only)

`app.dock` is `undefined` on non-macOS platforms. Always guard:

```typescript
if (process.platform === 'darwin') {
  app.dock.setBadge('5')
}
```

### Methods

```typescript
import { app } from 'electron'

// Bounce (animate) the dock icon
const id = app.dock.bounce('informational') // or 'critical'
// 'informational': bounces once
// 'critical': bounces until app is focused

// Cancel bounce
app.dock.cancelBounce(id)

// Bounce the Downloads stack
app.dock.downloadFinished('/Users/me/Downloads/file.zip')

// Badge
app.dock.setBadge('3')       // show badge with text
app.dock.getBadge()          // returns current badge text
app.dock.setBadge('')        // clear badge

// Visibility
app.dock.hide()              // hide dock icon (menu-bar-only apps)
await app.dock.show()        // show dock icon (returns Promise<void>)
app.dock.isVisible()         // returns boolean

// Dock menu (separate from application menu)
import { Menu } from 'electron'
const dockMenu = Menu.buildFromTemplate([
  { label: 'New Session', click: () => startSession() },
  { label: 'View Journal', click: () => openJournal() },
])
app.dock.setMenu(dockMenu)
app.dock.getMenu() // returns Menu | null

// Custom dock icon
app.dock.setIcon(nativeImage.createFromPath('icon.png'))
```

[S27]

## Menu-Bar-Only App (No Dock Icon)

Two approaches:

### Approach 1: Info.plist — LSUIElement (recommended)

Set `LSUIElement = 1` in `Info.plist` (via Electron Forge packager config). This prevents the dock icon from appearing at ALL, even on launch.

```typescript
// forge.config.ts
const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.pulse',
    extraResource: [],
    extendInfo: {
      LSUIElement: true,
      // Equivalent to LSUIElement = 1
    },
  },
}
```

### Approach 2: Runtime hide

```typescript
app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
  createTray()
})
```

DIFFERENCE: LSUIElement prevents dock from flashing at all during launch. Runtime `dock.hide()` causes the dock icon to appear briefly then disappear. For polished menu-bar apps, use LSUIElement in Info.plist. [S27]

CAVEAT: With LSUIElement, the app is excluded from Cmd+Tab switching and has no dock presence. This is the correct behavior for menu-bar apps.

## Auto-Launch on Login: setLoginItemSettings

```typescript
import { app } from 'electron'

// Enable auto-launch
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true, // macOS: launch without showing dock icon / windows
})

// Query current settings
const settings = app.getLoginItemSettings()
console.log(settings.openAtLogin) // boolean
console.log(settings.status)      // macOS: 'enabled' | 'disabled' | 'not-registered' | ...
```

[S10]

## macOS 13+ (Ventura) Login Items — Service Management API

IMPORTANT: macOS 13+ changed how login items work. Pre-13 apps used the old Login Items API (visible in System Preferences → Users & Groups). macOS 13+ uses the Service Management framework.

### What changed:

- Old API: `SMLoginItemSetEnabled` — deprecated but still works for many cases
- New API: `SMAppService` — the new way; items appear in System Settings → General → Login Items

Electron's `setLoginItemSettings` wraps the old API and works for unsigned dev apps. For signed apps targeting macOS 13+, behavior may differ:

```typescript
// macOS 13+ additional settings
app.setLoginItemSettings({
  openAtLogin: true,
  type: 'mainAppService',    // macOS 13+: 'mainAppService' | 'agentService' | 'daemonService' | 'loginItemService'
  serviceName: 'com.example.pulse.helper', // for agentService/daemonService
})
```

OPEN QUESTION: For signed apps on macOS 13+, does `openAtLogin: true` with default `type` work correctly without a separate helper bundle? Validate in L5/capstone. See `23-open-questions.md`.

## getLoginItemSettings() Return Value

```typescript
const s = app.getLoginItemSettings()
// {
//   openAtLogin: boolean,
//   openAsHidden: boolean,    // macOS
//   wasOpenedAtLogin: boolean,  // macOS
//   wasOpenedAsHidden: boolean, // macOS
//   restoreState: boolean,      // macOS
//   status: string,             // macOS 13+: 'not-registered' | 'enabled' | 'requires-approval' | 'not-found'
//   executableWillLaunchAtLogin: boolean, // Windows
//   launchItems: LoginItemSettings[], // Windows
// }
```

The `status` field on macOS 13+ is important — `requires-approval` means the user must approve in System Settings.

## addRecentDocument

```typescript
import { app } from 'electron'
import path from 'node:path'

// Add to Recent Documents in Dock menu and File menu
app.addRecentDocument(path.join(app.getPath('documents'), 'journal.txt'))

// Clear all recent documents
app.clearRecentDocuments()
```

Platforms: macOS, Windows [S10]

## Testing Auto-Launch

```typescript
// Test helper — can be triggered via IPC for debugging
ipcMain.handle('autolaunch:toggle', async () => {
  const current = app.getLoginItemSettings()
  const next = !current.openAtLogin
  app.setLoginItemSettings({ openAtLogin: next, openAsHidden: true })
  return app.getLoginItemSettings()
})
```

Note: In development (unsigned), `openAtLogin: true` may work but the launch path may differ from the packaged app. Always test in a packaged build for real validation.
