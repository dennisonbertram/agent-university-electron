/**
 * Deep-link protocol handling for L5 (`electron-l5://`).
 *
 * L5 renames the scheme from `electron-l5` to `electron-l5` so a packaged L5
 * build and a packaged L4 build can co-exist on the same machine without
 * fighting for `setAsDefaultProtocolClient`. The scheme is registered in the
 * packaged app's `Info.plist` via the Forge `protocols` entry (BT-L5-3) and
 * also via `app.setAsDefaultProtocolClient` at runtime so dev-mode test seams
 * can route URLs into the running process.
 *
 * `parseDeepLink(url)` returns a tuple:
 *   - on success: `[parsed, null]` with shape `{ scheme, action, params }`.
 *   - on failure: `[null, error]` for any malformed input (R-L4-4 boundary,
 *     carried into L5 unchanged).
 *
 * The parser is intentionally strict about three things:
 *   1. Input must be a non-empty string.
 *   2. The URL must use the canonical scheme `electron-l5:`.
 *   3. The action component (`new URL(url).hostname`) must be non-empty.
 *      `electron-l5://` (no host) is therefore rejected as malformed.
 */

export interface ParsedDeepLink {
  readonly scheme: string
  readonly action: string
  readonly params: Readonly<Record<string, string>>
}

export type DeepLinkResult =
  | readonly [ParsedDeepLink, null]
  | readonly [null, Error]

export const DEEP_LINK_SCHEME = 'electron-l5'

const SCHEME_PREFIX = `${DEEP_LINK_SCHEME}://`

export function parseDeepLink(input: unknown): DeepLinkResult {
  if (typeof input !== 'string') {
    return [null, new Error(`parseDeepLink: input must be a string, got ${typeof input}`)] as const
  }
  if (input.length === 0) {
    return [null, new Error('parseDeepLink: input must be non-empty')] as const
  }
  // Strict scheme prefix gate. We want `electron-l5://action`, not
  // `electron-l5:/action` or any other variant. Reject anything else.
  if (!input.startsWith(SCHEME_PREFIX)) {
    return [null, new Error(`parseDeepLink: expected scheme "${DEEP_LINK_SCHEME}://"`)] as const
  }

  let url: URL
  try {
    url = new URL(input)
  } catch (err) {
    return [
      null,
      new Error(`parseDeepLink: malformed URL — ${err instanceof Error ? err.message : String(err)}`),
    ] as const
  }
  // Normalise the scheme.
  if (`${url.protocol.replace(':', '')}` !== DEEP_LINK_SCHEME) {
    return [null, new Error(`parseDeepLink: expected scheme "${DEEP_LINK_SCHEME}", got "${url.protocol}"`)] as const
  }
  // Action lives in hostname (electron-l5://action). With a malformed URL like
  // `electron-l5://` the hostname is empty — reject (R-L4-4). Also reject
  // hostnames containing characters other than letters / digits / `-` / `_` /
  // `.` so that boundary cases like `electron-l5://%` are rejected even though
  // Node's URL parser accepts them.
  const action = url.hostname
  if (action.length === 0) {
    return [null, new Error('parseDeepLink: action (hostname) is empty')] as const
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(action)) {
    return [null, new Error(`parseDeepLink: action "${action}" contains invalid characters`)] as const
  }

  // Decode the query string into a plain Record. URLSearchParams handles `+`
  // as a space per the URL standard.
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })

  return [
    {
      scheme: DEEP_LINK_SCHEME,
      action,
      params,
    },
    null,
  ] as const
}
