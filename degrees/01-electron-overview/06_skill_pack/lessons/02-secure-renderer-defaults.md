# Lesson 02 — Secure Renderer Defaults

**Prerequisites**: [01-three-process-model.md](./01-three-process-model.md)  
**Next**: [03-ipc-patterns-and-validation.md](./03-ipc-patterns-and-validation.md)

## The Four Non-Negotiable Flags

Every BrowserWindow MUST have these four webPreferences:

```typescript
export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,   // Renderer JS cannot access preload scope
  sandbox: true,            // Renderer and preload are OS-sandboxed
  nodeIntegration: false,   // Renderer has no Node.js
  webSecurity: true,        // Same-origin policy enforced
} as const
```

Changing any of these is a security regression. Document the reason and add a regression test if you must deviate.

## The Factory Pattern

Never call `new BrowserWindow(opts)` with custom webPreferences scattered across files. Use one factory:

```typescript
// src/window.ts
import { BrowserWindow } from 'electron'
import path from 'node:path'

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
} as const

export function createMainWindow(opts: { width?: number; height?: number } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: opts.width ?? 1024,
    height: opts.height ?? 768,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  void win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  return win
}
```

Regression test — grep for any BrowserWindow instantiation outside the factory:

```typescript
test('no BrowserWindow outside window.ts', () => {
  const src = readFileSync('src/main.ts', 'utf8')
  expect(src).not.toMatch(/new BrowserWindow\(/)
})
```

## Content Security Policy

Add a CSP meta tag to every renderer HTML:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'">
```

- No `unsafe-inline` in `script-src` — it enables XSS through inline `<script>`.
- No `unsafe-eval` — it enables eval-based code injection.
- No remote origins (no `https://cdn.example.com`) — load all content from `'self'`.

## Navigation Guards

A renderer page that navigates to an external URL has escaped the sandbox. Block it:

```typescript
// src/security.ts — call this once after window creation
import { BrowserWindow } from 'electron'

export function installNavigationGuards(win: BrowserWindow, logger: Logger): void {
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      logger.warn('security:will-navigate:blocked', { url })
    }
  })
  win.webContents.on('will-redirect', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      logger.warn('security:will-redirect:blocked', { url })
    }
  })
  win.webContents.setWindowOpenHandler((_details) => {
    logger.warn('security:window-open:blocked', {})
    return { action: 'deny' }
  })
}
```

## Permission Request Handler

Deny all permission requests by default:

```typescript
import { session } from 'electron'

session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
  logger.warn('security:permission-denied', { permission })
  callback(false)
})
```

Selectively allow only what your app needs (e.g., `notifications` if you use them).

## IPC Sender Validation

For sensitive IPC channels, verify the sender is your own renderer:

```typescript
ipcMain.handle('secure:channel', async (event, arg) => {
  const url = event.senderFrame?.url ?? ''
  if (!url.startsWith('file://')) {
    logger.warn('ipc:secure:sender-rejected', { url })
    throw new Error('Rejected: unexpected sender')
  }
  // proceed
})
```

## What contextIsolation Does

Without `contextIsolation: true`, the preload and renderer share a JavaScript context. A malicious renderer script can reach preload globals (like `ipcRenderer`) directly.

With `contextIsolation: true`, preload runs in an isolated context. The only thing visible to renderer JS is what `contextBridge.exposeInMainWorld` explicitly exposes.

```
contextIsolation: false (WRONG)          contextIsolation: true (CORRECT)
┌──────────────────────┐                 ┌──────────────────────┐
│ preload scope        │                 │ preload scope         │
│   ipcRenderer ←──── │── attacker      │   ipcRenderer        │
│   window.api         │  can reach     │   window.api         │
└──────────────────────┘                 └──── contextBridge ───┘
│ renderer scope       │                 │ renderer scope        │
│   window.api.ping()  │                 │   window.api.ping()  │
└──────────────────────┘                 └──────────────────────┘
```

## What NOT to Do

```typescript
// WRONG — exposes full ipcRenderer to renderer
contextBridge.exposeInMainWorld('electron', { ipcRenderer })

// WRONG — lets renderer send arbitrary channels
contextBridge.exposeInMainWorld('api', {
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args)
})

// CORRECT — narrow named wrappers only
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
  appendEntry: (text: string) => ipcRenderer.invoke('journal:append', { text }),
})
```

## Fuses (Packaged Builds)

After packaging, apply binary fuses to harden the executable:

```typescript
// forge.config.ts
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,                       // can't be used as node interpreter
  [FuseV1Options.EnableCookieEncryption]: true,           // cookies encrypted at rest
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // blocks NODE_OPTIONS
  [FuseV1Options.EnableNodeCliInspectArguments]: false,   // blocks --inspect
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // asar hash check
  [FuseV1Options.OnlyLoadAppFromAsar]: true,              // blocks sideloading
})
```

See [lessons/08-packaging-with-electron-forge.md](./08-packaging-with-electron-forge.md) for the full forge config.

## Key Takeaways

1. Four flags are non-negotiable: `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`, `webSecurity:true`.
2. Use one factory function for all BrowserWindow creation.
3. CSP blocks inline script/style; never add `unsafe-inline`.
4. Navigation guards prevent renderers from escaping to external URLs.
5. `contextBridge` exposes named functions, never raw `ipcRenderer`.
6. Fuses harden the packaged binary against abuse as a node interpreter.

Evidence: `../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`, `../../05_distillation/anti-patterns/AP-01-nodeintegration-true-in-renderer.md`, `../../05_distillation/anti-patterns/AP-02-exposing-ipcrenderer-via-contextbridge.md`, `../../01_research/05-security-model.md`
