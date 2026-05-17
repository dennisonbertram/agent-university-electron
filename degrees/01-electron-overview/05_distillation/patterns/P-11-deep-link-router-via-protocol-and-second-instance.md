# P-11 — Deep-link router via `open-url` + `second-instance` + strict parser

**When to use**: every custom URL scheme.
**Evidence**: L4 BT-L4-6/7 (`03_pocs/L4-deep-macos-integration/src/lifecycle.ts`), capstone (`03_pocs/L-capstone-pulse/src/protocol.ts`).

## Pattern

```typescript
// src/protocol.ts — strict parser
export const DEEP_LINK_SCHEME = 'pulse'
const SCHEME_PREFIX = `${DEEP_LINK_SCHEME}://`

export function parseDeepLink(input: unknown): DeepLinkResult {
  if (typeof input !== 'string' || input.length === 0) return [null, new Error('...')]
  if (!input.startsWith(SCHEME_PREFIX)) return [null, new Error('expected scheme')]
  let url: URL
  try { url = new URL(input) } catch (err) { return [null, /* ... */] }
  if (`${url.protocol.replace(':', '')}` !== DEEP_LINK_SCHEME) return [null, /* ... */]
  const action = url.hostname
  if (action.length === 0) return [null, new Error('action is empty')]
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(action)) return [null, /* ... */]
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })
  return [{ scheme: DEEP_LINK_SCHEME, action, params }, null]
}
```

```typescript
// src/main.ts — module-load scope, BEFORE whenReady
app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)

// Cold-launch routing on macOS — open-url
app.on('open-url', (event, url) => {
  event.preventDefault()
  state.lifecycle?.dispatchArgs([url], 'open-url')
})

// Cold-launch routing on Windows/Linux — argv via second-instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit() }
app.on('second-instance', (_event, argv) => {
  state.lifecycle?.dispatchArgs(argv, 'second-instance')
})
```

```typescript
// src/lifecycle.ts — single dispatch point
function dispatchUrl(url: string, origin: 'open-url' | 'second-instance') {
  const [parsed, err] = parseDeepLink(url)
  if (err) {
    logger.warn('deeplink:parse-failed', { url, error: err.message })
    return
  }
  logger.info('deeplink:parsed', { ...parsed, origin })
  onDeepLink(parsed, origin)
}
```

## Why it works

- **Single dispatch path** — both `open-url` (macOS) and `second-instance` (Windows/Linux) funnel through `dispatchArgs` → `dispatchUrl` → `parseDeepLink` → router.
- **Strict parser** rejects malformed input: type check + non-empty + scheme prefix + valid hostname charset. R-L4-4 boundary array (`pulse://`, `pulse://%`, `pulse:/oops`) asserts each rejection.
- **Pre-whenReady registration** catches cold-launch URLs that arrive before the app is fully booted.
- **Single-instance lock** ensures a second `.app` invocation routes its URL to the existing instance instead of spawning a duplicate.

## Tradeoffs

- macOS-only test path requires packaging for real OS routing (FM-06). Dev tests use `app.emit('open-url', ...)` simulation.
- The parser rejects perfectly valid IRIs with non-ASCII action names. If you need Unicode actions, widen the regex.

## Variants

- **`protocol.handle('pulse', handler)`** — Electron 35+ replacement for `registerStringProtocol` and friends. Use for content-protocol handling (e.g., serving static files), NOT for OS-level URL routing.

## Evidence

- `03_pocs/L-capstone-pulse/src/protocol.ts`
- `03_pocs/L-capstone-pulse/src/main.ts:124-143`
- `03_pocs/L4-deep-macos-integration/poc-report.md` BT-L4-6, BT-L4-7
- `01_research/11-deep-links-protocol.md`
