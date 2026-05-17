# Lab 01 — Hello Electron

**Goal**: Build a minimal Electron app from scratch with secure defaults, a preload bridge, and a structured logger.

**Prerequisites**: [lessons/01-three-process-model.md](../lessons/01-three-process-model.md), [lessons/02-secure-renderer-defaults.md](../lessons/02-secure-renderer-defaults.md)

**Duration**: ~20 minutes

**POC Reference**: [examples/example-l1-minimal-app.md](../examples/example-l1-minimal-app.md)

## Setup

```bash
mkdir hello-electron && cd hello-electron
npm init -y
npm install --save-dev electron@42.1.0 typescript @types/node esbuild
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "commonjs",
    "moduleResolution": "node", "outDir": "dist",
    "strict": true, "esModuleInterop": true
  },
  "include": ["src/**/*.ts"]
}
```

## Steps

### 1. Create src/log.ts

Implement the synchronous JSON-lines logger from [recipes/recipe-structured-jsonl-logger.md](../recipes/recipe-structured-jsonl-logger.md).

### 2. Create src/window.ts

Implement the secure BrowserWindow factory from [recipes/recipe-secure-window.md](../recipes/recipe-secure-window.md):
- `SECURE_WEB_PREFERENCES` constant with all four flags
- `createMainWindow()` that spreads it

### 3. Create src/preload.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron'
// No require('./anything') — G-01

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
})
```

### 4. Create src/renderer/index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'">
  <title>Hello Electron</title>
</head>
<body>
  <h1 id="heading">Hello Electron</h1>
  <button id="ping">Ping Main</button>
  <div id="result"></div>
  <script src="renderer.js"></script>
</body>
</html>
```

### 5. Create src/renderer/renderer.ts

```typescript
const btn = document.getElementById('ping')!
const result = document.getElementById('result')!
btn.addEventListener('click', async () => {
  const res = await (window as any).api.ping()
  result.textContent = `ts: ${res.ts}`
})
```

### 6. Create src/main.ts

```typescript
import { app, ipcMain } from 'electron'
import { createLogger } from './log'
import { createMainWindow } from './window'

const logger = createLogger('main')
logger.info('app:starting', {})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

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

### 7. Add build scripts

```json
{
  "main": "dist/main.js",
  "scripts": {
    "build:main": "tsc -p tsconfig.json",
    "build:preload": "esbuild src/preload.ts --bundle --platform=node --external:electron --outfile=dist/preload.js",
    "build:renderer": "esbuild src/renderer/renderer.ts --bundle --outfile=dist/renderer/renderer.js && cp src/renderer/index.html dist/renderer/",
    "build": "mkdir -p dist/renderer && npm run build:main && npm run build:preload && npm run build:renderer",
    "start": "npm run build && electron dist/main.js"
  }
}
```

### 8. Run it

```bash
npm run start
```

## Verify

- Window opens with "Hello Electron" heading
- Click "Ping Main" → timestamp appears in `#result`
- Check `logs/main.log` — should contain lines with `app:starting`, `app:ready`, `window:created`, `ipc:app:ping:served`

```bash
cat logs/main.log | while IFS= read -r line; do echo "$line" | python3 -m json.tool; done
```

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `window.api` is undefined | Preload crashed silently | Check that preload is bundled with esbuild |
| White screen | `loadFile` path wrong | Verify `dist/renderer/index.html` exists |
| No log file | `dist/` doesn't exist | Run `npm run build` before `electron` |
| TSC errors on preload | `require()` type not available | Use esbuild instead of tsc for preload |

See [troubleshooting/white-screen.md](../troubleshooting/white-screen.md) for deeper diagnosis.

Evidence: [recipes/recipe-secure-window.md](../recipes/recipe-secure-window.md), [recipes/recipe-structured-jsonl-logger.md](../recipes/recipe-structured-jsonl-logger.md), `../../03_pocs/L1-hello-electron/`
