# Recipe — Atomic JSON Write

**Use when**: Persisting any JSON file that must survive an app crash mid-write.

## Code

```typescript
// src/storage.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export async function atomicWriteJson(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
  const json = JSON.stringify(data)
  await fs.writeFile(tmpPath, json, 'utf8')
  // fs.rename is atomic on POSIX (same filesystem) and NTFS
  await fs.rename(tmpPath, targetPath)
}

export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

// Call on app startup to clean up any orphaned temp files
export async function sweepOrphanedTmpFiles(dir: string): Promise<number> {
  try {
    const files = await fs.readdir(dir)
    const orphans = files.filter(f => f.endsWith('.tmp'))
    await Promise.all(orphans.map(f => fs.unlink(path.join(dir, f)).catch(() => {})))
    return orphans.length
  } catch { return 0 }
}
```

## Test Pattern

```typescript
import { tmpdir } from 'node:os'
import { mkdtempSync, existsSync } from 'node:fs'

it('atomicWriteJson writes and read back', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'test-'))
  const targetPath = path.join(dir, 'prefs.json')
  await atomicWriteJson(targetPath, { theme: 'dark' })
  expect(existsSync(targetPath)).toBe(true)
  const data = await readJson(targetPath, null)
  expect(data).toEqual({ theme: 'dark' })
})

it('atomicWriteJson leaves no .tmp on success', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'test-'))
  await atomicWriteJson(path.join(dir, 'data.json'), { x: 1 })
  const files = readdirSync(dir)
  expect(files.some(f => f.endsWith('.tmp'))).toBe(false)
})
```

## Watch Out For

- `fs.rename` is only atomic within the same filesystem. If `tmpPath` and `targetPath` are on different filesystems (e.g., different mount points), rename falls back to copy+delete, which is not atomic. In practice, both paths should be under `app.getPath('userData')`.
- Orphaned `.tmp` files accumulate if the process is killed between `writeFile` and `rename`. Sweep them on startup.
- Very large JSON objects (> 50MB) should use SQLite instead — the whole-file rewrite is expensive.

Evidence: `../../05_distillation/patterns/P-03-atomic-write-rename-for-json-persistence.md`
