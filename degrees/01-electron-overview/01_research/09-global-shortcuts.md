# Global Shortcuts — Electron

Version: Electron 42.1.0 [S8]

## Overview

`globalShortcut` captures keyboard events even when the app lacks focus. Main process only. Cannot be called before `ready` event.

## Core API

```typescript
import { globalShortcut, app } from 'electron'

// Register after app.ready
app.whenReady().then(() => {
  // Register one shortcut
  const registered = globalShortcut.register('CmdOrCtrl+Shift+P', () => {
    console.log('Global shortcut fired')
    toggleFocusMode()
  })

  if (!registered) {
    console.warn('CmdOrCtrl+Shift+P could not be registered')
    // Another app may own it; silently fails
  }
})

// Check if registered by THIS app
const isRegistered = globalShortcut.isRegistered('CmdOrCtrl+Shift+P')
// Returns false if: not registered, OR owned by another app — cannot distinguish

// Unregister single
globalShortcut.unregister('CmdOrCtrl+Shift+P')

// Unregister all (cleanup on quit)
globalShortcut.unregisterAll()
```

## Cleanup Pattern (REQUIRED)

```typescript
// ALWAYS clean up in will-quit, not before-quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
```

INVARIANT: If you don't unregister in `will-quit`, the shortcuts may persist as zombie registrations or conflict with the next app launch. [S8]

## Register Multiple Shortcuts with One Callback

```typescript
globalShortcut.registerAll(
  ['CmdOrCtrl+Shift+P', 'CmdOrCtrl+Shift+J'],
  () => {
    // fires for either shortcut
    handleAnyShortcut()
  }
)
```

## Suspend/Resume (Electron 42+)

```typescript
// Pause shortcut listening (e.g., while user is rebinding keys)
globalShortcut.setSuspended(true)
console.log(globalShortcut.isSuspended()) // true

// Resume
globalShortcut.setSuspended(false)
```

Note: New registrations fail while suspended. [S8]

## Conflict Detection and Handling

```typescript
function tryRegisterShortcut(
  accelerator: string,
  handler: () => void
): boolean {
  if (globalShortcut.isRegistered(accelerator)) {
    // Might be THIS app (ok) or another app (conflict)
    // isRegistered returns true only for shortcuts registered by THIS app
    return true
  }

  const success = globalShortcut.register(accelerator, handler)
  if (!success) {
    // Another application holds this shortcut
    // Cannot do anything; OS prevents stealing another app's global shortcut
    console.warn(`[shortcuts] failed to register: ${accelerator}`)
  }
  return success
}
```

CRITICAL BEHAVIOR: `register()` fails silently when another app holds the accelerator. The OS intentionally prevents apps from fighting over global shortcuts. You cannot detect WHICH app holds it. [S8]

## Accelerator Syntax

```typescript
// Modifiers
'CmdOrCtrl'   // Cmd on macOS, Ctrl on Windows/Linux
'Command'     // macOS only
'Control'     // Ctrl on all platforms
'Alt'         // Option on macOS
'Option'      // macOS only (same as Alt)
'Shift'
'Super'       // Windows key / Command key

// Keys
'A'-'Z', '0'-'9'
'F1'-'F24'
'Space', 'Tab', 'Backspace', 'Delete', 'Escape', 'Enter', 'Return'
'Up', 'Down', 'Left', 'Right'
'Home', 'End', 'PageUp', 'PageDown'
'Plus', 'Minus', 'Equal', 'Period', 'Comma', 'Slash', 'Backslash'
'Left/Right Bracket', 'Apostrophe', 'Semicolon'

// Media keys (require accessibility trust on macOS 10.14+)
'MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop'
'VolumeUp', 'VolumeDown', 'VolumeMute'
```

## macOS-Specific Limitations

### Media Keys (macOS 10.14+ Mojave)

These accelerators require the app to be authorized as a trusted accessibility client:
- `Media Play/Pause`, `Media Next Track`, `Media Previous Track`, `Media Stop`

System Preferences → Security & Privacy → Accessibility → add your app. [S8]

Without accessibility trust, registration may succeed but the callback may not fire.

### Sandbox / MAS Limitations

The official docs do not specify sandbox/MAS restrictions for `globalShortcut`. From community evidence and Apple's documentation, apps in full sandbox (MAS) may have restrictions on certain global shortcut combinations.

OPEN QUESTION: Verify globalShortcut behavior in a sandboxed/MAS build. See `23-open-questions.md`.

## IPC Integration (Trigger Renderer from Global Shortcut)

```typescript
import { globalShortcut, BrowserWindow } from 'electron'

app.whenReady().then(() => {
  globalShortcut.register('CmdOrCtrl+Shift+J', () => {
    // Notify renderer (e.g., show quick-capture UI)
    const win = BrowserWindow.getFocusedWindow()
      ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send('shortcut:capture')
    win?.show()
    win?.focus()
  })
})
```

## Best Practices

1. Register shortcuts AFTER `app.whenReady()` resolves
2. Always unregister ALL in `will-quit`
3. Check registration success; log if it fails
4. Use `CmdOrCtrl` prefix for cross-platform shortcuts
5. Avoid system-reserved combos: Cmd+Tab (macOS), Ctrl+Alt+Del (Windows)
6. Do NOT register media keys without first checking accessibility trust status
7. Provide UI for users to rebind shortcuts (use `setSuspended(true)` during rebinding)
8. Emit IPC event to renderer when shortcut fires (don't do all work in the callback)
