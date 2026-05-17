# Assessment 03 — IPC, Storage, and Native Modules

Tests understanding of IPC registry, storage patterns, native modules, and encryption.

Back to [../index.md](../index.md) | [assessment-02-security.md](./assessment-02-security.md) | [assessment-04-macos-integration.md](./assessment-04-macos-integration.md)

---

## Questions

**Q1.** What is the "atomic write-rename" pattern and why is it needed? What failure scenario does it protect against that a direct `writeFileSync` does not?

**Q2.** `safeStorage.encryptString('secret')` returns a `Buffer`. What determines which OS keychain the data is stored in, and what happens if the app is reinstalled with a different `CFBundleIdentifier`?

**Q3.** You're adding `better-sqlite3` to an Electron 42 app. List every step required from `npm install` to verified working in a packaged build.

**Q4.** What is NODE_MODULE_VERSION and why do Node.js 24 and Electron 42 have different values? What are the actual values?

**Q5.** A developer writes this test:
```typescript
import Database from 'better-sqlite3'
test('db insert works', () => {
  const db = new Database(':memory:')
  // ...
})
```
This test runs with Vitest (system Node.js 24). The app uses Electron-rebuilt `better-sqlite3`. Will this test pass or fail? Why?

**Q6.** What is the `fs.watch` gotcha on macOS (G-04) with atomic write-rename? What alternative is recommended?

**Q7.** Why is `PRAGMA journal_mode=WAL` recommended for Electron SQLite apps? What does WAL stand for?

**Q8.** Describe the PBKDF2 passphrase storage pattern used in this skill pack. What are the parameters (iterations, algorithm, salt) and why is `timingSafeEqual` required instead of `===`?

---

## Answer Key

**A1.** Atomic write-rename: write data to `file.json.tmp`, then call `fs.renameSync('file.json.tmp', 'file.json')`. On POSIX systems, `rename` is atomic at the filesystem level — it either fully completes or doesn't. With direct `writeFileSync`, if the process crashes mid-write (power failure, SIGKILL), the file is left partially written and corrupted. With write-rename, if the crash happens during the `.tmp` write, the original `file.json` is untouched. If the crash happens after rename, the new data is complete.

**A2.** `safeStorage` uses the OS keychain scoped to the app's bundle ID (`CFBundleIdentifier`). On macOS, data encrypted with bundle ID `com.example.myapp` can only be decrypted by an app with the same bundle ID. If the app is reinstalled with a different bundle ID (or the bundle ID changes between development and production builds), `safeStorage.decryptString()` will throw or return garbage — the data is unrecoverable without the original bundle ID.

**A3.** Complete steps:
1. `npm install --save better-sqlite3` (in `dependencies`, not `devDependencies`)
2. `npm install --save-dev @electron/rebuild`
3. Add `"postinstall": "electron-rebuild"` to `package.json` scripts
4. Run `npx electron-rebuild` (or let postinstall run it)
5. Add `AutoUnpackNativesPlugin` to `forge.config.ts` plugins array
6. Run `npm run package`
7. Verify: `npx @electron/asar list app.asar | grep '\.node$'` → empty
8. Verify: `ls <App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/` → exists
9. Verify: app launches and DB operations work

**A4.** NODE_MODULE_VERSION (Node Module ABI) is the binary interface version for compiled native modules. A `.node` file compiled for one ABI cannot be loaded by a runtime with a different ABI. Node.js 24 = ABI **137**, Electron 42 = ABI **146**. They differ because Electron ships its own patched Node.js — same major version, different ABI due to Electron-specific patches and compile options.

**A5.** It depends on which binary `better-sqlite3` resolves to. If `electron-rebuild` has been run and only the Electron ABI binary exists, the test will **fail** because Vitest runs on system Node.js (ABI 137) which cannot load a binary compiled for ABI 146. If the system-node binary also exists (via two-ABI strategy), the test passes. This is the two-ABI problem. Best practice: move DB operations behind an IPC seam so tests never import `better-sqlite3` directly.

**A6.** macOS `fs.watch` uses `kqueue` internally. `kqueue` fires for file content changes and direct writes, but NOT for atomically renamed files — the rename operation doesn't trigger a `kqueue` change event on the target path. So a watcher on `file.json` won't fire when you write to `file.json.tmp` and rename it. Alternative: use polling (e.g., `chokidar` with `usePolling: true`) or design the system to not need a watcher (use IPC to notify the renderer instead).

**A7.** WAL = Write-Ahead Logging. In WAL mode, writes go to a separate WAL file first, then are checkpointed to the main database. Benefits: (1) readers don't block writers and writers don't block readers — important for Electron where renderer and main share a database, (2) faster write throughput for many small transactions, (3) improved crash recovery — uncommitted transactions in the WAL file are discarded cleanly on recovery.

**A8.** PBKDF2 parameters: `algorithm: 'sha256'`, `iterations: 100000`, `keylen: 32`, `salt: crypto.randomBytes(16)` (fresh random salt per hash). The derived key and salt are stored together (e.g., `salt + ':' + key.toString('hex')`). Verification: derive key from entered passphrase + stored salt, compare with `crypto.timingSafeEqual(stored, derived)`. `timingSafeEqual` is required because `===` for strings does a short-circuit comparison — it returns `false` the moment it finds a mismatching character. This timing difference can be measured (timing attack) to narrow down the correct passphrase one character at a time. `timingSafeEqual` always takes the same time regardless of where the mismatch occurs.

---

## Relevant Files

- [../lessons/04-storage-and-encryption.md](../lessons/04-storage-and-encryption.md)
- [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md)
- [../recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md)
- [../recipes/recipe-safestorage-encryption.md](../recipes/recipe-safestorage-encryption.md)
- [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md)
- [../recipes/recipe-pbkdf2-passphrase.md](../recipes/recipe-pbkdf2-passphrase.md)
- [../reference/electron-version-compatibility.md](../reference/electron-version-compatibility.md)
