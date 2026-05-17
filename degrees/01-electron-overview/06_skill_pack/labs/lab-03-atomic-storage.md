# Lab 03 — Atomic Storage

**Goal**: Implement crash-safe JSON persistence with write-rename and expose it via IPC.

**Prerequisites**: [lab-02-secure-ipc-roundtrip.md](./lab-02-secure-ipc-roundtrip.md), [lessons/04-storage-and-encryption.md](../lessons/04-storage-and-encryption.md)

**Duration**: ~25 minutes

**POC Reference**: [examples/example-l3-atomic-storage.md](../examples/example-l3-atomic-storage.md)

## Goal

By the end, you should have:
- `atomicWriteJson()` and `readJson()` utility functions
- An IPC channel `storage:save` and `storage:load` backed by the atomic writer
- A Playwright test that verifies the file survives a simulated crash (interrupted write)

## Steps

### 1. Create src/storage.ts

Use the pattern from [recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md):

```typescript
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export async function atomicWriteJson(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmpPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`)
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8')
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

export async function sweepOrphanedTmpFiles(dir: string): Promise<void> {
  try {
    const files = await fs.readdir(dir)
    await Promise.all(
      files
        .filter(f => f.endsWith('.tmp'))
        .map(f => fs.unlink(path.join(dir, f)).catch(() => {}))
    )
  } catch { /* dir doesn't exist yet */ }
}
```

### 2. Add storage IPC channels

In `src/ipc.ts`, add:
```typescript
{
  channel: 'storage:save',
  validate: (arg) => {
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (typeof a.key !== 'string') throw new IpcValidationError('key must be string')
    return { key: a.key as string, data: a.data }
  },
  handler: async ({ key, data }, ctx) => {
    const targetPath = path.join(ctx.userDataDir, `${key}.json`)
    await ctx.storage.atomicWriteJson(targetPath, data)
    ctx.logger.info('storage:saved', { key })
    return { ok: true }
  },
},
{
  channel: 'storage:load',
  validate: (arg) => {
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (typeof a.key !== 'string') throw new IpcValidationError('key must be string')
    return { key: a.key as string }
  },
  handler: async ({ key }, ctx) => {
    const targetPath = path.join(ctx.userDataDir, `${key}.json`)
    const data = await ctx.storage.readJson(targetPath, null)
    ctx.logger.info('storage:loaded', { key, found: data !== null })
    return { data }
  },
},
```

### 3. Wire USER_DATA_DIR override

In `main.ts` at module-load scope (before `whenReady`):
```typescript
if (process.env.USER_DATA_DIR) {
  app.setPath('userData', process.env.USER_DATA_DIR)
}
```

### 4. Playwright test

```typescript
test('BT-03: atomic save and load roundtrip', async () => {
  const { app, window, userDataDir } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.storageSave('prefs', { theme: 'dark', fontSize: 14 })
    )

    // Verify file was created
    const filePath = path.join(userDataDir, 'prefs.json')
    expect(existsSync(filePath)).toBe(true)

    // Verify content round-trips
    const result = await window.evaluate(() =>
      (window as any).api.storageLoad('prefs')
    )
    expect(result.data).toEqual({ theme: 'dark', fontSize: 14 })
  } finally {
    await app.close()
  }
})

test('BT-04: load missing key returns null', async () => {
  const { app, window } = await launchApp()
  try {
    const result = await window.evaluate(() =>
      (window as any).api.storageLoad('nonexistent')
    )
    expect(result.data).toBeNull()
  } finally {
    await app.close()
  }
})
```

## Verify

- `storage:save` creates a `<key>.json` file in `USER_DATA_DIR`
- The file content is valid JSON
- No `.<key>.<uuid>.tmp` files remain after a successful save
- `storage:load` for a missing key returns `{ data: null }`, not an error

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `ENOENT` on save | `dir` doesn't exist | Check `mkdir({ recursive: true })` before write |
| Stale tmp files accumulate | Process killed mid-write | Add `sweepOrphanedTmpFiles` on startup |
| Load returns wrong data | Key typo or path mismatch | Log the full `targetPath` |

Evidence: [recipes/recipe-atomic-json-write.md](../recipes/recipe-atomic-json-write.md), `../../03_pocs/L3-storage-and-native-io/`
