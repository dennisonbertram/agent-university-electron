# Deep Links and Custom Protocols — Electron

Version: Electron 42.1.0 [S10, S26]

## Architecture Overview

Deep links work differently on macOS vs Windows/Linux:

| Platform | Mechanism | Requires packaging? |
|----------|-----------|-------------------|
| macOS | `open-url` event | YES — does not work in dev CLI launch |
| Windows | `second-instance` event + argv | YES for OS URL routing |
| Linux | `second-instance` event + argv | YES |

CRITICAL: "On macOS and Linux, this feature will only work when your app is packaged." Development mode via CLI will not trigger the OS URL routing. [S26]

## Step 1: Register Protocol Handler

```typescript
import { app } from 'electron'
import path from 'node:path'

// Development: must pass execPath and script path
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      'pulse',
      process.execPath,
      [path.resolve(process.argv[1])]
    )
  }
} else {
  // Packaged: simple registration
  app.setAsDefaultProtocolClient('pulse')
}
```

`process.defaultApp` is `true` when the app is launched via `electron path/to/script.js`. [S26]

## Step 2: macOS — open-url Event

```typescript
// Register BEFORE app.whenReady() to catch URLs from cold launch
app.on('open-url', (event, url) => {
  event.preventDefault() // suppress default handling
  console.log('[protocol] open-url:', url)
  handleDeepLink(url)
})

app.whenReady().then(() => {
  createWindow()
  createTray()
})
```

INVARIANT: Register `open-url` handler BEFORE `whenReady()`. If registered after, URLs from a cold app launch (opening URL when app is not running) will be missed. [S26]

## Step 3: Windows/Linux — second-instance + Single Lock

```typescript
// Must be called BEFORE app.whenReady()
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  // Second instance — quit immediately
  app.quit()
  process.exit(0)
}

app.on('second-instance', (event, commandLine, _workingDirectory) => {
  // Focus existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }

  // Deep link URL is the last element of commandLine
  const url = commandLine.find(arg => arg.startsWith('pulse://'))
  if (url) handleDeepLink(url)
})

app.whenReady().then(() => {
  createWindow()
})
```

[S26]

## Step 4: URL Parser

```typescript
function handleDeepLink(url: string): void {
  console.log('[protocol] handling:', url)

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    console.error('[protocol] invalid URL:', url)
    return
  }

  // Examples:
  // pulse://start?duration=25
  // pulse://stop
  // pulse://log?text=hello+world

  const action = parsed.hostname + parsed.pathname // 'start' or 'stop' or 'log'

  switch (action) {
    case 'start': {
      const duration = parseInt(parsed.searchParams.get('duration') ?? '25', 10)
      ipcMain.emit('focus:start', {}, duration) // dispatch internally
      break
    }
    case 'stop':
      ipcMain.emit('focus:stop', {})
      break
    case 'log': {
      const text = parsed.searchParams.get('text') ?? ''
      if (text) appendJournalEntry(text)
      break
    }
    default:
      console.warn('[protocol] unknown action:', action)
  }
}
```

## Step 5: Info.plist Configuration (macOS Packaged)

The app bundle must declare the URL scheme. With Electron Forge, configure in `forge.config.ts`:

```typescript
// forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.example.pulse',
    protocols: [
      {
        name: 'Pulse',
        schemes: ['pulse'],
      },
    ],
    // ...
  },
}
```

This generates the correct `CFBundleURLTypes` entry in Info.plist. [S26]

Alternatively, manual Info.plist entry:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>pulse</string>
    </array>
    <key>CFBundleURLName</key>
    <string>Pulse Protocol</string>
  </dict>
</array>
```

## Step 6: Testing Deep Links

```bash
# macOS — trigger open-url event
open "pulse://start?duration=25"

# macOS — launch app via URL (cold start or warm)
open -a "My App" "pulse://log?text=testing"

# Windows — trigger second-instance
start "" "pulse://start?duration=25"
```

## Cross-Platform Full Example

```typescript
// src/protocol.ts

let pendingDeepLinkUrl: string | null = null

export function setupProtocol(): void {
  // macOS: register open-url FIRST
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (app.isReady()) {
      handleDeepLink(url)
    } else {
      pendingDeepLinkUrl = url // handle after ready
    }
  })

  // Windows/Linux: single-instance lock + second-instance
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, argv) => {
    const url = argv.find(a => a.startsWith('pulse://'))
    if (url) handleDeepLink(url)
    focusMainWindow()
  })
}

export function processPendingDeepLink(): void {
  if (pendingDeepLinkUrl) {
    handleDeepLink(pendingDeepLinkUrl)
    pendingDeepLinkUrl = null
  }
}
```

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `open-url` never fires in development | OS routing not set up for dev builds | Test with packaged build |
| Protocol opens new app instance instead of routing | `requestSingleInstanceLock` not called | Call lock before `whenReady()` |
| URL parsed incorrectly on Windows | URL is at different argv position | Use `.find()` not last element indexing |
| Protocol works locally but not after reinstall | GUID or bundle ID changed | macOS caches handler associations per bundle ID |
| `setAsDefaultProtocolClient` returns false | Another app holds the scheme | Unregister there first, or choose different scheme |
