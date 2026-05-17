# G-14 — Native module ABI mismatch between Electron-rebuild and system Node

**Severity**: high
**Surface**: Native modules, dual-ABI testing
**Discovered in**: Capstone BT-C-5 first-attempt (`04_logs/decision-log.md#decision-12`)

## Symptom

Test process running under system Node (NODE_MODULE_VERSION 137) tries to load `better_sqlite3.node` that was rebuilt for Electron 42 (NODE_MODULE_VERSION 146):

```
Error: The module '/path/to/better_sqlite3.node' was compiled against a
different Node.js version using NODE_MODULE_VERSION 146. This version
of Node.js requires NODE_MODULE_VERSION 137.
```

You cannot run the same binary under both Playwright (Electron's V8) AND vitest (system Node's V8).

## Root cause

Native modules contain pre-compiled machine code linked against a specific Node.js ABI. Electron bundles its own Node with a different ABI from your system Node. After `electron-rebuild`, the binary is good for Electron but not for system Node. After `npm rebuild`, the inverse.

## Fix

Three viable strategies:

1. **Two rebuild passes** — `pretest` hook runs `npm rebuild <module> --build-from-source`; `pretest:e2e` runs `electron-rebuild`. The binary is rebuilt for the right ABI before each test class. Adds ~30s per test-class switch.
2. **In-process IPC test seam** — never load the native module from outside Electron. Inspect SQLite (or other native-backed data) by calling a `test:get-raw-journal-rows` IPC channel from the Playwright spec. The data flows main → renderer → Playwright assertions. This is Decision 12 in the capstone.
3. **Pure-JS fallback** — for `better-sqlite3`, switch to `sql.js` (pure-WASM SQLite). Acceptable performance loss for tests that don't measure throughput.

The capstone uses **option 2** (IPC seam) because it's portable and gated by `testHooksEnabled()`.

## Test that catches a regression

`tests/unit/journal-store.test.ts` (capstone) — fails to import `better-sqlite3` if the binary is built for the wrong ABI.

## Evidence

- `04_logs/decision-log.md#decision-12`
- `04_logs/debugging-log.md` 2026-05-17 §"Test ABI dance"
- `01_research/21-failure-modes.md#FM-02`
- `01_research/14-native-modules.md` lines 12-20
