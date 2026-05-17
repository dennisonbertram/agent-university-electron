# Testing Strategies — Electron

Version: Electron 42.1.0, vitest 4.1.6, playwright 1.60.0 [S20, S32]

## Recommended Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Unit tests (main process logic) | vitest | Fast, no Electron required for pure logic |
| Integration tests (IPC handlers) | vitest + electron-mocha OR manual | Requires Electron runtime |
| End-to-end (full app) | Playwright with `_electron` | Full app launch, window interaction |
| Native module tests | vitest (system Node ABI) | Separate from Electron-ABI tests |

## Unit Testing with Vitest (Main Process Logic)

For pure business logic that doesn't require Electron:

```typescript
// src/session.ts — testable without Electron
export interface Session {
  durationMs: number
  startedAt: number
  pausedMs: number
  state: 'idle' | 'running' | 'paused'
}

export function startSession(durationMinutes: number): Session {
  return {
    durationMs: durationMinutes * 60_000,
    startedAt: Date.now(),
    pausedMs: 0,
    state: 'running',
  }
}

export function remainingMs(session: Session): number {
  if (session.state === 'idle') return session.durationMs
  const elapsed = Date.now() - session.startedAt - session.pausedMs
  return Math.max(0, session.durationMs - elapsed)
}
```

```typescript
// tests/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startSession, remainingMs } from '../src/session'

describe('session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('Given 25 minutes, when session starts, then remainingMs equals 25 minutes', () => {
    const session = startSession(25)
    expect(remainingMs(session)).toBe(25 * 60_000)
  })

  it('Given 5 minutes elapsed, when remainingMs called, then shows 20 minutes left', () => {
    const session = startSession(25)
    vi.advanceTimersByTime(5 * 60_000)
    expect(remainingMs(session)).toBeCloseTo(20 * 60_000, -2)
  })
})
```

vitest config:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
})
```

## Electron IPC Testing Challenge

PROBLEM: `ipcMain.handle` and Electron-specific modules cannot be imported in a plain vitest/node environment. They require the actual Electron runtime.

SOLUTIONS:

### Option A: Dependency Injection (recommended)

Separate business logic from IPC wiring. Test logic with vitest, wire in Electron separately.

```typescript
// src/journal.ts — pure logic, no Electron imports
export class JournalService {
  constructor(private readonly dbPath: string) {}

  async appendEntry(text: string): Promise<{ id: number }> {
    // ... SQLite logic
  }
}

// src/ipc.ts — IPC wiring, NOT unit-tested directly
import { ipcMain } from 'electron'
import { JournalService } from './journal'

export function registerJournalIpc(journal: JournalService): void {
  ipcMain.handle('journal:append', async (_event, text: string) => {
    return journal.appendEntry(text)
  })
}
```

### Option B: electron-mocha

```bash
npm install --save-dev electron-mocha @types/mocha
```

Runs tests inside Electron's Node environment — full `ipcMain` available. Slower than vitest (must launch Electron).

### Option C: Mock Electron modules in vitest

```typescript
// vitest.setup.ts
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/test') },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
}))
```

Useful for testing IPC registration without launching Electron. Does not test runtime behavior.

## End-to-End with Playwright `_electron`

### Setup

```typescript
// tests/e2e/app.test.ts
import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'node:path'

let electronApp: ElectronApplication
let window: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../.vite/build/main.js')],
    // For packaged app:
    // executablePath: path.join(__dirname, '../../out/darwin-arm64/My App.app/Contents/MacOS/My App'),
  })

  // Wait for first window
  window = await electronApp.firstWindow()

  // Optional: eval in main process
  const appPath = await electronApp.evaluate(async ({ app }) => app.getAppPath())
  console.log('App path:', appPath)
})

test.afterAll(async () => {
  await electronApp.close()
})

test('Given the app launches, when ready, then a window is visible', async () => {
  expect(window).toBeTruthy()
  await expect(window).toHaveTitle(/My App/)
})

test('Given the renderer loads, when ping called, then responds with timestamp', async () => {
  const result = await window.evaluate(() => window.api.ping())
  expect(result.ts).toBeGreaterThan(0)
})
```

[S20]

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    // screenshot on failure
    screenshot: 'only-on-failure',
  },
  reporter: [['line'], ['html', { open: 'never' }]],
})
```

### Playwright with Packaged App

```typescript
electronApp = await electron.launch({
  executablePath: path.join(
    __dirname,
    '../../out/My App-darwin-arm64/My App.app/Contents/MacOS/My App'
  ),
})
```

## Playwright Gotchas [S20]

1. **Experimental API** — `_electron` is under Playwright experimental; APIs may change
2. **Window event timing** — `'window'` event fires after window LOADS, not after creation; `firstWindow()` with timeout 30s
3. **evaluate() context** — runs in main process, not renderer; access renderer via `Page` object
4. **`evaluate()` serialization** — non-serializable returns become `undefined`; use `evaluateHandle()` to keep references
5. **Always close** — `electronApp.close()` must be called; otherwise Electron stays running in background
6. **Renderer console vs main console** — `'console'` event on ElectronApplication is main-process only; use `window.on('console', ...)` for renderer logs
7. **macOS runner required** — for full e2e with macOS-specific APIs (notifications, Touch ID, Tray)

## Testing Native Module Availability

```typescript
// tests/native.test.ts
import { describe, it, expect } from 'vitest'

describe('better-sqlite3', () => {
  it('loads without error', () => {
    expect(() => require('better-sqlite3')).not.toThrow()
  })

  it('creates in-memory database', () => {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (x TEXT)')
    const stmt = db.prepare('INSERT INTO t VALUES (?)')
    stmt.run('hello')
    const row = db.prepare('SELECT x FROM t').get()
    expect(row.x).toBe('hello')
    db.close()
  })
})
```

NOTE: This tests against system Node ABI, not Electron's. For Electron-ABI testing, use electron-mocha or Playwright evaluate.

## CI Considerations

- macOS runner required for: Tray API, Touch ID, notifications, deep links, dock, globalShortcut
- Windows runner required for: NSIS packaging, Squirrel
- GitHub Actions has macOS runners (macOS-latest = macOS 14 as of 2026; verify)
- Xcode CLT must be available on CI runner for native module compilation
- Cache `node_modules` but not `*.node` files — they must be rebuilt per runner OS/arch
- Electron Forge sets `electron-rebuild` in postinstall; ensure CI runs `npm install` not `npm ci --ignore-scripts`

## Recommended Test Suite per POC

| Test type | Example |
|-----------|---------|
| Unit: business logic | Session timer, journal append, URL parser |
| Unit: IPC handler registration | Verify handlers registered with correct channel names |
| Behavior: window creation | app.whenReady → window exists |
| Behavior: IPC roundtrip | invoke → handle → response |
| Behavior: error path | malformed arg → typed error returned |
| Behavior: macOS-specific | Tray created, notification shown (requires signing) |
| E2E: full app boot | Playwright: launch → firstWindow → title check |
| E2E: deep link | Playwright: simulate URL open → action dispatched |
