# Security Checklist — Electron App

Verify every item before shipping. Each has a `how-to-verify` column.

## BrowserWindow Defaults

| # | Item | How to Verify |
|---|---|---|
| 1 | `contextIsolation: true` in every BrowserWindow | Grep `src/` for `new BrowserWindow(` outside factory; static check `SECURE_WEB_PREFERENCES` |
| 2 | `sandbox: true` in every BrowserWindow | Same as above |
| 3 | `nodeIntegration: false` in every BrowserWindow | Same as above |
| 4 | `webSecurity: true` in every BrowserWindow | Same as above |
| 5 | All BrowserWindows created through one factory (`createMainWindow`) | Grep for `new BrowserWindow(` outside `src/window.ts` |

## Content Security Policy

| # | Item | How to Verify |
|---|---|---|
| 6 | Strict CSP meta tag in every HTML: no `unsafe-inline`, no `unsafe-eval` in `script-src` | Open DevTools → Console → trigger inline `<script>` → expect CSP violation |
| 7 | No remote HTTPS content loaded in main BrowserWindow | Grep `loadFile`/`loadURL` calls — only `file://` |

## Navigation Guards

| # | Item | How to Verify |
|---|---|---|
| 8 | `will-navigate` blocks non-`file://` navigation | E2E test: navigate to `https://example.com` from renderer; assert `security:will-navigate:blocked` logged |
| 9 | `setWindowOpenHandler` returns `{ action: 'deny' }` | E2E test: call `window.open('https://example.com')`; assert no new window + security log fires |
| 10 | `will-redirect` guard parallel to `will-navigate` | Static source check in `security.ts` |

## IPC

| # | Item | How to Verify |
|---|---|---|
| 11 | Every IPC channel in `IPC_REGISTRY` with a validator | Grep for `ipcMain.handle(` outside `registerIpc` function |
| 12 | Validators emit `ipc:<ch>:validation-failed` log on rejection | E2E test: send invalid arg; grep log |
| 13 | `ipcRenderer` NOT exposed directly via contextBridge | Static check: `contextBridge.exposeInMainWorld` value is object with named functions only |
| 14 | No `ipcRenderer.sendSync` calls | Grep `src/` for `sendSync` — expected: 0 results |
| 15 | Sensitive channel validates sender origin | Code review: `event.senderFrame?.url.startsWith('file://')` in sensitive handlers |

## Permission Handler

| # | Item | How to Verify |
|---|---|---|
| 16 | `session.setPermissionRequestHandler` denies by default | E2E test: request camera permission; assert `false` returned + log fired |

## Fuses (Packaged Builds Only)

| # | Item | How to Verify |
|---|---|---|
| 17 | `RunAsNode: false` | Static check `forge.config.ts`; runtime: `ELECTRON_RUN_AS_NODE=1 ./MyApp.app/...` should fail |
| 18 | `EnableNodeOptionsEnvironmentVariable: false` | Static check |
| 19 | `EnableNodeCliInspectArguments: false` | Static check |
| 20 | `EnableCookieEncryption: true` | Static check |
| 21 | `OnlyLoadAppFromAsar: true` | Static check |
| 22 | `EnableEmbeddedAsarIntegrityValidation: true` | Static check |

## Code Signing (Packaged Builds)

| # | Item | How to Verify |
|---|---|---|
| 23 | `osxSign` conditional on `HAS_APPLE_CREDS` | Static check in `forge.config.ts` |
| 24 | `hardenedRuntime: true` in sign options | Static check |
| 25 | Entitlements include `allow-jit` and `disable-library-validation` | `codesign --display --entitlements - <App>.app` |

## Test-Seam Hygiene

| # | Item | How to Verify |
|---|---|---|
| 26 | All `test:*` IPC channels gated by `testHooksEnabled()` | Static check in `ipc.ts`: registration inside `if (testHooksEnabled())` |
| 27 | `testHooksEnabled()` returns false in production builds | E2E test: invoke `test:*` channel with `NODE_ENV=production`; assert rejects with "No handler registered" |

Back to [../index.md](../index.md)

Evidence: `../../05_distillation/security-checklist.md`, `../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../05_distillation/patterns/P-14-fuses-hardening-for-production.md`
