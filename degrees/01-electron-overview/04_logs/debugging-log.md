# Debugging Log — 01-electron-overview

Transcripts and notes from non-trivial debugging sessions. Append-only.

## Entry Format

```
## Session N — <short title>

- **Date**:
- **Symptom**:
- **Hypothesis path** (what I tried in order):
- **Root cause**:
- **Fix**:
- **Lessons** (promoted to playbook? gotcha? both?):
```

## Sessions

(none yet)

## 2026-05-17 — Capstone Pulse — better-sqlite3 vs Electron 42's V8 14.x

### Symptom

`electron-rebuild` against Electron 42.1.0 (V8 14.8) for `better-sqlite3@12.10.0`
(targeting Node 24 / V8 13.6) fails with three C++ compile errors:

1. `better_sqlite3.cpp:60` — `v8::External::New(isolate, addon)` is missing
   the new `ExternalPointerTypeTag` argument that V8 14.x requires.
2. `util/macros.cpp:30` — `info.Data().As<v8::External>()->Value()` is
   missing the same tag.
3. `util/helpers.cpp:89` — `SetNativeDataProperty(..., 0, ...)` is now
   ambiguous between `AccessorNameSetterCallbackV2`, `AccessorNameSetterCallback`,
   and `nullptr_t` overloads.

### What I tried that DIDN'T work

- **Bump to better-sqlite3 12.10.0 (the latest)** — same errors. The
  binding's V8 API expectations are stale on every published version.
- **Unconditional patches** — add the tag arg + use `kExternalPointerTypeTagDefault`
  + `0 → nullptr`. Compiled fine under Electron 42, but BROKE the system-
  Node rebuild for vitest (`kExternalPointerTypeTagDefault` doesn't exist
  in Node 24's V8 13.6).

### What worked

`scripts/patches/better-sqlite3-v8-tag.mjs` uses C++ preprocessor
conditionals on `V8_MAJOR_VERSION` so the SAME source compiles cleanly
under BOTH V8 13.x and V8 14.x:

```cpp
#if V8_MAJOR_VERSION >= 14
  v8::Local<v8::External> data = v8::External::New(isolate, addon, v8::kExternalPointerTypeTagDefault);
#else
  v8::Local<v8::External> data = v8::External::New(isolate, addon);
#endif
```

And similarly for the `OnlyAddon` macro and the `SetNativeDataProperty(..., nullptr, ...)`
(nullptr is unambiguous on both versions). The patch is idempotent
(re-running detects the sentinel `// pulse-patch` comment and skips) and
runs as `postinstall`.

### Test ABI dance

After `electron-rebuild`, the binary is built for Electron's ABI (146).
Running vitest under system Node (ABI 137) then fails with
`NODE_MODULE_VERSION mismatch`. Resolution: separate npm scripts
(`pretest` rebuilds for Node, `pretest:e2e` rebuilds for Electron) that
flip the binary before each test class.

### Tangentially: SQLite inspection from outside Electron

BT-C-5 originally tried to open the journal.db from the Playwright
process directly via `new Database(dbPath)`. Same ABI mismatch problem —
the test process can't load the Electron-rebuilt binary. Resolution:
`test:get-raw-journal-rows` IPC seam that returns base64 ciphertext
rows from main to the renderer to the Playwright spec. Documented as
Decision 12.

### Files involved

- `03_pocs/L-capstone-pulse/scripts/patches/better-sqlite3-v8-tag.mjs`
- `03_pocs/L-capstone-pulse/package.json` (postinstall + pretest hooks)
- `03_pocs/L-capstone-pulse/src/ipc.ts` (TEST_GET_RAW_JOURNAL_ROWS channel)
- `03_pocs/L-capstone-pulse/src/main.ts` (journal.listRowsForTest adapter)
- `03_pocs/L-capstone-pulse/tests/e2e/journal.spec.ts` (uses the IPC seam)

