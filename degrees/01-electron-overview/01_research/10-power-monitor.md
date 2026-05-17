# Power Monitor — Electron

Version: Electron 42.1.0 [S9]

## Overview

`powerMonitor` emits OS power events to the main process. Main process only. Available after `app.whenReady()`.

## All Events and Payload Shapes

### `suspend`

```typescript
import { powerMonitor } from 'electron'

powerMonitor.on('suspend', () => {
  // System is going to sleep
  // Payload: none
  console.log('[power] suspend — pausing active work')
  pauseSession()
  persistState()
})
```

Platforms: macOS, Windows, Linux

### `resume`

```typescript
powerMonitor.on('resume', () => {
  // System woke from sleep
  // Payload: none
  console.log('[power] resume')
  resumeSessionIfWasActive()
  recalculateElapsedTime()
})
```

Platforms: macOS, Windows, Linux

IMPORTANT: Elapsed time during sleep is NOT tracked by Electron automatically. You MUST record the suspend timestamp and calculate sleep duration on resume if you need it. [S9]

### `on-ac` / `on-battery`

```typescript
powerMonitor.on('on-ac', () => {
  console.log('[power] switched to AC power')
})

powerMonitor.on('on-battery', () => {
  console.log('[power] switched to battery — may throttle work')
})
```

Platforms: macOS, Windows only (not Linux)

### `lock-screen` / `unlock-screen`

```typescript
powerMonitor.on('lock-screen', () => {
  console.log('[power] screen locked')
  // Pause sensitive operations
})

powerMonitor.on('unlock-screen', () => {
  console.log('[power] screen unlocked')
  // Resume if appropriate
})
```

Platforms: macOS, Windows only

### `thermal-state-change` (macOS only)

```typescript
powerMonitor.on('thermal-state-change', (details) => {
  const state = details.state
  // state: 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical'
  console.log('[power] thermal state:', state)

  if (state === 'serious' || state === 'critical') {
    // Reduce workload — e.g., pause sync operations, reduce polling frequency
    throttleBackgroundWork()
  }
})
```

Platforms: macOS only

### `speed-limit-change` (macOS, Windows)

```typescript
powerMonitor.on('speed-limit-change', (details) => {
  const limit = details.limit
  // limit: number (percentage of full CPU speed; <100 means throttling)
  console.log(`[power] CPU speed limit: ${limit}%`)
})
```

Platforms: macOS, Windows

### `shutdown` (macOS, Linux)

```typescript
powerMonitor.on('shutdown', (event) => {
  // Fires before OS reboot/shutdown
  // Can delay with preventDefault(), but MUST quit promptly after
  event.preventDefault()
  flushStateSync()
  app.quit()
})
```

Platforms: macOS, Linux (NOT Windows)

### `user-did-become-active` / `user-did-resign-active` (macOS only)

```typescript
powerMonitor.on('user-did-become-active', () => {
  console.log('[power] user session activated')
})

powerMonitor.on('user-did-resign-active', () => {
  console.log('[power] user session deactivated (fast user switching)')
})
```

## Platform Matrix Summary

| Event | macOS | Windows | Linux |
|-------|-------|---------|-------|
| suspend | ✓ | ✓ | ✓ |
| resume | ✓ | ✓ | ✓ |
| on-ac / on-battery | ✓ | ✓ | — |
| lock-screen / unlock-screen | ✓ | ✓ | — |
| thermal-state-change | ✓ | — | — |
| speed-limit-change | ✓ | ✓ | — |
| shutdown | ✓ | — | ✓ |
| user-did-become-active/resign | ✓ | — | — |

[S9]

## Idle Detection Methods

### `getSystemIdleState(idleThreshold)`

```typescript
// Returns: 'active' | 'idle' | 'locked' | 'unknown'
const state = powerMonitor.getSystemIdleState(60) // idle after 60 seconds
console.log(state) // 'active' if user was active within last 60s
```

### `getSystemIdleTime()`

```typescript
// Returns seconds since last user activity
const idleSeconds = powerMonitor.getSystemIdleTime()
if (idleSeconds > 300) {
  console.log('User has been idle for 5+ minutes')
}
```

NOTE: Documentation mentions `getSystemIdleState`, not `querySystemIdleState`. There is no `querySystemIdleState` method. [S9]

### `getCurrentThermalState()` (macOS only)

```typescript
const thermalState = powerMonitor.getCurrentThermalState()
// Returns: 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical'
```

### `isOnBatteryPower()`

```typescript
const onBattery = powerMonitor.isOnBatteryPower()
// Also available as property:
const onBattery2 = powerMonitor.onBatteryPower
```

## Practical Pattern: Sleep-Aware Timer

```typescript
interface SessionState {
  active: boolean
  remainingMs: number
  lastActiveTime: number
}

let session: SessionState = { active: false, remainingMs: 0, lastActiveTime: 0 }

powerMonitor.on('suspend', () => {
  if (session.active) {
    session.lastActiveTime = Date.now()
    // Don't update remainingMs yet — wait for resume
  }
})

powerMonitor.on('resume', () => {
  if (session.active && session.lastActiveTime > 0) {
    const sleepDurationMs = Date.now() - session.lastActiveTime
    // Subtract sleep time from remaining: session was paused during sleep
    // OR: don't subtract — let timer continue from where it left off
    // Decision depends on product behavior (document in decision-log)
    session.lastActiveTime = 0
  }
})
```

## Idle-Based Session Pause

```typescript
function startIdlePolling(): NodeJS.Timeout {
  return setInterval(() => {
    const idleTime = powerMonitor.getSystemIdleTime()
    if (idleTime > 120 && session.active) { // 2 minutes idle
      console.log('[power] user idle — pausing session')
      pauseSession()
    }
  }, 10_000) // check every 10 seconds
}
```
