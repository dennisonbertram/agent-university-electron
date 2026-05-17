// Patch better-sqlite3@12.x for V8 14.x's `ExternalPointerTypeTag` API.
//
// Electron 42.1.0 ships V8 14.8 which requires:
//   - `External::New(isolate, addon, tag)`  — extra `tag` arg
//   - `External::Value(tag)` — extra `tag` arg
//   - `SetNativeDataProperty(name, getter, nullptr, ...)` — `0` is now ambiguous
//
// Node 24 (system) still ships V8 13.6 with the OLD signatures. We use C++
// preprocessor conditionals on `V8_MAJOR_VERSION` so the SAME source tree
// compiles cleanly under BOTH targets — letting `npm rebuild` work for vitest
// (system Node) AND `electron-rebuild` work for Playwright (Electron 42).
//
// The patch is idempotent: re-running detects the conditional block and skips.
//
// Documented as Entry 12 in expectation-gap-ledger.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')

function patchFile(rel, transform, label) {
  const full = path.join(root, rel)
  if (!existsSync(full)) {
    console.log(`[patch] ${rel} not found — skipping`)
    return
  }
  const src = readFileSync(full, 'utf8')
  const next = transform(src)
  if (next === null) {
    console.log(`[patch] ${label}: source pattern not found`)
    return
  }
  if (next === src) {
    console.log(`[patch] ${label}: already patched`)
    return
  }
  writeFileSync(full, next, 'utf8')
  console.log(`[patch] ${label}: applied`)
}

const SENTINEL_NEW = '#if V8_MAJOR_VERSION >= 14 // pulse-patch'
const SENTINEL_VALUE = '#if V8_MAJOR_VERSION >= 14 // pulse-patch'

// 1) better_sqlite3.cpp External::New
patchFile('node_modules/better-sqlite3/src/better_sqlite3.cpp', (src) => {
  if (src.includes(SENTINEL_NEW)) return src
  const conditional =
    `${SENTINEL_NEW}\n` +
    `\tv8::Local<v8::External> data = v8::External::New(isolate, addon, v8::kExternalPointerTypeTagDefault);\n` +
    `#else\n` +
    `\tv8::Local<v8::External> data = v8::External::New(isolate, addon);\n` +
    `#endif`
  // Match either the original or the previously-unconditional patched form.
  if (src.includes('v8::External::New(isolate, addon, v8::kExternalPointerTypeTagDefault);')) {
    return src.replace(
      /\tv8::Local<v8::External> data = v8::External::New\(isolate, addon, v8::kExternalPointerTypeTagDefault\);/,
      conditional,
    )
  }
  if (src.includes('v8::External::New(isolate, addon);')) {
    return src.replace(
      /\tv8::Local<v8::External> data = v8::External::New\(isolate, addon\);/,
      conditional,
    )
  }
  return null
}, 'better_sqlite3.cpp External::New (conditional on V8_MAJOR_VERSION)')

// 2) util/macros.cpp External::Value
patchFile('node_modules/better-sqlite3/src/util/macros.cpp', (src) => {
  if (src.includes(SENTINEL_VALUE)) return src
  const macroOld = '#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value())'
  const macroNewWithTag = '#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value(v8::kExternalPointerTypeTagDefault))'
  const conditional =
    `${SENTINEL_VALUE}\n` +
    `#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value(v8::kExternalPointerTypeTagDefault))\n` +
    `#else\n` +
    `#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value())\n` +
    `#endif`
  if (src.includes(macroOld)) {
    return src.replace(macroOld, conditional)
  }
  if (src.includes(macroNewWithTag)) {
    return src.replace(macroNewWithTag, conditional)
  }
  return null
}, 'util/macros.cpp OnlyAddon External::Value (conditional)')

// 3) util/helpers.cpp: literal `0` -> `nullptr` for SetNativeDataProperty.
patchFile('node_modules/better-sqlite3/src/util/helpers.cpp', (src) => {
  const oldPat = '\t\tInternalizedFromLatin1(isolate, name),\n\t\tfunc,\n\t\t0,\n\t\tdata'
  const newPat = '\t\tInternalizedFromLatin1(isolate, name),\n\t\tfunc,\n\t\tnullptr,\n\t\tdata'
  if (src.includes(newPat)) return src
  if (src.includes(oldPat)) return src.replace(oldPat, newPat)
  return null
}, 'util/helpers.cpp SetNativeDataProperty 0->nullptr')

console.log('[patch] done')
