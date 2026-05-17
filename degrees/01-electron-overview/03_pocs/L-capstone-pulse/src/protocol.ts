/**
 * Deep-link protocol handling for Pulse capstone (`pulse://`).
 *
 * Carries forward L5's strict parser, renaming the scheme `electron-l5` →
 * `pulse`. Same three contracts:
 *   1. Input must be a non-empty string.
 *   2. The URL must use the canonical scheme `pulse:`.
 *   3. The action (`new URL(url).hostname`) must be non-empty AND match
 *      `^[a-z0-9][a-z0-9._-]*$` (R-L4-4 boundary, carried into capstone).
 *
 * Returns `[parsed, null]` on success or `[null, error]` on any malformed
 * input. Never throws.
 */

export interface ParsedDeepLink {
  readonly scheme: string
  readonly action: string
  readonly params: Readonly<Record<string, string>>
}

export type DeepLinkResult =
  | readonly [ParsedDeepLink, null]
  | readonly [null, Error]

export const DEEP_LINK_SCHEME = 'pulse'

const SCHEME_PREFIX = `${DEEP_LINK_SCHEME}://`

export function parseDeepLink(input: unknown): DeepLinkResult {
  if (typeof input !== 'string') {
    return [null, new Error(`parseDeepLink: input must be a string, got ${typeof input}`)] as const
  }
  if (input.length === 0) {
    return [null, new Error('parseDeepLink: input must be non-empty')] as const
  }
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
  if (`${url.protocol.replace(':', '')}` !== DEEP_LINK_SCHEME) {
    return [null, new Error(`parseDeepLink: expected scheme "${DEEP_LINK_SCHEME}", got "${url.protocol}"`)] as const
  }
  const action = url.hostname
  if (action.length === 0) {
    return [null, new Error('parseDeepLink: action (hostname) is empty')] as const
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(action)) {
    return [null, new Error(`parseDeepLink: action "${action}" contains invalid characters`)] as const
  }
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return [{ scheme: DEEP_LINK_SCHEME, action, params }, null] as const
}
