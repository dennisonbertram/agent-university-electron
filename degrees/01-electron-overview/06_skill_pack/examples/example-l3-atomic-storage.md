# Example — L3: Atomic Storage

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Purpose

The L3 implementation adds three storage layers: atomic JSON write-rename for crash-safe persistence, safeStorage encryption for sensitive values, and SQLite + WAL for structured data with row-level encryption.

---

## Patterns Demonstrated

| Pattern | File | Recipe |
|---|---|---|
| Atomic write-rename | `src/storage.ts` | [../recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md) |
| safeStorage encryption | `src/crypto.ts` | [../recipes/recipe-safestorage-encryption.md](../recipes/recipe-safestorage-encryption.md) |
| SQLite + WAL + row encryption | `src/db.ts` | [../recipes/recipe-better-sqlite3-with-auto-unpack.md](../recipes/recipe-better-sqlite3-with-auto-unpack.md) |
| PBKDF2 passphrase | `src/passphrase.ts` | [../recipes/recipe-pbkdf2-passphrase.md](../recipes/recipe-pbkdf2-passphrase.md) |
| USER_DATA_DIR env override | `src/storage.ts` | [../lessons/04-storage-and-encryption.md](../lessons/04-storage-and-encryption.md) |

---

## Source File Map

| File | Description |
|---|---|
| `src/storage.ts` | `atomicWriteJson()`, `readJson()`, `sweepOrphanedTmpFiles()` |
| `src/crypto.ts` | `buildEncryptor()` using `safeStorage`; fallback for unavailable |
| `src/db.ts` | `openDatabase()`, `runMigrations()`, `insertEntry()` with encrypted payload |
| `src/passphrase.ts` | `hashPassphrase()`, `verifyPassphrase()` with PBKDF2 + timingSafeEqual |
| `forge.config.ts` | `AutoUnpackNativesPlugin` config |
| `package.json` | `"postinstall": "electron-rebuild"` |
| `tests/storage.spec.ts` | Playwright: save/load cycle, crash-safety, orphan sweep |
| `tests/db.spec.ts` | Playwright: insert, retrieve, decrypt |

---

## Key Learning Points

1. **`tmp` → `rename` atomicity**: On same-filesystem, `fs.renameSync` is atomic. Write to `file.json.tmp`, then rename to `file.json`.
2. **safeStorage bundle scope**: Encrypted values are tied to the app's `CFBundleIdentifier`. If the bundle ID changes, previously encrypted data cannot be decrypted.
3. **WAL mode**: `PRAGMA journal_mode=WAL` must be set immediately after opening the database. Default mode is `DELETE` which is slower for reads.
4. **electron-rebuild**: Must run after `npm install`. The `better-sqlite3` binary compiled for system Node (ABI 137) crashes in Electron 42 (ABI 146).
5. **fs.watch gotcha (G-04)**: `fs.watch` uses `kqueue` on macOS, which doesn't fire for atomically renamed files. Use polling or `chokidar` instead.

---

## Corresponding Lab

[../labs/lab-03-atomic-storage.md](../labs/lab-03-atomic-storage.md) — implement atomic JSON persistence.

---

## Corresponding Lessons

- [../lessons/04-storage-and-encryption.md](../lessons/04-storage-and-encryption.md)
- [../lessons/05-native-modules-and-rebuild.md](../lessons/05-native-modules-and-rebuild.md)

Evidence: `../../../05_distillation/patterns/P-03-atomic-write-rename-for-json-persistence.md`, `../../../05_distillation/patterns/P-04-journal-as-sqlite-with-safestorage.md`, `../../../05_distillation/patterns/P-16-passphrase-fallback-with-pbkdf2.md`
