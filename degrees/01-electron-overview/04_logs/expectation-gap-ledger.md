# Expectation-Gap Ledger — 01-electron-overview

This is the most important file in the entire degree. Every place where Electron's reality diverges from documentation, common assumptions, or LLM training expectations gets recorded here with full diagnosis.

Append-only during the degree. Phase 9 distillation harvests this file to produce `05_distillation/gotchas/*.md` and `05_distillation/before-you-build/*.md`.

If this file is empty when the degree closes, research was too shallow.

## Entry Format

```
## Entry N — <short title>

- **Date**:
- **POC / Phase**:
- **Feature / surface**:
- **Context**:
- **What I expected**:
- **Why I expected it** (source — doc URL, training assumption, prior framework, etc.):
- **What actually happened**:
- **Evidence** (command, output, log, file:line):
- **Was this in the official docs?** Yes / No / Partially
- **Resolution / workaround**:
- **Promoted to gotcha?** Yes / No — if yes, link to `05_distillation/gotchas/<file>.md`
```

## Entries

## Entry 1 — Sandbox preload silently fails to require relative files

- **Date**: 2026-05-17
- **POC / Phase**: Phase 6 / L1 (during GREEN debug)
- **Feature / surface**: preload script under `webPreferences: { sandbox: true }`
- **Context**: `src/preload.ts` imported `IPC_CHANNELS` from `./ipc` so renderer and main would share a single channel registry. tsc compiled this to `const ipc_1 = require("./ipc")` (CommonJS).
- **What I expected**: relative imports compile to a `require()` and Electron's preload runtime resolves it normally, since both files end up in `dist/`.
- **Why I expected it**: standard Node/CommonJS module-resolution intuition. The Electron docs page for `contextBridge` does not foreground the sandbox-preload module restriction in its overview.
- **What actually happened**: under `sandbox: true`, `require('./ipc')` either threw or returned undefined (no error in the main-process log; preload silently aborted before `contextBridge.exposeInMainWorld`). The renderer's `window.api` was undefined. BT-L1-2 and BT-L1-4 failed because the renderer could not announce ready.
- **Evidence**:
  - Log file contained `app:starting`, `app:ready`, `window:created` but never `renderer:ready`.
  - `01_research/05-security-model.md` lines 207-213 documents the rule: "Preload cannot import arbitrary npm packages via require()", and `02-three-process-model.md` lists the whitelist of modules that ARE allowed under sandbox (`contextBridge`, `crashReporter`, `ipcRenderer`, `nativeImage`, `webFrame`, `webUtils`, plus `events/timers/url`).
  - Confirming step: removed the import, inlined the channel strings in `src/preload.ts`, rebuilt, re-ran. BT-L1-2 and BT-L1-4 passed.
- **Was this in the official docs?** Partially. The Electron docs on `sandbox` mention restrictions; the implication for relative-path imports specifically is buried in the preload-process section.
- **Resolution / workaround**: inline the IPC channel string literals in `src/preload.ts`. Added unit test `tests/unit/ipc-channel-names.test.ts > preload inline channel constants do not drift from IPC_CHANNELS` to catch drift. Documented prominently in the preload file header.
- **Promoted to gotcha?** Yes (to be done in Phase 9 distillation) — content for `05_distillation/gotchas/sandbox-preload-no-relative-require.md` is ready: title, repro steps, fix, and a regression test pointer.

## Entry 2 — tsc `include: ["src/**/*.ts"]` does not pick up `.d.ts` files

- **Date**: 2026-05-17
- **POC / Phase**: Phase 6 / L1 (during GREEN setup)
- **Feature / surface**: tsc project-file inclusion globs
- **Context**: `src/renderer/renderer.d.ts` declared the global `Window.api` augmentation. `src/renderer/renderer.ts` used `window.api.rendererReady(...)`.
- **What I expected**: the `include: ["src/**/*.ts"]` pattern matches files ending in `.ts`, which includes `*.d.ts`. So the declaration would be available to renderer.ts.
- **Why I expected it**: TypeScript handbook uses `**/*.ts` examples and does not explicitly distinguish `.d.ts` from `.ts` for the include glob. The pattern is a literal suffix match.
- **What actually happened**: `tsc -p tsconfig.json --listFiles` confirmed `renderer.d.ts` was NOT in the program. Compilation failed with `TS2339: Property 'api' does not exist on type 'Window & typeof globalThis'`. Even explicitly adding `src/**/*.d.ts` to `include` did not help.
- **Evidence**: tsc 5.6.3 with `rootDir: "src"` and `include: ["src/**/*.ts", "src/**/*.d.ts"]` still excluded the file. Adding the file to a top-level `"files": [...]` array fixed it on the next compile.
- **Was this in the official docs?** No / partial. The TS docs say declaration files (`.d.ts`) are picked up automatically when referenced, but a `.d.ts` with only global augmentations (no module exports) and no `///<reference />` from another file is not automatically discovered just because it matches the include glob.
- **Resolution / workaround**: list ambient `.d.ts` files in tsconfig `"files"`. For L1: `"files": ["src/renderer/renderer.d.ts"]`.
- **Promoted to gotcha?** Yes — content for `05_distillation/gotchas/tsc-ambient-dts-not-auto-included.md`.
