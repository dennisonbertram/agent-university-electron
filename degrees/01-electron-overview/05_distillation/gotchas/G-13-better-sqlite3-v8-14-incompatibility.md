# G-13 — `better-sqlite3@12.10.0` does not compile against Electron 42's V8 14.x

**Severity**: HIGH
**Surface**: Native modules, build toolchain
**Discovered in**: Capstone Pulse build (`04_logs/expectation-gap-ledger.md#entry-12`)

## Symptom

`npm install better-sqlite3 && npx electron-rebuild` against Electron 42.1.0 fails with three C++ compile errors:

1. `better_sqlite3.cpp:60` — `v8::External::New(isolate, addon)` is missing the new `ExternalPointerTypeTag` argument that V8 14.x requires.
2. `util/macros.cpp:30` — `info.Data().As<v8::External>()->Value()` is missing the same tag arg.
3. `util/helpers.cpp:89` — `SetNativeDataProperty(..., 0, ...)` is ambiguous between `AccessorNameSetterCallbackV2`, `AccessorNameSetterCallback`, and `nullptr_t` overloads.

better-sqlite3 12.10.0 (latest at the time) targets V8 13.x (Node 24). Electron 42.1.0 ships V8 14.8. The combination won't compile.

## Root cause

Native modules that bind directly to V8 internals trail Electron's V8 by up to one major version. better-sqlite3's V8 API expectations are stale on every published version — there is no "newer" release that works against V8 14.x at the time of capture.

## Fix

`#if V8_MAJOR_VERSION >= 14` preprocessor-guarded patches so the SAME source compiles cleanly under both Node 24's V8 13.6 (for vitest) AND Electron 42's V8 14.8 (for Playwright):

```cpp
// scripts/patches/better-sqlite3-v8-tag.mjs writes:
#if V8_MAJOR_VERSION >= 14
  v8::Local<v8::External> data = v8::External::New(
    isolate, addon, v8::kExternalPointerTypeTagDefault);
#else
  v8::Local<v8::External> data = v8::External::New(isolate, addon);
#endif

// And for SetNativeDataProperty: replace `0` with `nullptr` (unambiguous on both).
```

The patch runs as `postinstall` and is idempotent (detects its own sentinel `// pulse-patch` comment to skip re-application).

After the patch:
- `npm rebuild better-sqlite3 --build-from-source` (the `pretest` hook for vitest).
- `electron-rebuild` (the `pretest:e2e` hook for Playwright).

## Test that catches a regression

`tests/unit/journal-store.test.ts` (capstone) — fails to import `better-sqlite3` if the patch hasn't been applied. The patch's idempotency check also runs and asserts the sentinel is present.

## Evidence

- `04_logs/expectation-gap-ledger.md#entry-12`
- `04_logs/debugging-log.md` 2026-05-17 session
- `03_pocs/L-capstone-pulse/scripts/patches/better-sqlite3-v8-tag.mjs`
- `03_pocs/L-capstone-pulse/poc-report.md` §"Expectation gaps recorded"
- `03_pocs/L-capstone-pulse/package.json` (postinstall + pretest hooks)
