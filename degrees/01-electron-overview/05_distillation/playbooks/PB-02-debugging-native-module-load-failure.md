# PB-02 — Debugging a native-module load failure

**Symptom**: `Error: The module '...' was compiled against a different Node.js version using NODE_MODULE_VERSION X. This version requires Y.` OR `dlopen failed: symbol not found`.

## Decision tree

1. **Identify the ABI mismatch.** Read the error message:
   - `NODE_MODULE_VERSION 137` ≈ Node 24
   - `NODE_MODULE_VERSION 146` ≈ Electron 42
   - The module was built for the wrong ABI.

2. **Verify the toolchain is present.**
   ```bash
   xcode-select -p          # /Library/Developer/CommandLineTools or Xcode.app/...
   python3 --version        # node-gyp needs Python 3
   node -e "console.log(process.versions)"
   ```

3. **Run the appropriate rebuild.**
   - For Electron: `./node_modules/.bin/electron-rebuild` (or via Forge: `npm run start` triggers it).
   - For system Node tests: `npm rebuild <module> --build-from-source`.

4. **If rebuild fails with C++ compile errors**, you've hit G-13 (or similar). The native module is too stale for the V8 bundled in your Electron.
   ```
   error: too few arguments to function call
   note: candidate function not viable: requires 3 arguments
   ```
   Apply a `#if V8_MAJOR_VERSION >= N` preprocessor-guarded patch to the binding source. See `03_pocs/L-capstone-pulse/scripts/patches/better-sqlite3-v8-tag.mjs` for a template.

5. **If you need the module under BOTH Electron AND system Node** (e.g., vitest + Playwright), set up `pretest` and `pretest:e2e` hooks:
   ```json
   "scripts": {
     "pretest": "npm rebuild <module> --build-from-source",
     "pretest:e2e": "electron-rebuild"
   }
   ```
   OR move inspection through an IPC seam (Decision 12). See G-14.

6. **If the module is required from inside `app.asar` in a packaged build** and fails to load, you forgot `AutoUnpackNativesPlugin` (see P-15). Native `.node` files cannot `require` from inside asar.

## Diagnostic commands

```bash
# Find all .node files in node_modules:
find node_modules -name '*.node' -type f

# Inspect a .node file's linkage (macOS):
otool -L node_modules/<mod>/build/Release/<mod>.node

# Confirm the asar unpacks .node files:
ls -la out/<App>.app/Contents/Resources/app.asar.unpacked/node_modules/<mod>/build/Release/
```

## Evidence

- `01_research/14-native-modules.md`
- `01_research/21-failure-modes.md#FM-02`
- `04_logs/expectation-gap-ledger.md#entry-12`
- `04_logs/debugging-log.md` 2026-05-17 session
- `04_logs/decision-log.md#decision-12`
