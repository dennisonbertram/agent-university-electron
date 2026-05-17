# Quickstart — Electron App in 5 Minutes

This page gets a secure, working Electron app on screen. It omits everything optional.

## Prerequisites

- Node.js 20+ installed
- macOS (some steps are macOS-specific)

## Step 1 — Scaffold

```bash
mkdir my-app && cd my-app
npm init -y
npm install --save-dev electron@42.1.0 typescript @types/node
npm install --save-dev esbuild
```

## Step 2 — tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

## Step 3 — src/log.ts (synchronous logger)

```typescript
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs')
mkdirSync(LOG_DIR, { recursive: true })

export function createLogger(module: string, proc: string = 'main') {
  const logPath = path.join(LOG_DIR, `${proc}.log`)
  const write = (level: string, event: string, payload?: object) => {
    const entry = { ts: new Date().toISOString(), level, process: proc, module, event, payload }
    appendFileSync(logPath, JSON.stringify(entry) + '\n')
  }
  return {
    info: (e: string, p?: object) => write('info', e, p),
    warn: (e: string, p?: object) => write('warn', e, p),
    error: (e: string, p?: object) => write('error', e, p),
  }
}
```

## Step 4 — src/window.ts (secure BrowserWindow factory)

```typescript
import { BrowserWindow } from 'electron'
import path from 'node:path'

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
} as const

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  void win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  return win
}
```

## Step 5 — src/preload.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron'

// IMPORTANT: No require('./anything') under sandbox:true — G-01
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
})
```

## Step 6 — src/main.ts

```typescript
import { app, ipcMain } from 'electron'
import { createLogger } from './log'
import { createMainWindow } from './window'

const logger = createLogger('main')

// Pre-ready: single-instance lock (always do this first)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.whenReady().then(() => {
  logger.info('app:ready', {})

  ipcMain.handle('app:ping', () => {
    logger.info('ipc:app:ping:served', {})
    return { ts: Date.now() }
  })

  createMainWindow()
  logger.info('window:created', {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

## Step 7 — src/renderer/index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'">
  <title>My App</title>
</head>
<body>
  <h1>Hello Electron</h1>
  <button id="ping">Ping</button>
  <div id="result"></div>
  <script src="renderer.js"></script>
</body>
</html>
```

## Step 8 — src/renderer/renderer.ts

```typescript
// No Node, no require — renderer is a Chromium page
document.getElementById('ping')?.addEventListener('click', async () => {
  const result = await (window as Window & { api: { ping(): Promise<{ ts: number }> } }).api.ping()
  document.getElementById('result')!.textContent = `ts: ${result.ts}`
})
```

## Step 9 — Build script in package.json

```json
{
  "scripts": {
    "build:main": "tsc -p tsconfig.json",
    "build:preload": "esbuild src/preload.ts --bundle --platform=node --external:electron --outfile=dist/preload.js",
    "build:renderer": "esbuild src/renderer/renderer.ts --bundle --outfile=dist/renderer/renderer.js && cp src/renderer/index.html dist/renderer/index.html",
    "build": "npm run build:main && npm run build:preload && npm run build:renderer",
    "start": "npm run build && electron dist/main.js"
  }
}
```

## Step 10 — Run it

```bash
npm run start
```

You should see a window with a "Ping" button. Click it; the timestamp from main appears.

## What You Just Got

- Secure defaults: `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`
- Preload bundled with esbuild (avoids the sandbox require() gotcha — G-01)
- Single-instance lock at module scope (not inside whenReady)
- Structured JSON log at `logs/main.log`
- CSP blocks inline scripts

## What to Read Next

- [lessons/01-three-process-model.md](./lessons/01-three-process-model.md) — why the three-process split matters
- [lessons/02-secure-renderer-defaults.md](./lessons/02-secure-renderer-defaults.md) — full security story
- [lessons/03-ipc-patterns-and-validation.md](./lessons/03-ipc-patterns-and-validation.md) — the IPC registry pattern
- [curriculum.md](./curriculum.md) — recommended reading order

Evidence: `../../05_distillation/patterns/P-01-secure-browserwindow-defaults.md`, `../../05_distillation/patterns/P-06-pre-ready-boot-ordering.md`, `../../05_distillation/gotchas/G-01-sandbox-preload-cannot-require-relative-files.md`
