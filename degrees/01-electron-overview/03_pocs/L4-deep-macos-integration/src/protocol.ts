/**
 * Deep-link protocol handling for L4 (`electron-l4://`).
 *
 * Pure URL-parsing helper + module-scope state for the pending-deep-link buffer.
 *
 * `parseDeepLink(url)` returns a tuple:
 *   - on success: `[parsed, null]`, where `parsed` has shape
 *     `{ scheme, action, params }`.
 *   - on failure: `[null, error]` where `error` is an `Error` with a stable
 *     message describing why the URL was rejected (R-L4-4 boundary cases).
 *
 * RED commit: stub returns the error path for every input so BT-L4-6/7 fail.
 */

export interface ParsedDeepLink {
  readonly scheme: string
  readonly action: string
  readonly params: Readonly<Record<string, string>>
}

export type DeepLinkResult =
  | readonly [ParsedDeepLink, null]
  | readonly [null, Error]

export const DEEP_LINK_SCHEME = 'electron-l4'

export function parseDeepLink(_url: unknown): DeepLinkResult {
  return [null, new Error('parseDeepLink: not implemented (RED)')] as const
}
