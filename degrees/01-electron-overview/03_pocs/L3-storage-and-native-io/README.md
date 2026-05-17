# POC L3 — Storage & Native I/O

Builds on L2's secure-IPC baseline to add app-data persistence and the
native I/O surfaces a real desktop app needs: file dialogs, drag-and-drop
file paths via `webUtils.getPathForFile`, the application + context
menu, a narrow file-system watcher, and a `before-quit` lifecycle hook
that flushes pending writes before exit.

## What this POC proves

1. **Atomic JSON-array journal persistence**. `journal:append` writes the
   new array to `journal.json.tmp` then `fs.rename`s it into place; the
   canonical file is never observed in a half-written state.
   (BT-L3-1, R-L3-2.)
2. **Corruption recovery**. Malformed JSON in `journal.json` produces an
   empty list, a `journal.json.corrupt-<ms-ts>` backup, a fresh empty
   journal, and a `storage:journal:corrupted` structured-log entry —
   not a crash. (BT-L3-2.)
3. **Dialog seam**. `dialog:open` and `dialog:save` are routed through a
   single adapter in `main.ts` that honors `DIALOG_STUB=1` for
   deterministic tests; the production path delegates to
   `dialog.showOpenDialog` / `showSaveDialog`. The renderer never sees
   raw filesystem handles, only validated path strings or
   `{ canceled: true, filePaths: [] }` / `{ canceled: true, filePath: null }`.
   (BT-L3-3, BT-L3-4.)
4. **Drag-and-drop without `File.path`**. The preload exposes
   `window.api.getPathForFile(file)` which calls
   `webUtils.getPathForFile(file)` — the modern replacement for the
   `File.path` property removed in Electron 32 (REF-03 / FM-15). The
   renderer's `drop` listener extracts paths via that helper and ships
   them to main on `files:dropped`. (BT-L3-5, R-L3-3.)
5. **macOS-flavored application menu** with "Toggle Dev Tools" at
   `Cmd+Alt+I` under View, exposed via an `app:get-menu-tree` IPC for
   testability. (BT-L3-6.)
6. **`before-quit` flushes pending journal writes**. The storage module
   tracks in-flight writes in a `Set<Promise<void>>`; the main process's
   `before-quit` listener calls `storage.flush()` (which awaits the set)
   before letting the quit complete. (BT-L3-8, R-L3-4.)
7. **Context-menu listener on every BrowserWindow's webContents**
   building Copy / Cut / Paste / Select All. (BT-L3-9.)
8. **File watcher rooted at `${userData}/watched-folder/`** delivering
   `file:changed` push events to the renderer. Renames are surfaced as
   `kind: 'rename'` via a listing-diff heuristic over `fs.watch`'s
   `rename` event pair. (BT-L3-7.)

## Files of interest

| File                    | Purpose                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `src/main.ts`           | App lifecycle, IPC registration, menu install, watcher start, before-quit flush.       |
| `src/preload.ts`        | `contextBridge.exposeInMainWorld('api', …)` — adds `getPathForFile`, `onFileChanged`.  |
| `src/window.ts`         | Carries forward L2's `SECURE_WEB_PREFERENCES` (R-L2-3 still in force).                 |
| `src/ipc.ts`            | `IPC_REGISTRY` extended: `journal:append/list`, `dialog:open/save`, `files:dropped`, `app:get-menu-tree`. |
| `src/ipc-validation.ts` | Hand-rolled validators for every L3-new channel.                                       |
| `src/security.ts`       | Carry-forward navigation guards + permission deny-all.                                 |
| `src/storage.ts`        | Atomic JSON journal: append/list/flush + corruption recovery + crash seam.             |
| `src/watch.ts`          | `fs.watch`-based file watcher with listing-diff rename pairing.                        |
| `src/menu.ts`           | Application menu template + context menu install + tree serializer.                   |
| `src/log.ts`            | Carry-forward JSON-lines logger (same contract as L1/L2).                              |
| `src/renderer/*`        | Strict CSP HTML + a tiny renderer.ts that wires the drop-zone.                         |

## IPC surface

| Channel               | Direction          | Arg shape                                          | Response shape                              |
| --------------------- | ------------------ | -------------------------------------------------- | ------------------------------------------- |
| `app:ping`            | invoke             | none                                               | `{ pong: true, ts, monotonic }`             |
| `app:echo`            | invoke             | any structured-cloneable value                     | the input verbatim                          |
| `journal:append`      | invoke             | `{ text: string }` (non-empty)                     | `{ ok: true, entry: { id, ts, text } }`     |
| `journal:list`        | invoke             | none                                               | `readonly JournalEntry[]`                   |
| `dialog:open`         | invoke             | `{ defaultPath?, filters?, properties? }`          | `{ canceled, filePaths }`                   |
| `dialog:save`         | invoke             | `{ defaultPath?, filters? }`                       | `{ canceled, filePath }`                    |
| `files:dropped`       | invoke             | `readonly string[]`                                | `{ ok: true, count }`                       |
| `app:get-menu-tree`   | invoke             | none                                               | `MenuTreeNode[]`                            |
| `tick` (push)         | main → renderer    | n/a                                                | `n: number` (every 200ms)                   |
| `file:changed` (push) | main → renderer    | n/a                                                | `{ kind, path?, oldPath?, newPath? }`       |

## Test seams (env-var-driven)

| Env var                  | Effect                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `LOG_DIR`                | Override `app.getPath('logs')` for test isolation (carry-forward from L1).              |
| `USER_DATA_DIR`          | Override `app.getPath('userData')` (applied via `app.setPath` before `whenReady`).      |
| `DIALOG_STUB=1`          | Short-circuit `dialog.show*Dialog` and return a deterministic fixture.                  |
| `DIALOG_STUB_MODE`       | `'cancel'` (default for open) or `'pick'` (default for save).                           |
| `DIALOG_STUB_PATH`       | Override the stubbed file path (default `/tmp/sample.txt`).                             |
| `JOURNAL_SIMULATE_CRASH` | When `'1'`, storage throws after writing `journal.json.tmp` but before the rename.       |

## Toolchain

Continues L1/L2: `tsc` for main, `esbuild` for the preload bundle (so
`webUtils` and the IPC channel constants can be imported cleanly under
`sandbox: true`), static HTML copied to `dist/`. No electron-forge yet
(deferred to L5).

## Running

```bash
npm install
npm run build       # tsc + esbuild + copy renderer assets
npm start           # launches the unpackaged app
npm run test        # vitest (unit) — 50 tests
npm run test:e2e    # playwright (_electron) — 13 tests
```

## Invariants future POCs inherit

1. **Drag-and-drop paths come from `webUtils.getPathForFile`, never
   `File.path`** — R-L3-3 enforces it via both runtime probe and a
   string match on the built preload bundle.
2. **Every IPC channel runs a validator before its handler** — R-L3-1
   extends L2's R-L2-2 to the L3-new channels.
3. **`journal.json` is always written via temp + rename** — R-L3-2
   asserts the canonical file is unchanged after a mid-write crash.
4. **`before-quit` awaits pending journal writes** — R-L3-4 asserts the
   `app:before-quit` log entry precedes `app:before-quit:flushed`,
   AND the in-flight entry survived to disk.
5. **The application menu's "Toggle Dev Tools" item uses `Cmd+Alt+I` on
   darwin** — BT-L3-6.
6. **The CSP and secure webPreferences invariants from L2 carry forward
   unchanged** — `csp.test.ts` and `security-defaults.test.ts` still
   pass; no new permissive directives.

## See also

- `test-plan.md` — full Given/When/Then breakdown of every BT and R.
- `poc-report.md` — what happened during the build, decisions made.
- `../../04_logs/decision-log.md` — Decision 7 (file-watcher
  implementation choice).
- `../../04_logs/expectation-gap-ledger.md` — Entry 4
  (Electron's `accelerator` property reflection on role items).
