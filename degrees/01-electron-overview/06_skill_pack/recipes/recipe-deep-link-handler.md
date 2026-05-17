# Recipe — Deep Link Handler

**Use when**: Implementing a custom URL scheme (`myapp://action?param=value`).

## Code

```typescript
// src/protocol.ts
export const SCHEME = 'myapp'
const PREFIX = `${SCHEME}://`

export interface DeepLink {
  scheme: string
  action: string
  params: Record<string, string>
}

export function parseDeepLink(input: unknown): [DeepLink | null, Error | null] {
  if (typeof input !== 'string' || input.length === 0)
    return [null, new Error('not a string')]
  if (!input.startsWith(PREFIX))
    return [null, new Error(`expected ${SCHEME}:// scheme`)]
  let url: URL
  try { url = new URL(input) }
  catch (err) { return [null, new Error(`malformed URL: ${String(err)}`)] }
  const action = url.hostname
  if (!action || action.length === 0)
    return [null, new Error('action is empty')]
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(action))
    return [null, new Error('action contains invalid characters')]
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })
  return [{ scheme: SCHEME, action, params }, null]
}
```

```typescript
// src/main.ts — module-load scope (BEFORE whenReady)
import { app } from 'electron'
import { SCHEME, parseDeepLink } from './protocol'

// Register this app as the handler for the scheme
try { app.setAsDefaultProtocolClient(SCHEME) } catch {}

// Cold-launch handler (macOS): fires before whenReady
app.on('open-url', (event, url) => {
  event.preventDefault()
  const [parsed, err] = parseDeepLink(url)
  if (err) { logger.warn('deeplink:parse-failed', { url, error: err.message }); return }
  logger.info('deeplink:parsed', { action: parsed!.action, params: parsed!.params })
  // Route to your handler
})

// Windows/Linux: second-instance event carries URL in argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find(a => a.startsWith(`${SCHEME}://`))
  if (url) { /* route same as above */ }
  // Also: focus the existing window
})
```

## forge.config.ts (packaging — required for macOS OS routing)

```typescript
packagerConfig: {
  // Either use protocols:
  protocols: [{ name: 'My App', schemes: [SCHEME] }],
  // OR use extendInfo (NOT both — G-09):
  // extendInfo: { CFBundleURLTypes: [{ CFBundleURLSchemes: [SCHEME], CFBundleURLName: '...' }] }
}
```

## Test Seam for Dev

```typescript
// TEST_REGISTRY IPC channel:
{
  channel: 'test:emit-open-url',
  validate: (arg) => { /* validate { url: string } */ },
  handler: ({ url }) => {
    app.emit('open-url', new Event('open-url'), url)
    return { ok: true }
  },
}
```

## Watch Out For

- Real OS routing via `open-url` requires a packaged `.app` on macOS (G-15). `npx electron .` never receives `open-url`. Use the test seam for dev.
- `packagerConfig.protocols` and `extendInfo.CFBundleURLTypes` do NOT merge (G-09). Use one or the other.
- `setAsDefaultProtocolClient` MUST be called BEFORE `app.whenReady()` — cold-launch URLs arrive before ready.
- The `open-url` listener MUST also be BEFORE `app.whenReady()` — same reason.

Evidence: `../../05_distillation/patterns/P-11-deep-link-router-via-protocol-and-second-instance.md`, `../../05_distillation/gotchas/G-15-deep-links-require-packaging-on-macos.md`, `../../05_distillation/gotchas/G-09-packager-protocols-overrides-extendinfo-bundleurltypes.md`
