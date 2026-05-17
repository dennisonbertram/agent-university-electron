# Recipe — better-sqlite3 with Auto-Unpack

**Use when**: Using better-sqlite3 for local SQLite storage in an Electron app.

## Code

```typescript
// src/db.ts
import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

export function openDatabase(opts: {
  dbPath?: string
  logger: Logger
}): Database.Database {
  const dbPath = opts.dbPath
    ?? process.env.PULSE_DB_PATH
    ?? path.join(app.getPath('userData'), 'app.db')

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')    // Concurrent reads, atomic writes
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')  // Wait up to 5s on SQLITE_BUSY

  opts.logger.info('db:opened', { dbPath })
  return db
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      content     BLOB    NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
  `)
}
```

## forge.config.ts — required for packaged apps

```typescript
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

plugins: [
  new AutoUnpackNativesPlugin({}),  // Extracts better_sqlite3.node from asar
  // ...FusesPlugin...
]
```

After packaging, `better_sqlite3.node` lands at:
```
<App>.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

## Rebuild scripts

```json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "pretest": "npm rebuild better-sqlite3 --build-from-source",
    "pretest:e2e": "electron-rebuild"
  }
}
```

## Two-ABI note

Once rebuilt for Electron (ABI 146), the module cannot be loaded by system Node (ABI 137). Use `pretest` (rebuilds for Node) before unit tests and `pretest:e2e` (rebuilds for Electron) before Playwright tests.

## Test Pattern

```typescript
it('R-db-01: forge.config.ts uses AutoUnpackNativesPlugin', () => {
  const src = readFileSync('forge.config.ts', 'utf8')
  expect(src).toMatch(/AutoUnpackNativesPlugin/)
})
```

## Watch Out For

- `better-sqlite3` may not compile against the latest Electron's V8 without source patches (G-13). If you get C++ compile errors during `electron-rebuild`, apply the preprocessor-guarded patch from the capstone.
- Native `.node` files CANNOT be `require()`d from inside `app.asar` — `AutoUnpackNativesPlugin` is not optional.
- `db.pragma('journal_mode = WAL')` should be called immediately after opening. WAL mode enables concurrent reads without blocking writes.
- Prepared statements (`db.prepare(...)`) are faster than `db.exec()` for repeated operations. Cache them at module scope.
- `db.close()` should be called on `app.on('will-quit', ...)` to flush the WAL and release the file lock.

Evidence: `../../05_distillation/patterns/P-15-auto-unpack-natives-for-better-sqlite3.md`, `../../05_distillation/gotchas/G-13-better-sqlite3-v8-14-incompatibility.md`, `../../05_distillation/gotchas/G-14-node-module-version-mismatch.md`, `../../01_research/14-native-modules.md`
