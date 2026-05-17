# Troubleshooting — Native Module Load Failure

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

```
Error: Cannot find module '/path/to/app.asar/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
```

Or:

```
Error: The module was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 146.
```

Or (packaged app only):
```
Error: ENOENT: no such file or directory, open '.../app.asar/node_modules/better-sqlite3/...'
```

---

## Cause → Diagnostic → Fix

### Cause 1: `.node` file inside asar (not unpacked)

Native `.node` binaries cannot be loaded from inside an asar archive. They must reside in `app.asar.unpacked/`.

**Diagnostic**

```bash
npx @electron/asar list app.asar | grep '\.node$'
# If this returns anything, the module is wrongly packed inside asar.
```

**Fix**

Add `AutoUnpackNativesPlugin` to `forge.config.ts`:

```typescript
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

// In plugins array:
new AutoUnpackNativesPlugin({})
```

After re-packaging:
```bash
ls <App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/
# Should exist
```

---

### Cause 2: Wrong ABI — module compiled for system Node, not Electron Node

**Diagnostic**

```bash
node -e "console.log(process.versions.modules)"     # e.g., 137 (Node 24)
npx electron -e "console.log(process.versions.modules)"  # e.g., 146 (Electron 42)
```

If the numbers differ, the `.node` file compiled for one cannot run in the other.

**Fix**

Run `electron-rebuild` to recompile against Electron's Node:

```bash
# Add to package.json devDependencies if not present:
# "@electron/rebuild": "^3.7.1"

npx electron-rebuild
```

Add as a post-install script:
```json
"scripts": {
  "postinstall": "electron-rebuild"
}
```

For CI, ensure rebuild runs after `npm install`:
```bash
npm install && npx electron-rebuild
```

---

### Cause 3: Two-ABI problem — building CLI tools that use the same native module

If you have a script or test runner (Vitest, Jest) that imports `better-sqlite3` from system Node while the Electron app needs the Electron-rebuilt version, you get an ABI conflict — you cannot serve both with one binary.

**Strategy A: Two separate rebuild scripts**

```json
"scripts": {
  "rebuild:electron": "electron-rebuild",
  "rebuild:node": "node-pre-gyp rebuild --runtime=node --target=$(node -e \"process.version.slice(1)\")"
}
```

Use Electron-rebuilt version in the app; system-Node version for CLI/test tooling.

**Strategy B: IPC seam for tests**

Move all native module usage behind an IPC channel. Tests never import `better-sqlite3` directly — they call the IPC channel. This eliminates the ABI conflict entirely.

See [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md) for full treatment.

---

### Cause 4: `better-sqlite3` needs V8 memory cage patch

Electron 32+ enables the V8 memory cage. `better-sqlite3` versions below 11.1.2 crash with a memory violation at runtime.

**Diagnostic**

Check `package.json`:
```json
"better-sqlite3": ">=11.1.2"
```

**Fix**

Upgrade:
```bash
npm install better-sqlite3@latest
npx electron-rebuild
```

---

### Cause 5: Module not in `dependencies` (only `devDependencies`)

Forge bundles only `dependencies`, not `devDependencies`. If `better-sqlite3` is in `devDependencies`, it will be missing in the packaged build.

**Diagnostic**

```bash
cat package.json | grep -A5 '"dependencies"'
# better-sqlite3 must appear here, not in devDependencies
```

**Fix**

```bash
npm install --save better-sqlite3   # not --save-dev
```

---

## Quick Diagnostic Sequence

```bash
# 1. Check ABI mismatch
node -e "console.log('node abi:', process.versions.modules)"
npx electron -e "console.log('electron abi:', process.versions.modules)"

# 2. Confirm electron-rebuild was run
ls node_modules/better-sqlite3/build/Release/better_sqlite3.node

# 3. After packaging, confirm unpacked
npx @electron/asar list app.asar | grep '\.node$'    # should be empty
ls <App>.app/Contents/Resources/app.asar.unpacked/   # should contain better-sqlite3

# 4. Check version compatibility
node -e "require('better-sqlite3')" 2>&1   # system node test
npx electron -e "require('better-sqlite3')" 2>&1   # electron test
```

---

## Related

- [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md) — ABI table, rebuild strategies, two-ABI problem
- [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) — complete forge config + rebuild scripts
- [../labs/lab-08-packaging-and-fuses.md](../labs/lab-08-packaging-and-fuses.md) — packaging verification exercise

Evidence: `../../../05_distillation/playbooks/PB-02-debugging-native-module-load-failure.md`, `../../../05_distillation/patterns/P-15-auto-unpack-natives-for-better-sqlite3.md`
