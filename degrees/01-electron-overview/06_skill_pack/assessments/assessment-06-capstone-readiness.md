# Assessment 06 — Capstone Readiness

Comprehensive assessment covering all skill pack topics. Pass this before building a production Electron app.

Back to [../index.md](../index.md) | [assessment-05-packaging-and-update.md](./assessment-05-packaging-and-update.md)

---

## Scenario

You are building a macOS menu-bar app called **Memo** that:
- Lives in the menu bar (no Dock icon)
- Has a frameless popover window that appears when the tray icon is clicked
- Stores notes in SQLite with safeStorage row-level encryption
- Supports `memo://open/<note-id>` deep links
- Checks for updates automatically
- Has full Playwright test coverage

Answer the questions below as if you are implementing Memo from scratch.

---

## Questions

**Q1. Boot order.** Write the first 10 lines of `src/main.ts` in the correct order. Include: `crashReporter.start()`, `requestSingleInstanceLock()`, `setAsDefaultProtocolClient()`, `open-url` listener, `app.whenReady()`, `dock.hide()`, `createPopoverWindow()`, `installTray()`, `registerIpc()`.

**Q2. Security audit.** A code reviewer finds this in `src/window.ts`:
```typescript
const win = new BrowserWindow({
  frame: false,
  webPreferences: { nodeIntegration: true, contextIsolation: false }
})
```
List every problem and write the corrected webPreferences.

**Q3. Test strategy.** You need to test that clicking the tray icon toggles the popover window (show/hide). The popover is positioned under the tray icon using `tray.getBounds()`. Write the test plan: (a) what Playwright APIs are used, (b) how you trigger the click without needing a real tray, (c) what log markers you assert.

**Q4. Persistence.** Memo needs to save notes. A note has `id`, `title`, `body` (encrypted), `created_at`. Design: (a) schema for the SQLite table, (b) how `body` is encrypted at rest, (c) what happens on first launch before safeStorage is initialized.

**Q5. Deep link routing.** `memo://open/abc123` should open note `abc123`. Write `parseDeepLink()` for the Memo scheme. It should throw for: wrong scheme, missing note ID, non-alphanumeric note IDs.

**Q6. Update server.** You're testing auto-update locally. Describe every file that must exist and every configuration that must be set to make `autoUpdater.checkForUpdatesAndNotify()` fire `update-available` in a development build. Include fixture file content.

**Q7. Pre-ship checklist.** Before shipping Memo 1.0.0, name 5 items that must be verified in the packaged, signed build (not in development). For each, state the verification command or procedure.

**Q8. Gotcha review.** For each of these code snippets, identify the bug and fix it:

a.
```typescript
async function createTray() {
  const tray = new Tray('icon.png')
  tray.setContextMenu(buildMenu())
}
```

b.
```typescript
app.whenReady().then(() => {
  app.setAsDefaultProtocolClient('memo')
  app.on('open-url', (e, url) => handleDeepLink(url))
})
```

c.
```typescript
autoUpdater.forceDevUpdateConfig = true
```

d.
```typescript
notification.show()
notification.on('failed', (_e, err) => logger.error({ event: 'notification:failed', err }))
```

---

## Answer Key

**A1.** Correct boot order:
```typescript
import { crashReporter, app } from 'electron'
import { startCrashReporter } from './crash'          // line 3: crash first
import { registerIpc } from './ipc'

startCrashReporter()                                   // 1: BEFORE everything

const gotLock = app.requestSingleInstanceLock()        // 2: pre-ready
if (!gotLock) { app.quit(); process.exit(0) }

app.setAsDefaultProtocolClient('memo')                 // 3: pre-ready

app.on('open-url', (event, url) => {                   // 4: pre-ready listener
  event.preventDefault()
  handleDeepLink(url)
})

app.whenReady().then(() => {                           // 5: whenReady
  if (process.platform === 'darwin') app.dock.hide()  // 6: before window
  const win = createPopoverWindow()                    // 7: window
  installTray(win)                                     // 8: tray
  registerIpc(ipcMain, { /* ctx */ })                  // 9: IPC
})
```

**A2.** Problems: (1) `nodeIntegration: true` — renderer has direct Node.js access; critical security hole; (2) `contextIsolation: false` — preload and renderer share the same JS context; renderer can modify preload's scope; (3) Missing `sandbox: true`; (4) Missing `webSecurity: true`; (5) Missing `preload` path.

Corrected:
```typescript
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  preload: path.join(__dirname, 'preload.js'),
}
```

**A3.** Test plan:
- (a) Playwright APIs: `electron.launch()`, `electronApp.evaluate()` to call into main process, `expect.poll()` for async log assertions. No `page.click()` on tray (not in DOM).
- (b) Trigger via test seam IPC: expose `tray:toggle` in `TEST_REGISTRY`; Playwright calls `window.api.testToggleTray()` which calls `togglePopover()` directly without needing a tray click.
- (c) Log markers to assert: `window:shown` after first toggle call, `window:hidden` after second toggle call. Static regression: `^let trayInstance` at module scope in `src/tray.ts`.

**A4.**
- (a) Schema: `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, body_encrypted BLOB NOT NULL, created_at INTEGER NOT NULL)`
- (b) `body` is encrypted: `const encryptor = buildEncryptor(safeStorage)`; `body_encrypted = encryptor.encrypt(body)`. On read: `body = encryptor.decrypt(row.body_encrypted)`.
- (c) On first launch: `safeStorage.isEncryptionAvailable()` may return `false` if the OS keychain is not accessible. Implement a fallback: store `body_encrypted` as plaintext with a `is_encrypted: 0` flag, and re-encrypt on next launch when safeStorage is available.

**A5.**
```typescript
interface ParsedMemoLink {
  scheme: 'memo'
  action: 'open'
  noteId: string
}

export function parseDeepLink(url: string): ParsedMemoLink {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error(`invalid URL: ${url}`) }

  if (parsed.protocol !== 'memo:') throw new Error(`wrong scheme: ${parsed.protocol}`)
  if (parsed.hostname !== 'open') throw new Error(`unknown action: ${parsed.hostname}`)

  const noteId = parsed.pathname.slice(1)  // remove leading /
  if (!noteId) throw new Error('missing note ID')
  if (!/^[a-zA-Z0-9_-]+$/.test(noteId)) throw new Error(`invalid note ID: ${noteId}`)

  return { scheme: 'memo', action: 'open', noteId }
}
```

**A6.** Required files and config:
- `dev-app-update.yml` in project root: `provider: generic\nurl: http://localhost:8080`
- `fixtures/latest-mac.yml`: version must be higher than app's package.json version (e.g., `9.9.9`), valid sha512, valid file entry
- `local-update-server.mjs`: HTTP server stripping `?noCache` query, serving files from `fixtures/`
- In `src/updater.ts`: `(autoUpdater as any).forceDevUpdateConfig = true` BEFORE `checkForUpdatesAndNotify()`
- App must be started with `NODE_ENV=test` (or test hooks enabled)
- Server must be running on port 8080 before the app checks

**A7.** Five pre-ship verifications:
1. `codesign --verify --deep --strict Memo.app` → exit 0 (code signature valid)
2. `xcrun stapler validate Memo.app` → "The validate action worked!" (notarization ticket stapled)
3. `spctl --assess --type exec --verbose Memo.app` → "accepted" (Gatekeeper passes)
4. `npx @electron/asar list Memo.app/Contents/Resources/app.asar | grep '\.ts$'` → empty (no source files)
5. `npx @electron/fuses read --app Memo.app` → all 6 fuses show correct state

**A8.**
- (a) Bug: `tray` is a local variable in `createTray()`. V8 garbage-collects it when the function returns. Fix: `let trayInstance: Tray | null = null` at module scope; assign `trayInstance = new Tray(...)` inside the function.

- (b) Bug: `setAsDefaultProtocolClient` and the `open-url` listener are INSIDE `whenReady`. Cold-start deep links are missed. Fix: move both to before `app.whenReady()` at the top level of `main.ts`.

- (c) Bug: TypeScript type error — `forceDevUpdateConfig` is not in the `electron-updater` type definitions. Fix: `(autoUpdater as any).forceDevUpdateConfig = true`.

- (d) Bug: `notification.show()` is called BEFORE the `failed` listener is attached. On unsigned apps, `failed` may fire synchronously during `show()`, before the listener is registered. Fix: attach `failed` (and other event listeners) BEFORE calling `.show()`.

---

## Relevant Files

All sections of this skill pack apply. Start from [../index.md](../index.md) if any answer was unclear.

- [../checklists/production-readiness-checklist.md](../checklists/production-readiness-checklist.md)
- [../checklists/security-checklist.md](../checklists/security-checklist.md)
- [../labs/lab-10-capstone-menu-bar-app.md](../labs/lab-10-capstone-menu-bar-app.md)
- [../examples/example-capstone-pulse.md](../examples/example-capstone-pulse.md)
