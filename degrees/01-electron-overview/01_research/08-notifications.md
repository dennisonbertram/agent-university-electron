# Notifications — Electron

Version: Electron 42.1.0 [S7]

## Critical Invariant: Code-Signing Required on macOS

CRITICAL: "This API requires an application to be code-signed in order for notifications to appear." On macOS, unsigned development builds will emit a `failed` event (with an error string) instead of showing the notification. Notifications silently fail in development unless the app is signed. [S7]

Workaround for development: use a provisioning profile or test on a build signed with an ad-hoc identity. During POC development, acknowledge that notification tests may only fully pass with a signed build.

## Constructor

```typescript
import { Notification } from 'electron'

const notification = new Notification({
  // Cross-platform
  title: 'Focus Session Complete',
  body: 'You completed a 25-minute focus session.',
  silent: false,
  icon: path.join(__dirname, 'assets/notification-icon.png'),

  // macOS + Windows
  id: 'focus-complete-001',    // unique ID; reuse to update/replace
  groupId: 'focus-sessions',   // groups related notifications
  hasReply: true,
  replyPlaceholder: 'Add a note...',
  actions: [
    { type: 'button', text: '+5 min' },
    { type: 'button', text: 'End Now' },
  ],

  // macOS only
  subtitle: 'Session #7',
  sound: 'Glass',  // system sound name, or custom filename

  // Windows only
  // urgency and timeoutType not needed for macOS
})
```

## Platform Support Matrix

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| title, body | ✓ | ✓ | ✓ |
| silent | ✓ | ✓ | ✓ |
| icon | ✓ | ✓ | ✓ |
| id, groupId | ✓ | ✓ | — |
| hasReply, replyPlaceholder | ✓ | ✓ | — |
| actions (buttons) | ✓ | ✓ | — |
| subtitle | ✓ | — | — |
| sound | ✓ | — | — |
| urgency | — | — | ✓ |
| timeoutType | — | ✓ | ✓ |
| toastXml (custom layout) | — | ✓ | — |

[S7]

## Show and Events

```typescript
// MUST call show() explicitly
notification.show()

// Events
notification.on('show', () => {
  console.log('[notification] shown')
})

notification.on('click', () => {
  mainWindow?.show()
  mainWindow?.focus()
})

notification.on('close', (details) => {
  // details.reason on Windows: 'userCanceled' | 'applicationHidden' | 'timedOut'
  console.log('[notification] closed')
})

// macOS + Windows: reply input
notification.on('reply', (details) => {
  const userText = details.reply // string
  appendJournalEntry(userText)
})

// macOS + Windows: action button clicked
notification.on('action', (details) => {
  const idx = details.actionIndex // 0-based index of button clicked
  if (idx === 0) extendSession(5)
  if (idx === 1) endSession()
})

notification.on('failed', (_event, error) => {
  console.error('[notification] failed:', error)
  // On macOS: likely missing code signing
})
```

GOTCHA: Deprecated parameter form — the second positional arg to `reply` (`reply`) and `action` (`actionIndex`, `selectionIndex`) is deprecated. Always read from the `details` event object. [S7]

## Static Methods

```typescript
// Check platform support before showing
if (Notification.isSupported()) {
  notification.show()
}

// macOS: get notification history (requires code signing)
const history = await Notification.getHistory()
// Returns Notification[] still in Notification Center
// Only id, groupId, title, subtitle, body are populated on returned objects
// getHistory() returns [] in unsigned dev builds
```

## Windows: Central Activation Handler

```typescript
// Windows: handle all notification activations (clicks, replies, actions)
// Works across cold starts and persisted Action Center notifications
Notification.handleActivation((activationArgs) => {
  console.log('Activated:', activationArgs)
})
```

## Replacing a Notification

To update a displayed notification, use the same `id`:

```typescript
const n1 = new Notification({ id: 'timer', title: '25:00 remaining' })
n1.show()

// Later — update by creating new with same id:
const n2 = new Notification({ id: 'timer', title: '20:00 remaining' })
n2.show() // Replaces n1 in Notification Center
```

Note: calling `show()` on an existing notification object dismisses and re-posts it (fresh notification with identical props). [S7]

## Badge Count (macOS Dock)

Badge count via dock, NOT notifications:

```typescript
import { app } from 'electron'

// Set badge
if (process.platform === 'darwin') {
  app.dock.setBadge('3')
  // Clear badge:
  app.dock.setBadge('')
}
```

There is NO badge option in the Notification API. [S7]

## Lifetime Management

```typescript
// Store notification reference if you need to close it programmatically
let activeNotification: Electron.Notification | null = null

function showSessionNotification(): void {
  activeNotification?.close()
  activeNotification = new Notification({ title: 'Session Starting' })
  activeNotification.on('close', () => { activeNotification = null })
  activeNotification.show()
}
```

## Common Failure Modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `failed` event fires | App not code-signed (macOS) | Sign with dev certificate or test on packaged build |
| Notification shows but actions don't fire | Event listener added after `show()` | Add listeners BEFORE calling `show()` |
| Notification Center empty after app restart | `getHistory()` requires code signing | Sign the app |
| Click opens app but wrong window shown | Not handling `click` event to focus/restore window | Add `mainWindow?.focus()` in click handler |
| Silent: false but no sound | Sound name not valid | Use system sound name from System Preferences |
