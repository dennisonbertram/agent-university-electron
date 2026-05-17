# Assessment 02 — Security

Tests understanding of Electron security: BrowserWindow defaults, CSP, navigation guards, IPC security, and fuses.

Back to [../index.md](../index.md) | [assessment-01-process-model.md](./assessment-01-process-model.md) | [assessment-03-ipc.md](./assessment-03-ipc.md)

---

## Questions

**Q1.** List the four required `webPreferences` flags for every `BrowserWindow` and explain why each is required.

**Q2.** A developer creates two BrowserWindows: one in `src/window.ts` via a factory, and one inline in `src/main.ts` with `new BrowserWindow({ ...options })`. What invariant does this break, and what static check catches it?

**Q3.** What is the purpose of the `will-navigate` event handler? What does it protect against that CSP alone cannot?

**Q4.** Write the `setWindowOpenHandler` call that blocks all `window.open()` calls from the renderer and logs a security event.

**Q5.** A renderer makes this request:
```javascript
navigator.permissions.query({ name: 'camera' })
```
With a properly configured `session.setPermissionRequestHandler`, what happens and what is logged?

**Q6.** Why can't the CSP be set using `session.defaultSession.webRequest.onHeadersReceived`? When would you use `session` vs. meta tag for CSP?

**Q7.** Name all 6 Electron fuses that must be set for production and explain what each prevents.

**Q8.** A test in your CI pipeline calls a `test:*` IPC channel with `NODE_ENV=production`. What should happen and why?

---

## Answer Key

**A1.**
- `contextIsolation: true` — Required: preload and renderer run in separate JavaScript contexts. Without it, renderer code can access the preload's Node.js scope.
- `sandbox: true` — Required: renderer process runs in Chromium's sandbox with minimal OS privileges. Limits damage if renderer is compromised.
- `nodeIntegration: false` — Required: prevents renderer from calling Node.js APIs directly. Renderers must use IPC.
- `webSecurity: true` — Required: enforces same-origin policy and prevents loading resources from arbitrary URLs.

**A2.** Breaks the "all BrowserWindows created through one factory" invariant. The factory (`createMainWindow()`) applies `SECURE_WEB_PREFERENCES` const to every window. A direct `new BrowserWindow()` call may omit or override security options. Static check: `grep -r 'new BrowserWindow(' src/ --include='*.ts'` — result must only match `src/window.ts`.

**A3.** `will-navigate` intercepts programmatic navigations (e.g., `location.href = 'https://evil.com'` from a compromised renderer). CSP prevents loading/executing external scripts, but it does not prevent navigation away from the local `file://` page. The guard blocks any navigation attempt to non-`file://` URLs, logs a security event, and prevents the renderer from loading arbitrary remote content.

**A4.**
```typescript
win.webContents.setWindowOpenHandler(({ url }) => {
  logger.warn({ event: 'security:window-open:denied', url })
  return { action: 'deny' }
})
```

**A5.** The `session.setPermissionRequestHandler` is called with `permission = 'media'` (or `'camera'`). The handler calls `callback(false)` to deny, logs `security:permission-denied` with the permission name and requesting URL. The `navigator.permissions.query` Promise resolves with `{ state: 'denied' }` in the renderer.

**A6.** `session.webRequest.onHeadersReceived` works for network-loaded resources but NOT for `loadFile()` which uses the `file://` protocol and has no HTTP response headers. Use the HTML meta tag for file-loaded apps. The meta tag is always present regardless of how the page loads. `session` approach is appropriate for `loadURL()` with a dev server.

**A7.**
1. `RunAsNode: false` — prevents `ELECTRON_RUN_AS_NODE=1` from turning the app into a Node.js REPL
2. `EnableCookieEncryption: true` — encrypts cookies at rest in the OS keychain
3. `EnableNodeOptionsEnvironmentVariable: false` — prevents `NODE_OPTIONS=--inspect` from enabling a debugger
4. `EnableNodeCliInspectArguments: false` — prevents `--inspect`, `--inspect-brk` flags from enabling a debugger
5. `EnableEmbeddedAsarIntegrityValidation: true` — validates asar hash at launch; prevents content tampering
6. `OnlyLoadAppFromAsar: true` — prevents loading app code from non-asar paths; blocks asar bypass attacks

**A8.** The call should reject with `Error: No handler registered for 'test:...'`. Because `testHooksEnabled()` returns `false` when `NODE_ENV=production`, the test channels are never registered with `ipcMain`. The renderer-side invoke Promise rejects with Electron's standard "no handler" error. This is the correct behavior and should be verified by a test in the suite.

---

## Relevant Files

- [../lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md)
- [../recipes/recipe-secure-window.md](../recipes/recipe-secure-window.md)
- [../reference/fuses-reference.md](../reference/fuses-reference.md)
- [../checklists/security-checklist.md](../checklists/security-checklist.md)
