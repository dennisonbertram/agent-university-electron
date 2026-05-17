# P-03 — Atomic write-rename for JSON persistence

**When to use**: any persistence that must survive an app crash mid-write.
**Evidence**: L3 storage adapter (`03_pocs/L3-storage-and-native-io/src/storage.ts`).

## Pattern

```typescript
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export async function atomicWriteJson(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
  const json = JSON.stringify(data)
  await fs.writeFile(tmpPath, json, 'utf8')
  // The fs.rename is atomic within a single filesystem on POSIX and NTFS.
  await fs.rename(tmpPath, targetPath)
}
```

## Why it works

- A crash between `writeFile` and `rename` leaves the original file untouched; only the temp file is orphaned.
- A crash during `rename` is atomic — the OS guarantees either the new file or the old file is visible, never a mix.
- The temp filename includes a random UUID so concurrent writes don't collide.

## Tradeoffs

- Two file-system operations per write — costlier than a single `writeFile` overwrite.
- The temp file lives in the same directory; if disk-quota is tight, double the space.
- Orphaned `.<name>.<uuid>.tmp` files accumulate if the rename fails. Sweep them on app start.

## Variants

- **Add `fs.fsync` for D-in-ACID guarantees** — `await fs.open(tmpPath, 'r').then(fd => fd.sync())` before rename. The L3 adapter omits this; the capstone's better-sqlite3 backend provides this via WAL.
- **Use SQLite with WAL** for relational data — atomicity comes from the SQLite engine, not the FS dance.

## Evidence

- `03_pocs/L3-storage-and-native-io/src/storage.ts`
- `03_pocs/L3-storage-and-native-io/poc-report.md` §"Invariants future POCs depend on"
- `03_pocs/L2-secure-ipc/poc-report.md` §6 recommendation 1
