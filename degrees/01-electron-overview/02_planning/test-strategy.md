# Test Strategy — 01-electron-overview

Version: Electron 42.1.0, vitest 4.1.6, Playwright 1.60.0, electron-mocha (fallback).

---

## 1. Test Framework Decision and Rationale

### Primary Stack

**vitest 4.1.6** — unit and integration tests for all business logic, IPC handler registration, storage operations, and renderer state machines that can be exercised without launching Electron.

**Playwright 1.60.0 `_electron`** — full application end-to-end tests for the capstone and smoke tests for packaged binaries.

**electron-mocha** — fallback only, for any IPC handler that cannot be adequately mocked via vitest's `vi.mock` factory. Rationale: electron-mocha runs tests inside Electron's Node environment, giving access to real `ipcMain`, `app`, etc. It is slower (must launch Electron per suite) and harder to integrate with standard CI test reporters. Use only when vitest mocking is demonstrably insufficient.

### Why Not bun:test

`bun:test` is explicitly rejected for this degree. Evidence from `../01_research/22-version-compatibility.md`: bun 1.3.x's native module support (node-gyp) is documented as incomplete for Electron projects. `@electron/rebuild` relies on npm's `postinstall` hook semantics that bun does not reliably replicate. Since better-sqlite3 (a native module) is introduced in L3 and central to the capstone, using bun would require maintaining two separate build pipelines — one for tests (bun) and one for the app (npm). This complexity is not justified by bun's speed benefits.

### Why Not Jest

Jest's module transform and `moduleNameMapper` are incompatible with Electron's CommonJS/ESM hybrid output from Vite. vitest natively handles ESM, TypeScript, and has a compatible mock API. Migration cost from vitest → Jest is higher than the reverse. `../01_research/20-testing-strategies.md` explicitly recommends vitest.

### Testing Principle: Separate Logic from IPC Wiring

The key architectural decision enabling testability: business logic lives in pure TypeScript modules (`session.ts`, `journal.ts`, `storage.ts`, `shortcuts.ts`) with no Electron imports. IPC wiring (`ipc.ts`) imports both business logic and Electron, but is NOT directly unit-tested — it is exercised via Playwright e2e. This separation is the "Dependency Injection" pattern from `../01_research/20-testing-strategies.md`.

```
src/
  session.ts        ← pure logic; tested with vitest (no Electron)
  journal.ts        ← pure logic; tested with vitest (no Electron)
  ipc.ts            ← Electron IPC wiring; tested via Playwright or mocked
  main.ts           ← entry point; integration-tested via Playwright
```

---

## 2. Test Layers

### Layer 1 — Pure Unit (vitest, no Electron runtime)

**Scope**: Stateless helper functions and pure business logic that have no Electron imports.

**Examples**:
- URL/deep-link parsing (`parseDeepLink('pulse://start?duration=25')`)
- Accelerator validation (`isValidAccelerator('CmdOrCtrl+Shift+P')`)
- JSON schema validation for IPC payloads
- Session timer logic (`startSession`, `remainingMs`, `pauseSession`, `resumeSession`)
- Journal entry creation and formatting
- Storage serialization/deserialization (without `app.getPath`)

**Setup**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
})
```

**Run command**: `npx vitest run`

**POC association**: All POCs. This layer is established in L1 and grows with each level.

---

### Layer 2 — Main-Process Integration (vitest with Electron mocks)

**Scope**: IPC handler registration logic, storage operations against real filesystem paths (using `os.tmpdir()`), tray state machine, and renderer-notification wiring — exercised through vitest with `vi.mock('electron', ...)`.

**Mocking approach**:
```typescript
// tests/setup.ts — global mock for all integration tests
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((key: string) => {
      if (key === 'userData') return '/tmp/test-userdata'
      if (key === 'logs') return '/tmp/test-logs'
      return '/tmp'
    }),
    whenReady: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    quit: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    webContents: { openDevTools: vi.fn(), on: vi.fn(), send: vi.fn() },
    on: vi.fn(),
  })),
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setTitle: vi.fn(),
    getTitle: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    on: vi.fn(),
  })),
  nativeTheme: { shouldUseDarkColors: false, on: vi.fn() },
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(false),
  },
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  })),
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockImplementation((s: string) => Buffer.from(s)),
    decryptString: vi.fn().mockImplementation((b: Buffer) => b.toString()),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.txt'] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/out.txt' }),
  },
}))
```

**Key tests at this layer**:
- IPC channel names are registered before `app.ready` (via spy on `ipcMain.handle`)
- `JournalService.appendEntry()` writes to `os.tmpdir()` test path and is readable by `listEntries()`
- `TrayManager.init()` stores tray reference at module scope (not function-local)
- `StorageManager.write()` uses atomic write-then-rename pattern

**Run command**: `npx vitest run --config vitest.integration.config.ts`

**POC association**: L2 (IPC handler registration), L3 (storage), L4 (tray state machine, shortcut registration).

---

### Layer 3 — Renderer Logic (vitest, jsdom/happy-dom)

**Scope**: Preload contract types, renderer-side state machines, UI event handlers (where not Electron-specific), and contextBridge API shape validation.

**Setup**:
```typescript
// vitest.renderer.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.ts', 'tests/renderer/**/*.test.ts'],
    globals: true,
    setupFiles: ['./tests/renderer-setup.ts'],
  },
})
```

**Mock approach**: Inject `window.api` mock (matching the preload's `contextBridge.exposeInMainWorld` shape) before each test.

```typescript
// tests/renderer-setup.ts
Object.defineProperty(window, 'api', {
  value: {
    ping: vi.fn().mockResolvedValue({ ts: Date.now() }),
    journal: {
      append: vi.fn().mockResolvedValue({ id: 1 }),
      list: vi.fn().mockResolvedValue([]),
    },
    onThemeChange: vi.fn(),
    getFilePath: vi.fn().mockReturnValue('/tmp/test.txt'),
  },
  writable: true,
})
```

**Key tests at this layer**:
- Renderer event handler registers via `window.api.onThemeChange(handler)` when dark-mode toggle is clicked
- File drop handler calls `window.api.getFilePath(file)` NOT `file.path`
- Session status display updates when IPC push arrives

**POC association**: L2 (renderer API shape), L3 (drag-drop handler), L4 (nativeTheme IPC push).

---

### Layer 4 — Full App E2E (Playwright `_electron`)

**Scope**: Full application launch, window creation, IPC roundtrips, tray behavior (via evaluate), powerMonitor event simulation, deep-link routing, and UI interactions visible in the renderer page.

**Setup**:
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: { screenshot: 'only-on-failure' },
  reporter: [['line'], ['html', { open: 'never' }]],
})
```

```typescript
// tests/e2e/helpers.ts
import { _electron as electron, ElectronApplication } from '@playwright/test'
import path from 'node:path'

export async function launchApp(
  env: Record<string, string> = {}
): Promise<ElectronApplication> {
  return electron.launch({
    args: [path.join(__dirname, '../../.vite/build/main.js')],
    env: { ...process.env, NODE_ENV: 'test', ...env },
  })
}
```

**Gotchas from `../01_research/20-testing-strategies.md`**:
1. `firstWindow()` has 30s timeout — for tray-only apps (capstone), don't call `firstWindow()`; use `electronApp.evaluate()` to check app state.
2. `evaluate()` runs in main process — access renderer via the `Page` object from `firstWindow()` or `electronApp.windows()`.
3. Non-serializable values returned from `evaluate()` silently become `undefined` — use `evaluateHandle()` for references.
4. `electronApp.close()` MUST be called in `afterAll` — stray Electron processes corrupt CI.

**Deep-link simulation pattern** (works in dev mode without packaging):
```typescript
// Simulate open-url event in main process
await electronApp.evaluate(({ app }, url) => {
  // @ts-ignore — event doesn't exist in types but works at runtime
  app.emit('open-url', {}, url)
}, 'pulse://start?duration=25')
```

**powerMonitor simulation pattern**:
```typescript
await electronApp.evaluate(({ powerMonitor }) => {
  powerMonitor.emit('suspend')
})
// then assert state changed
```

**Run command**: `npx playwright test tests/e2e/`

**POC association**: L4 (tray, powerMonitor, deep links), Capstone (full app e2e including packaged binary).

---

### Layer 5 — Packaged App Smoke (Playwright, executablePath)

**Scope**: Launch the actual built `.app` bundle from `out/`; verify it boots without crashing; verify no dock icon (capstone); verify tray exists; verify basic IPC works.

**Setup**:
```typescript
electronApp = await electron.launch({
  executablePath: path.join(
    __dirname,
    '../../out/Pulse-darwin-arm64/Pulse.app/Contents/MacOS/Pulse'
  ),
  env: { NODE_ENV: 'production' },
})
```

**Tests at this layer**:
- App launches (process doesn't crash within 10s)
- No dock icon (capstone): `electronApp.evaluate(({ app }) => app.dock.isVisible())` returns `false`
- Tray exists: `electronApp.evaluate(({ app }) => app.isReady())` returns `true`

**Limitations**: Packaged binary path is arch-specific; test must be parameterized or skipped on non-matching arch. Notification and Touch ID cannot be automated at this layer.

**POC association**: L5 (packaged binary smoke), Capstone (full packaged smoke).

---

## 3. Behavioral Test Framing (Given / When / Then)

All behavioral tests follow this format. Examples across POCs:

**L1 — macOS close-but-keep-alive**:
```
Behavior: App stays alive after last window is closed on macOS
Given: The app is running with one BrowserWindow open
When: The window's close button is clicked (or window.close() called in test)
Then: The Electron process is still running (app.isReady() === true)
And: BrowserWindow.getAllWindows().length === 0
And: No 'before-quit' event has fired
Why this matters: macOS convention is window-close ≠ app-quit; agents must implement window-all-closed guard
Test type: E2E (Playwright evaluate)
Expected failure before implementation: app.isReady() === false after window close
Evidence required for success: electronApp still responds to evaluate() after window close
```

**L2 — IPC malformed payload rejection**:
```
Behavior: Main process rejects malformed IPC payload without leaking exception
Given: The app is running with valid IPC handlers registered
When: The renderer calls window.api with a payload that fails schema validation
Then: The invoke resolves with { error: 'VALIDATION_ERROR', message: string }
And: No uncaught exception is logged in main process
And: A structured log line [ipc] validation-failed is emitted
Why this matters: IPC channels are the main attack surface; validation must not throw
Test type: Playwright evaluate (call invoke with bad payload via page.evaluate)
Expected failure: invoke hangs or throws unhandled rejection
Evidence required: resolve value has error field; no crash in electronApp
```

**L4 — tray state update within event loop tick**:
```
Behavior: Tray title updates synchronously after IPC toggle
Given: The app is running with tray initialized in 'idle' state
When: IPC message 'tray:setState' is sent with state='focusing'
Then: tray.getTitle() returns 'Focusing' within one event-loop tick (no async wait needed)
And: A structured log line [tray] state-changed from=idle to=focusing is emitted
Why this matters: Tray state must be immediately consistent with app state
Test type: Playwright evaluate (send IPC then synchronously read tray title)
Expected failure: tray.getTitle() still returns 'Idle' if update is async
Evidence required: getTitle() returns expected value; log line present in app log file
```

**Capstone — session persists across restart**:
```
Behavior: Session counter survives app quit and relaunch
Given: The app has run a completed 25-min focus session (session count = 1)
When: The app is quit (app.quit()) and relaunched via electron.launch()
Then: The session counter shows 1 completed session in the new instance
And: The journal entry count matches the pre-quit count
Why this matters: Persistence is a core capstone requirement; data loss on restart is unacceptable
Test type: E2E (Playwright — quit then relaunch in same test suite)
Expected failure: counter shows 0 after restart if state is only in-memory
Evidence required: session count query to SQLite returns expected value; tray title shows correct count
```

---

## 4. What We Will NOT Test

The following are explicitly out of scope for automated tests in this degree:

- **Apple notarization itself** — requires Apple Developer account; documented as simulated only (R-12)
- **Real OS sleep/wake triggers** — `powerMonitor.suspend/resume` is simulated via `emit()` in tests; real sleep is not automated
- **Real OS notification user-clicks** — mocked at the boundary; notification delivery itself requires signing (R-02)
- **Real deep-link from external app** — URL scheme routing requires packaged app; simulated via `app.emit('open-url', ...)` in tests
- **Real update binary swap** — `quit-and-install` is not automated; update-available event IS tested, the binary swap is not
- **Touch ID sensor presence** — Touch ID is mocked via injectable `promptFn` parameter
- **Line coverage percentage** — behavior coverage (every IPC channel tested, every event handler exercised) takes priority over line coverage metrics

---

## 5. Test Data Conventions

- **In-memory SQLite**: `new Database(':memory:')` for all unit tests. No file I/O in unit layer.
- **Temp directory**: `os.tmpdir()` for integration tests that need a real filesystem path. Clean up in `afterEach`.
- **IPC payload factories**: Each POC defines factory functions in `tests/factories.ts` producing valid and invalid payloads for every IPC channel.
- **Fixture files**: Static test fixtures (e.g., a sample `journal.json`, a `manifest.json` for updater tests) live in `tests/fixtures/`.
- **Database seeding**: `tests/helpers/db.ts` exports a `seedDb(db, entries)` function used by all tests needing pre-populated data.

---

## 6. Mocks vs Reality

| Concern | Mock acceptable | Real required |
|---------|----------------|---------------|
| `ipcMain.handle` registration | YES — vi.mock in unit tests | NO need |
| `app.getPath` | YES — return temp path | NO need for unit tests |
| `Notification` class | YES — mock for unit; real for signed build | Real for signed smoke test only |
| `Tray` class | YES — mock for unit; real for Playwright e2e | Real for Playwright e2e |
| SQLite (better-sqlite3) | YES — in-memory for unit | Real for integration + e2e |
| `safeStorage` | YES — passthrough mock (return input) | Real for capstone integration test |
| `globalShortcut.register` | YES — mock returns true | Real for Playwright e2e (verify registration) |
| `powerMonitor` events | YES — emit() simulation | Documented as real-only behavior |
| `protocol.handle` | YES — mock for unit | Real for deep-link e2e |
| `autoUpdater` | YES — mock for unit; real with local server for L5 | Real for L5 integration test |

**Rule**: Never mock in e2e tests (Layer 4+). If a surface can't be tested without mocking in e2e, document it as an explicit "not automated" item.

---

## 7. Coverage Targets

Line coverage percentage is NOT a success metric. Behavior coverage is:

- **IPC channels**: every channel exposed in `preload.ts` has ≥1 positive test and ≥1 negative test (invalid payload or missing context)
- **powerMonitor events**: every event registered (`suspend`, `resume`, `lock-screen`, `unlock-screen`, `on-battery`) has a triggered test
- **Tray state transitions**: every transition in the tray state machine (`idle→focusing`, `focusing→paused`, `paused→focusing`, `focusing→idle`) has a test
- **Deep-link routes**: every scheme handled (`pulse://start`, `pulse://stop`, `pulse://log`) has a test
- **Security guards**: `will-navigate` block, `setWindowOpenHandler` block, CSP violation — each has a test
- **Storage**: write→read→update→delete cycle has tests; atomic write behavior tested (write-then-rename)
- **Lifecycle events**: `before-quit` flush and `will-quit` shortcut-unregister both have tests

---

## 8. CI Considerations

**macOS runner required for**:
- Tray API (`new Tray()` requires AppKit)
- Touch ID testing (`systemPreferences.promptTouchID`)
- Notification delivery (even ad-hoc signed; requires macOS notification system)
- Deep links (packaged binary + Launch Services registration)
- globalShortcut (system-level key capture)
- Dock API (`app.dock.hide()`)
- Universal binary build (`npm run make -- --arch=universal`)

**GitHub Actions setup**:
```yaml
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      # Do NOT use npm ci --ignore-scripts: Forge needs postinstall for electron-rebuild
      - run: npx playwright install
      - run: npm test
      - run: npx playwright test
```

**Caching**: Cache `node_modules` but NOT `*.node` files. Native modules compiled on one runner may not load on another (different macOS minor version or arch).

**Xcode CLT**: `macOS-latest` runner on GitHub Actions includes Xcode CLT. Verify with `xcode-select -p`. If CLT is missing: `xcode-select --install` (adds 10+ minutes to CI; prefer a runner that already has it).

**Known Playwright `_electron` issues in CI** (from `../01_research/20-testing-strategies.md`):
1. `firstWindow()` timeout: set `timeout: 60_000` in Playwright config — CI is slower than local.
2. Capstone tray-only app: avoid `firstWindow()` entirely; use `evaluate()` to assert readiness.
3. Electron process must be killed: `afterAll(async () => await electronApp.close())` is mandatory or CI runner accumulates zombie processes.

**Apple Silicon / x64 CI note**: GitHub Actions `macos-latest` as of 2026 is macOS 14 (Sonoma) on arm64. `macos-13` is x64. For universal binary testing, run on both. For this degree, arm64 is primary; x64 testing in L5 is documented as optional.
