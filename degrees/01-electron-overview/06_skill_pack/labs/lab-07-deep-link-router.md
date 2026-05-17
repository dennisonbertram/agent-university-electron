# Lab 07 — Deep Link Router

**Goal**: Implement a custom URL scheme handler with a strict parser and programmatic test emission.

**Prerequisites**: [lab-06-global-shortcut.md](./lab-06-global-shortcut.md), [lessons/06-macos-system-integration.md](../lessons/06-macos-system-integration.md), [lessons/07-app-lifecycle-and-single-instance.md](../lessons/07-app-lifecycle-and-single-instance.md)

**Duration**: ~30 minutes

**POC Reference**: [examples/example-l4-macos-integration.md](../examples/example-l4-macos-integration.md)

## Goal

By the end, you should have:
- `src/protocol.ts` with a strict `parseDeepLink()` function
- `setAsDefaultProtocolClient` called at module scope
- `open-url` listener at module scope (pre-ready)
- A test IPC seam for `app.emit('open-url', ...)` since real OS routing requires packaging
- Playwright tests verifying parse and routing

## Steps

### 1. Create src/protocol.ts

See [recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md):

```typescript
export const SCHEME = 'myapp'

export interface DeepLink {
  scheme: string
  action: string
  params: Record<string, string>
}

export function parseDeepLink(input: unknown): [DeepLink | null, Error | null] {
  if (typeof input !== 'string' || input.length === 0)
    return [null, new Error('input is not a string')]
  if (!input.startsWith(`${SCHEME}://`))
    return [null, new Error(`expected scheme ${SCHEME}`)]
  let url: URL
  try { url = new URL(input) }
  catch (err) { return [null, new Error(`malformed URL: ${String(err)}`)] }
  const action = url.hostname
  if (!action) return [null, new Error('action is empty')]
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(action))
    return [null, new Error('action contains invalid characters')]
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })
  return [{ scheme: SCHEME, action, params }, null]
}
```

### 2. Register protocol at module scope in main.ts

```typescript
// BEFORE app.whenReady() — module-load scope
try {
  app.setAsDefaultProtocolClient(SCHEME)
} catch (err) {
  logger.error('protocol:register:failed', { message: String(err) })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  const [parsed, err] = parseDeepLink(url)
  if (err) {
    logger.warn('deeplink:parse-failed', { url, error: err.message })
    return
  }
  logger.info('deeplink:parsed', { action: parsed!.action, params: parsed!.params })
  // Route to handler
  handleDeepLink(parsed!)
})
```

### 3. Add test IPC seam

```typescript
// TEST_REGISTRY:
{
  channel: 'test:emit-open-url',
  validate: (arg) => {
    if (typeof arg !== 'object' || arg === null) throw new IpcValidationError('expected object')
    const a = arg as any
    if (typeof a.url !== 'string') throw new IpcValidationError('url must be string')
    return { url: a.url as string }
  },
  handler: ({ url }, _ctx) => {
    // Programmatic emission — same listener chain as real OS event
    app.emit('open-url', new Event('open-url'), url)
    return { ok: true }
  },
}
```

### 4. Playwright tests

```typescript
test('BT-dl-01: valid deep link is parsed and logged', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.testEmitOpenUrl('myapp://start?mode=focus')
    )
    await expect.poll(
      () => readLogLines().some(l =>
        l.event === 'deeplink:parsed' &&
        (l.payload as any)?.action === 'start'
      ),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})

test('BT-dl-02: malformed URL logs parse-failed', async () => {
  const { app, window, readLogLines } = await launchApp()
  try {
    await window.evaluate(() =>
      (window as any).api.testEmitOpenUrl('myapp://%invalid')
    )
    await expect.poll(
      () => readLogLines().some(l => l.event === 'deeplink:parse-failed'),
      { timeout: 3000 }
    ).toBe(true)
  } finally { await app.close() }
})
```

### 5. Unit tests for the parser

```typescript
// tests/unit/protocol.spec.ts
import { parseDeepLink } from '../../src/protocol'

describe('parseDeepLink', () => {
  it('parses valid URL', () => {
    const [result, err] = parseDeepLink('myapp://start?mode=focus')
    expect(err).toBeNull()
    expect(result?.action).toBe('start')
    expect(result?.params).toEqual({ mode: 'focus' })
  })
  it('rejects wrong scheme', () => {
    const [, err] = parseDeepLink('https://example.com')
    expect(err).not.toBeNull()
  })
  it('rejects empty action', () => {
    const [, err] = parseDeepLink('myapp:///')
    expect(err).not.toBeNull()
  })
  it('rejects non-string input', () => {
    const [, err] = parseDeepLink(null)
    expect(err).not.toBeNull()
  })
})
```

## Verify

- Unit tests: all four parser cases pass
- Playwright BT-dl-01: `deeplink:parsed` with `action: 'start'` logged
- Playwright BT-dl-02: `deeplink:parse-failed` logged for malformed URL
- Note: real macOS URL routing requires packaging — `open myapp://start` will NOT work in dev. Use the test seam.

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Real `open myapp://start` does nothing | Packaging required — G-15 | Use programmatic emission in dev |
| Test seam fires but handler not called | `open-url` listener attached inside `whenReady` | Move it to module-load scope |
| `deeplink:parse-failed` for valid URLs | Wrong scheme prefix | Check SCHEME constant matches registration |

See [troubleshooting/deep-link-not-firing.md](../troubleshooting/deep-link-not-firing.md).

Evidence: [recipes/recipe-deep-link-handler.md](../recipes/recipe-deep-link-handler.md), `../../05_distillation/patterns/P-11-deep-link-router-via-protocol-and-second-instance.md`, `../../05_distillation/gotchas/G-15-deep-links-require-packaging-on-macos.md`
