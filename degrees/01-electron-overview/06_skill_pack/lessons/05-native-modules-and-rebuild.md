# Lesson 05 — Native Modules and Rebuild

**Prerequisites**: [04-storage-and-encryption.md](./04-storage-and-encryption.md)  
**Next**: [06-macos-system-integration.md](./06-macos-system-integration.md)

## Why Native Modules Need Rebuilding

Electron ships its own V8 and Node runtime inside the binary. These have different ABI (Application Binary Interface) versions than the system Node.js:

```
System Node 24:       NODE_MODULE_VERSION 137
Electron 42 internal: NODE_MODULE_VERSION 146
```

A native module (`.node` file) is compiled against a specific NODE_MODULE_VERSION. A module compiled for 137 cannot load in Electron 42 (ABI 146) — you get:

```
Error: The module 'better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 146.
```

## electron-rebuild

The `@electron/rebuild` package recompiles native modules against Electron's ABI:

```bash
npm install --save-dev @electron/rebuild

# Rebuild all native modules for Electron
./node_modules/.bin/electron-rebuild

# Or via electron-forge (runs automatically on start/build):
npm run start  # triggers rebuild hook
```

In `package.json`, add a postinstall hook:

```json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

## The Two-ABI Problem

Once rebuilt for Electron's ABI (146), the module cannot load under system Node (ABI 137). This matters if:
- You run Vitest (unit tests) under system Node
- You run Playwright (e2e tests) under Electron

**Strategy A — Two rebuild scripts** (used by L5 and capstone):

```json
{
  "scripts": {
    "pretest": "npm rebuild better-sqlite3 --build-from-source",
    "pretest:e2e": "electron-rebuild"
  }
}
```

Run `npm test` (Vitest, system Node) → `pretest` rebuilds for Node ABI.  
Run `npm run test:e2e` (Playwright, Electron) → `pretest:e2e` rebuilds for Electron ABI.

**Strategy B — IPC seam** (avoids the ABI dance):

Move all SQLite access behind an IPC channel. Unit tests call the IPC handler directly via a `HandlerContext` stub, never loading the native module under system Node. This is the capstone's approach.

## better-sqlite3 and V8 Compatibility

Native modules can trail Electron's V8 by a major version. `better-sqlite3@12.10.0` did not compile against Electron 42's V8 14.x without source patches:

```
error: too few arguments to function call
note: candidate function not viable: requires 3 arguments, but 2 provided
```

Apply a preprocessor-guarded patch:

```javascript
// scripts/patches/better-sqlite3-v8-tag.mjs
// Patches better_sqlite3.cc to add the V8 template argument
// required for V8 >= 14.x
```

The patch script is in the capstone POC at:
`/Users/dennison/develop/agent-university/electron/degrees/01-electron-overview/03_pocs/L-capstone-pulse/scripts/patches/`

Add it as a `postinstall` hook that detects V8 version and conditionally applies:

```javascript
// scripts/postinstall.mjs
import { execSync } from 'node:child_process'
const v8Version = process.versions.v8
const major = parseInt(v8Version.split('.')[0])
if (major >= 14) {
  // apply patch
}
```

## Packaged Apps — Auto-Unpack Natives

Native `.node` files CANNOT be `require()`d from inside an asar archive. The dynamic loader cannot `fopen()` a file inside a zip. Use `AutoUnpackNativesPlugin` in your forge config:

```typescript
// forge.config.ts
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

plugins: [
  new AutoUnpackNativesPlugin({}),
]
```

After packaging, `.node` files land at:
```
<App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

Verify:
```bash
ls -la out/<App>-darwin-arm64/<App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/
```

## Diagnostic Commands

```bash
# Find all .node files in node_modules:
find node_modules -name '*.node' -type f

# Check a .node file's linked library versions (macOS):
otool -L node_modules/better-sqlite3/build/Release/better_sqlite3.node

# Confirm the expected ABI from Electron:
node -e "console.log(process.versions)"

# Rebuild and check:
./node_modules/.bin/electron-rebuild --version 42.1.0
```

## Version Pinning

Pin native module versions exactly — do not use semver ranges:

```json
{
  "dependencies": {
    "better-sqlite3": "12.10.0"
  }
}
```

A `^` allows a patch upgrade that may pull in source changes incompatible with your V8 patch.

## Key Takeaways

1. Electron has its own V8/Node ABI — always rebuild native modules for Electron, not system Node.
2. System Node and Electron ABIs are mutually exclusive in a single build — solve with two rebuild scripts or an IPC seam.
3. Native modules can lag Electron's V8; plan for source patches, not just `electron-rebuild`.
4. Native `.node` files cannot load from inside asar — use `AutoUnpackNativesPlugin`.
5. Pin native module versions exactly.

Evidence: `../../05_distillation/gotchas/G-13-better-sqlite3-v8-14-incompatibility.md`, `../../05_distillation/gotchas/G-14-node-module-version-mismatch.md`, `../../05_distillation/patterns/P-15-auto-unpack-natives-for-better-sqlite3.md`, `../../01_research/14-native-modules.md`
