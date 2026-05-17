# Glossary — Electron

Cross-degree definitions. Terms specific to a single POC level live in that POC's README.

> **Status**: Stub. To be populated during Phase 1 research and refined after each POC. Every term added must trace to a research file or log entry.

## Processes

- **Main process** — Single Node.js process per Electron app; owns app lifecycle, BrowserWindow management, native module access, OS integration APIs (Tray, Notification, globalShortcut, powerMonitor, app, dialog, Menu).
- **Renderer process** — Chromium-backed process running web content per BrowserWindow / WebContents. Sandboxed in modern Electron.
- **Preload script** — Script loaded in the renderer's isolated world before the page scripts run; only place that should expose APIs to the renderer via `contextBridge.exposeInMainWorld`.
- **Utility process** — Child Node.js process spawned via `utilityProcess.fork`, useful for offloading work without bringing up a renderer.

## IPC Surface

- **`contextBridge`** — Renderer-side API for exposing a curated, serializable surface from the preload script into the renderer's main world.
- **`ipcMain` / `ipcRenderer`** — Channel-based message passing between main and renderer. Patterns: `invoke/handle` (request/response, recommended), `send/on` (fire-and-forget), `sendSync/onSync` (anti-pattern: blocks renderer).
- **`MessagePort`** — Lower-level structured-cloneable port pair for high-throughput communication.

## Security

- **`contextIsolation: true`** — Renderer's main world is isolated from preload's world; required for safe API exposure.
- **`sandbox: true`** — Renderer runs in a Chromium sandbox; preload has limited Node access; required for hardened apps.
- **`nodeIntegration: false`** — Renderer cannot `require` Node modules directly. Always `false` in modern apps.
- **Content Security Policy (CSP)** — Browser-enforced policy declaring what resources may load; mitigates XSS in renderer.

## OS Integration

- **Tray / Status bar item** — Persistent icon in the macOS menu bar (status bar) created via the `Tray` class. Uses *template images* (`*Template.png`) to auto-adapt to light/dark mode.
- **`Notification`** — Native OS notification surface; supports action buttons, reply input, click handlers.
- **`globalShortcut`** — Register OS-wide keyboard shortcuts (active even when app is not focused).
- **`powerMonitor`** — Emits `suspend`, `resume`, `on-ac`, `on-battery`, `lock-screen`, `unlock-screen`, `idle` events.
- **Deep link / URL scheme** — Custom protocol (e.g., `pulse://`) registered via `app.setAsDefaultProtocolClient`.

## Packaging

- **electron-forge** — Modern toolchain (CLI + plugins) for build, package, publish.
- **electron-builder** — Alternative toolchain; richer auto-update story historically; more config-heavy.
- **Squirrel.Mac** — Auto-update framework used by macOS Electron apps.
- **Notarization** — Apple's post-signing review step required for Gatekeeper to launch the app without warnings.

(more terms added as research progresses)
