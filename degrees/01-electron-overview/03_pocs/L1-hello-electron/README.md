# POC L1 — Hello Electron

The smoke-test foundation of the Electron degree. Proves that a minimal Electron
app boots with the secure-by-default renderer baseline, IPC works in both
directions, the macOS window-all-closed convention is honored, and a
structured-log breadcrumb trail is emitted from main on the canonical lifecycle
events.

## Run

```
npm install
npm run build      # tsc + copy renderer assets
npm start          # launches the unpackaged app via `electron .`
```

## Test

```
npm run test       # vitest unit tests (logger + IPC channel registry)
npx playwright test  # e2e: behavioral tests (boot.spec.ts) + regression (regression.spec.ts)
```

Playwright launches the unpackaged app via `_electron.launch({ args: [POC_ROOT] })`
with a temp directory passed through the `LOG_DIR` env var so each test can
read its own log file deterministically.

## File Layout

```
L1-hello-electron/
├── package.json
├── tsconfig.json              tsc strict + CommonJS + sourcemaps
├── tsconfig.test.json         types-only check used by editor / future lint
├── vitest.config.ts           Node env, includes tests/unit/**
├── playwright.config.ts       e2e timeout 60s, workers=1
├── scripts/copy-renderer.mjs  copies *.html from src/renderer/ → dist/renderer/
├── src/
│   ├── ipc.ts                 IPC_CHANNELS constant registry
│   ├── log.ts                 hand-rolled JSON-lines logger
│   ├── window.ts              createMainWindow factory (secure defaults)
│   ├── main.ts                main-process entry; logging + IPC + window
│   ├── preload.ts             contextBridge exposeInMainWorld('api', ...)
│   └── renderer/
│       ├── index.html         CSP-restricted; loads renderer.js
│       ├── renderer.ts        calls window.api.rendererReady on DOMContentLoaded
│       └── renderer.d.ts      ambient `window.api` type declaration
└── tests/
    ├── unit/
    │   ├── log.test.ts                10 tests for the JSON-lines logger contract
    │   └── ipc-channel-names.test.ts  4 tests for channel-name convention + preload-drift
    └── e2e/
        ├── helpers.ts          launchApp(), readLogLines(), waitForEvent()
        ├── boot.spec.ts        BT-L1-1 .. BT-L1-4 (behavioral)
        └── regression.spec.ts  R-L1-1 .. R-L1-4 (regression)
```

## IPC Surface

All channels follow `verb:noun` convention. Source of truth: `src/ipc.ts`.
Preload inlines the same strings (sandbox preload cannot `require('./ipc')` —
see preload header comment); a unit test guarantees no drift.

| Channel name      | Direction              | Kind                | Payload (renderer→main)              | Reply / event payload                  | Purpose                                              |
| ----------------- | ---------------------- | ------------------- | ------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `renderer:ready`  | renderer → main        | fire-and-forget (`send`/`on`) | `{ userAgent: string }`         | n/a                                     | Renderer announces it has finished DOMContentLoaded; main logs the userAgent. |
| `app:ping`        | renderer → main        | request/response (`invoke`/`handle`) | (none)                          | `{ pong: true, ts: number }`            | Liveness probe used by regression tests.            |
| `log:path`        | renderer → main        | request/response (`invoke`/`handle`) | (none)                          | `string` (absolute path to `main.log`)  | Lets the renderer (and tests, indirectly) discover where the log file lives. |

Renderer-facing surface is `window.api` (`src/renderer/renderer.d.ts`):

```ts
interface RendererApi {
  rendererReady(userAgent: string): void
  ping(): Promise<{ pong: true; ts: number }>
  logPath(): Promise<string>
}
```

## Log Point Table (L1 instrumentation)

Per `02_planning/observability-strategy.md` §7 "L1 — Hello Electron". Every
entry is one JSON object per line, fields: `ts level process module event payload?`.

| # | event            | level | module | Where emitted                          | payload                                                                     |
| - | ---------------- | ----- | ------ | --------------------------------------- | --------------------------------------------------------------------------- |
| 1 | `app:starting`   | info  | app    | Top of `src/main.ts` (BEFORE whenReady) | `{ electronVersion, nodeVersion, platform, arch }`                          |
| 2 | `app:ready`      | info  | app    | Inside `app.whenReady().then(...)`      | `{ electronVersion, isReady }`                                              |
| 3 | `window:created` | info  | window | After `createMainWindow()` returns      | `{ width, height, url }`                                                    |
| 4 | `renderer:ready` | info  | ipc    | On `renderer:ready` IPC receipt         | `{ userAgent: string }`                                                     |
| 5 | `window:closed`  | info  | window | `app.on('window-all-closed', ...)`      | `{ allWindowsClosed: true }`                                                |
| 6 | `app:before-quit`| info  | app    | `app.on('before-quit', ...)`            | `{ reason: 'user-initiated' }`                                              |

Log file location:
- Tests: `${LOG_DIR}/main.log` where `LOG_DIR` is a fresh temp dir.
- Dev/packaged: `app.getPath('logs')/main.log` (resolved at main-process startup; falls back to `${userData}/logs/main.log` if `getPath('logs')` is unavailable pre-ready).

## Security Posture (baseline for the whole degree)

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- CSP meta tag: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'`
- Renderer ↔ main communication is restricted to the contextBridge-exposed `window.api` surface.
- `webSecurity` not disabled. `allowRunningInsecureContent` not enabled.

Hardening surfaces NOT introduced at L1 (deferred to L2): `will-navigate` guard,
`setWindowOpenHandler` guard, `session.setPermissionRequestHandler`, IPC arg
schema validation.

## Decisions Made

1. **No electron-forge / Vite at L1.** The L1 scope is a smoke test; bundlers
   add ~150 deps and a multi-config build graph that hides the real Electron
   wiring. We compile with `tsc` only and copy `*.html` verbatim. Forge will
   come in at L5 where packaging matters; Vite or esbuild can come in earlier
   if a bundler-only feature is needed (e.g. preload imports).
2. **Hand-rolled logger instead of electron-log.** Per `observability-strategy.md`
   electron-log enters at L4. L1 needs a dependency-free, fully synchronous
   logger so tests can deterministically read the file immediately after each
   IPC event. The contract (`{ts,level,process,module,event,payload?}`) matches
   the electron-log JSON format, so the L4 migration is a drop-in.
3. **Preload string literals inlined.** Sandbox preload cannot `require()`
   relative files (research §05). Inlining the channel strings is the smallest
   workaround; the unit test `tests/unit/ipc-channel-names.test.ts` cross-checks
   them against the canonical `IPC_CHANNELS` registry.
4. **LOG_DIR env-var override.** Tests need a fresh per-test log file. Letting
   `main.ts` read `LOG_DIR` from the environment is simpler than re-routing
   `app.setPath('logs', ...)` and avoids the Electron path-system early-init
   subtleties.

See `poc-report.md` for the full retrospective.

## Hot-Reload Status

Not implemented at L1 (the original POC plan listed it as a "nice to have" for
dev experience; the L1 prompt explicitly exempted it from the green/regression
gate). Future POCs can add `electron-vite` or `nodemon` once Vite arrives.

## What L2+ Should Inherit

- The `src/log.ts` JSON-lines contract — keep the same fields.
- The `IPC_CHANNELS` registry pattern + the preload-inline cross-check test.
- The Playwright `_electron` helper module (`tests/e2e/helpers.ts`) — `launchApp`,
  `readLogLines`, `waitForEvent` are reusable as-is.
- The secure-defaults `BrowserWindow` config in `src/window.ts` is the baseline
  the whole degree builds on.
