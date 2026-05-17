# Native Modules — Electron

Version: Electron 42.1.0 [S22, S32]

## Why Rebuild Is Required

Electron bundles its own Node.js (not the system Node). Native modules (`.node` files compiled with node-gyp) contain compiled machine code linked against a specific Node.js ABI. If the ABI of the bundled Node differs from the ABI the module was compiled for, the module will fail to load at runtime.

Additionally, Electron uses BoringSSL instead of OpenSSL, which can affect modules that link against OpenSSL. [S22]

## ABI Mismatch Error

```
Error: The module '/path/to/better_sqlite3.node' was compiled against a different
Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires
NODE_MODULE_VERSION 127. Please try re-compiling or re-installing...
```

This means the module was compiled for Node's ABI (115) but Electron's bundled Node requires ABI 127. Fix: rebuild. [S22]

## @electron/rebuild

The recommended solution. Detects Electron version, downloads matching headers, rebuilds all native modules.

```bash
# Install
npm install --save-dev @electron/rebuild

# Rebuild all native modules for current Electron
./node_modules/.bin/electron-rebuild

# Or with npm scripts:
# "electron:rebuild": "electron-rebuild"

# Rebuild specific module
./node_modules/.bin/electron-rebuild -m better-sqlite3
```

With Electron Forge, `@electron/rebuild` runs automatically during `npm start` (dev) and `npm run make` (production). No manual invocation needed. [S22]

## Electron Forge Integration

In `forge.config.ts`, `rebuildConfig` controls rebuild behavior:

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  rebuildConfig: {
    force: true, // Always rebuild even if cached
    // 'buildPath' and 'electronVersion' are set by Forge automatically
  },
  // ...
}
```

## Prebuilt Binaries (prebuild-install)

Some modules publish prebuilt binaries for common Electron versions. This avoids needing a C++ toolchain on end-user machines.

```bash
# better-sqlite3 ships prebuilts via prebuild-install
npm install better-sqlite3

# Force rebuild from source if prebuilt doesn't match:
npm install better-sqlite3 --build-from-source
```

With Electron Forge, the rebuild step handles this automatically via `@electron/rebuild`. [S22]

## better-sqlite3 Specifics

```typescript
// Installation
// npm install better-sqlite3
// npm install --save-dev @types/better-sqlite3

// Rebuild command (if not using Forge auto-rebuild):
// ./node_modules/.bin/electron-rebuild -m better-sqlite3

// Import (main process only — not in renderer or preload)
import Database from 'better-sqlite3'

// Database is synchronous by design (intentional design choice)
const db = new Database('/path/to/db.sqlite')
db.pragma('journal_mode = WAL')  // recommended for concurrent reads
db.pragma('foreign_keys = ON')
```

### better-sqlite3 and Universal Binaries

For universal (arm64 + x64) builds, better-sqlite3 must be rebuilt for BOTH architectures. Electron Forge's universal binary maker handles this via `@electron/rebuild` for each architecture.

OPEN QUESTION: Exact configuration needed for universal better-sqlite3 rebuild with Forge. Validate in L5. See `23-open-questions.md`.

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `NODE_MODULE_VERSION mismatch` | Module compiled for wrong ABI | Run `electron-rebuild` |
| `Module did not self-register` | Missing self-registration or DLL mismatch (Windows) | Include `win_delay_load_hook.obj` in binding |
| `The specified procedure could not be found` | Windows: DLL link issue | Ensure `win_delay_load_hook` is correctly set up |
| `dlopen failed: symbol not found` | macOS: OpenSSL vs BoringSSL mismatch | Rebuild from source with Electron headers |
| Module loads in dev but not in packaged app | asar packing of native modules | Add to `asarUnpack` in forge config |

## asar Unpacking for Native Modules

Native `.node` files cannot be required from inside an asar archive. Electron Forge handles this automatically for known native modules, but you can configure explicitly:

```typescript
// forge.config.ts
const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node', // unpack native modules from asar
    },
  },
}
```

Or using the Forge plugin:
```typescript
plugins: [
  new VitePlugin({
    build: [...],
    renderer: [...],
  }),
  new AutoUnpackNativesPlugin({}), // auto-handles *.node extraction
]
```

## Toolchain Requirements

On macOS, native module compilation requires:
- Xcode Command Line Tools (already present per environment probe: `/Library/Developer/CommandLineTools`)
- Python 3 (for node-gyp)
- A C++20-compatible compiler (required since Electron 33) [S29]

```bash
# Verify toolchain
xcode-select -p
python3 --version
node -e "console.log(process.versions)"
```

## Testing Native Modules

```typescript
// Unit test that native module loads correctly
import { describe, it, expect } from 'vitest'

describe('better-sqlite3', () => {
  it('should load and create an in-memory database', () => {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)')
    const insert = db.prepare('INSERT INTO test (val) VALUES (?)')
    insert.run('hello')
    const row = db.prepare('SELECT val FROM test').get()
    expect(row.val).toBe('hello')
    db.close()
  })
})
```

NOTE: This test runs in the Node.js environment (vitest process), not in Electron's renderer. The module must be rebuilt for Electron's ABI to work in the actual app, but can be tested with system Node for unit tests.
