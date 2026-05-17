# POC L2 — Secure IPC

Establishes the secure IPC + renderer-hardening baseline that every
subsequent POC inherits.

## What this POC proves

Every channel of the renderer↔main IPC surface is:

- **Mediated** by `contextBridge` — the renderer never touches `ipcRenderer`,
  `require`, or Node globals.
- **Validated** — every IPC channel has a registered validator that the
  central wrapper in `src/ipc.ts` runs before any handler logic. A new
  channel cannot ship without a validator (enforced by R-L2-2).
- **Logged** — every handler invocation emits a structured JSON-lines log
  entry (`ipc:<channel>:served`); every validation failure emits
  `ipc:<channel>:validation-failed`.
- **Hardened against navigation** — `setWindowOpenHandler` denies every
  new-window request; `will-navigate` blocks any navigation away from the
  loaded file:// origin. Both log a structured entry.
- **CSP-protected** — strict CSP (`default-src 'self'; script-src 'self'`,
  no `unsafe-inline`, no `unsafe-eval` in script-src) is enforced by
  meta tag and verified at runtime (BT-L2-6).

## Files of interest

| File                       | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `src/main.ts`              | App lifecycle; wires IPC registry, security guards, tick stream.         |
| `src/preload.ts`           | `contextBridge.exposeInMainWorld('api', …)`. Bundled by esbuild.         |
| `src/window.ts`            | Single source of truth for `webPreferences` (secure defaults).           |
| `src/ipc.ts`               | `IPC_REGISTRY` channel table; `registerIpc()` validate-then-handle.      |
| `src/ipc-validation.ts`    | `IpcValidationError` class + per-channel validators (hand-rolled).       |
| `src/security.ts`          | `setWindowOpenHandler` + `will-navigate` + permission deny-all.          |
| `src/renderer/index.html`  | Strict CSP meta tag. No inline scripts.                                  |
| `src/renderer/renderer.ts` | Minimal renderer entry — calls `window.api.*` via Playwright in tests.   |
| `src/log.ts`               | Hand-rolled JSON-lines logger (copied from L1, unchanged contract).      |

## IPC surface

| Channel              | Direction       | Arg shape                          | Response shape                              | Notes                            |
| -------------------- | --------------- | ---------------------------------- | ------------------------------------------- | -------------------------------- |
| `app:ping`           | invoke          | none                               | `{ pong: true, ts: number, monotonic: number }` | liveness probe                   |
| `app:echo`           | invoke          | any structured-cloneable value     | the input verbatim                          | exercises round-trip semantics   |
| `journal:append`     | invoke          | `{ text: string }` (non-empty)     | `{ ok: true }`                              | strict validator (BT-L2-5)       |
| `tick` (push)        | main → renderer | n/a                                | `n: number` (every 200ms)                   | subscribe via `window.api.onTick`|

## Toolchain

Continues L1's toolchain: `tsc` for main, `esbuild` for preload, static
HTML copied to `dist/`. NO electron-forge (deferred to L5 per
decision-log Entry 1).

New at L2: `scripts/build-preload.mjs` bundles `src/preload.ts` into a
single `dist/preload.js` via esbuild with `external: ['electron']`. This
eliminates L1's inline-channel-strings workaround (logged in
expectation-gap-ledger Entry 1) so preload can `import { IPC_CHANNELS }
from './ipc'` cleanly. Decision logged in decision-log Entry 5.

## Running

```bash
npm install
npm run build       # tsc + esbuild + copy renderer assets
npm start           # launches the unpackaged app
npm run test        # vitest (unit) — 24 tests
npm run test:e2e    # playwright (_electron) — 13 tests
```

## CSP carve-out

The CSP allows `style-src 'self' 'unsafe-inline'` as a pragmatic concession
for renderer-side styling without a CSS bundler. `script-src` does NOT
admit `unsafe-inline` or `unsafe-eval`; that's the directive that BT-L2-6
exercises at runtime. A future POC that adds a CSS bundler can tighten
this further; the regression unit test `tests/unit/csp.test.ts` enforces
the script-src strictness.

## Test layout

```
tests/
├── unit/
│   ├── csp.test.ts                   (R-L2-4 source-side counterpart)
│   ├── ipc-registry-coverage.test.ts (R-L2-2)
│   ├── ipc-validation.test.ts        (validator positive + negative)
│   └── security-defaults.test.ts     (R-L2-3 source-side counterpart)
└── e2e/
    ├── csp.spec.ts                   (BT-L2-6)
    ├── helpers.ts                    (Playwright launch + log-tail helpers)
    ├── isolation.spec.ts             (BT-L2-2)
    ├── navigation-guards.spec.ts     (BT-L2-3, BT-L2-4)
    ├── regression.spec.ts            (R-L2-1..4 runtime probes)
    └── secure-ipc.spec.ts            (BT-L2-1, BT-L2-5, BT-L2-5b, BT-L2-7, BT-L2-8)
```

## Invariants future POCs inherit

1. **Every new IPC channel MUST be registered in `IPC_REGISTRY`** with a
   `channel`, `kind`, `validator`, and `handler`. R-L2-2 fails otherwise.
2. **Every new BrowserWindow MUST come from `createMainWindow()`** (or a
   sibling function that imports `SECURE_WEB_PREFERENCES`). R-L2-3 fails
   if a window ships with weakened prefs.
3. **The CSP meta tag in `src/renderer/index.html` MUST remain at or
   strictly stricter than the L2 baseline.** R-L2-4 + the unit test
   `csp.test.ts` enforce this.
4. **All log entries follow the L1 contract** (`{ts, level, process,
   module, event, payload?}`). The helper `tests/e2e/helpers.ts`
   guarantees test isolation via `LOG_DIR` env var.
5. **IpcValidationError surfaces to the renderer as
   `{ name: 'IpcValidationError', message }`** because Electron strips
   Error.name across the IPC boundary. Throwing a plain object from
   the preload is the renderer-visible contract; do not change without
   updating BT-L2-5.

## See also

- `test-plan.md` — full Given/When/Then breakdown of every BT and R.
- `poc-report.md` — what happened during the build, decisions made.
- `../../04_logs/decision-log.md` — decisions affecting this and future POCs.
- `../../04_logs/expectation-gap-ledger.md` — places reality diverged from expectation.
