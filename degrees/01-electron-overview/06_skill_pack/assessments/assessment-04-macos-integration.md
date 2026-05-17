# Assessment 04 — macOS System Integration

Tests understanding of tray, notifications, shortcuts, deep links, powerMonitor, Touch ID, and dock.

Back to [../index.md](../index.md) | [assessment-03-ipc.md](./assessment-03-ipc.md) | [assessment-05-packaging-and-update.md](./assessment-05-packaging-and-update.md)

---

## Questions

**Q1.** A tray icon appears when the app launches but disappears 3 seconds later. What is the root cause and how do you fix it without changing any other behavior?

**Q2.** Write the correct code for a `showNotification()` function that returns a Promise. The Promise must: (a) resolve when the notification is shown, (b) reject on `failed`, (c) resolve after 5 seconds regardless (safety timeout). The `failed` listener placement is critical — show it correctly.

**Q3.** `globalShortcut.register('CommandOrControl+Shift+P', handler)` returns `false`. What does this mean and what should the code do in response? What would be wrong with throwing an error instead?

**Q4.** Deep links work in the packaged app but NOT in development (`npm start`). Is this expected? Why? How do you test deep link handling in development without packaging the app?

**Q5.** A developer writes `app.on('open-url', handler)` inside `app.whenReady().then(() => { ... })`. Describe the exact scenario where this breaks and what the user observes.

**Q6.** Why must `powerMonitor` be accessed inside `app.whenReady()` and not at module scope? What error occurs if you access it too early?

**Q7.** For a menu-bar-only app (no Dock icon, only tray), list every piece of configuration required and in what files. Include: `LSUIElement`, `app.dock.hide()`, `window.setVisibleOnAllWorkspaces`.

**Q8.** `setLoginItemSettings({ openAtLogin: true })` is called. A test then calls `getLoginItemSettings().openAtLogin` and asserts it is `true`. Why does this test fail in development, and what should the test assert instead?

---

## Answer Key

**A1.** Root cause: the `Tray` instance is stored in a function-local variable. V8's garbage collector collects it when the containing function returns (typically within a few seconds). Fix: declare `let trayInstance: Tray | null = null` at module scope (not inside a function). Then assign: `trayInstance = new Tray(iconPath)` inside `installTray()`. The module-scope variable is a GC root — V8 cannot collect it while the module is loaded.

**A2.**
```typescript
export function showNotification(title: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const notification = new Notification({ title, body })
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      fn()
    }

    const timeoutId = setTimeout(() => {
      settle(resolve)  // resolve (not reject) on timeout
    }, 5000)

    // CRITICAL: attach BEFORE show()
    notification.on('failed', (_e, err) => {
      logger.error({ event: 'notification:failed', err })
      settle(() => reject(new Error(err)))
    })

    notification.on('show', () => {
      logger.info({ event: 'notification:shown' })
      settle(resolve)
    })

    notification.show()  // after listeners
  })
}
```

**A3.** `register()` returning `false` means the shortcut is already claimed by another app or system shortcut. It does NOT throw — Electron silently returns false. The code should: log a warning (`logger.warn({ event: 'shortcuts:register-failed', accelerator: '...' })`), then continue — the app works without that shortcut. Throwing would crash the app for a non-fatal condition; the user's other app or system shortcut is simply more important.

**A4.** Yes, this is expected. On macOS, `setAsDefaultProtocolClient` registers the app with Launch Services, which requires a proper `.app` bundle. In development, Electron runs as the `Electron` binary — not your app — so macOS routes `myapp://` URLs to the Electron binary itself, not your app. The fix for development testing: use a test seam — `app.emit('open-url', new Event('open-url'), 'myapp://action/test')` via the `testEmitOpenUrl` IPC channel. This drives the real `open-url` handler directly without OS routing.

**A5.** The breaking scenario: User has the app open. A second application (or the browser) opens `myapp://action/foo`. macOS delivers the `open-url` event immediately on the already-running app. If the `open-url` listener was registered inside `whenReady.then()`, the listener is registered — but during boot, between process start and `whenReady` resolving, the event can still be missed if timing is tight. More critically: if the app is launched cold by the deep link click (not already running), `open-url` fires during boot before `whenReady` resolves. The listener is never registered in time. The user observes: the app opens but nothing happens with the URL.

**A6.** `powerMonitor` is part of Electron's app infrastructure. Accessing it before the app is "ready" (i.e., before `app.whenReady()` resolves) throws: `Error: ERR_NO_APP — Cannot access app before it is ready`. The app is not initialized yet. Inside `whenReady()`, all Electron APIs are fully initialized and safe to use.

**A7.** Complete configuration for menu-bar-only app:
- `forge.config.ts` `packagerConfig.extendInfo`: `{ LSUIElement: true }` — hides from Dock and App Switcher at the OS level
- `src/main.ts` inside `whenReady`, BEFORE `createMainWindow()`: `if (process.platform === 'darwin') { app.dock.hide() }` — hides the Dock icon programmatically
- `src/window.ts` in window options: `show: false, skipTaskbar: true` — for the popover window
- `src/window.ts` after creation (optional): `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` — keeps popover visible when switching Spaces
- Platform guard: ALL `app.dock.*` calls must be wrapped in `if (process.platform === 'darwin')` for cross-platform safety

**A8.** `setLoginItemSettings` works correctly in development, but `getLoginItemSettings()` returns the system's actual state — not the state you just set. In development mode (unsigned, running as Electron binary), macOS may not actually register the login item, so `getLoginItemSettings().openAtLogin` returns `false` even after setting it. The test should assert that `setLoginItemSettings` was called with the correct arguments (mock/spy), NOT that `getLoginItemSettings` reflects it. Round-trip verification only works on a signed packaged build in production.

---

## Relevant Files

- [../lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md)
- [../recipes/recipe-tray-with-template-image.md](../recipes/recipe-tray-with-template-image.md)
- [../recipes/recipe-notification-with-failed-listener.md](../recipes/recipe-notification-with-failed-listener.md)
- [../recipes/recipe-global-shortcut-with-cleanup.md](../recipes/recipe-global-shortcut-with-cleanup.md)
- [../recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md)
- [../checklists/deep-macos-integration-checklist.md](../checklists/deep-macos-integration-checklist.md)
