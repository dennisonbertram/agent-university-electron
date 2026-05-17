/**
 * Navigation + window-open guards + permission-handler registration.
 *
 * Registered once per BrowserWindow's `webContents` after the page is loaded.
 * The expected origin is derived from the file:// URL the window was loaded
 * with (captured by `main.ts` and passed in here). Any navigation to a
 * different origin OR any `window.open` is logged and blocked.
 *
 * Per 01_research/05-security-model.md:
 *   - use URL parser, NOT string.startsWith, when comparing origins
 *   - setWindowOpenHandler returns { action: 'deny' } for external URLs
 *   - will-navigate guards must call event.preventDefault()
 */
import type { Session, WebContents } from 'electron'
import { URL } from 'node:url'
import type { Logger } from './log'

export interface SecurityGuardOptions {
  /**
   * The origin the window is "supposed" to be on. Any navigation away from
   * this origin is blocked. For local file:// apps, this is the special
   * origin string 'null' (which is what `new URL('file:///path').origin`
   * resolves to in modern browsers); we accept both 'null' and `file://`
   * prefix to be safe.
   */
  expectedOrigin: string
  logger: Logger
}

/** Returns true if `urlString` is "internal" — same as the expected origin
 *  OR a file:// URL when the window was loaded from file://. */
function isInternalUrl(urlString: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.origin === expectedOrigin) return true
    // file:// URLs all have origin === 'null'; if the expected origin is
    // 'null' (typical for loadFile), then ANY file:// URL counts as internal.
    if (expectedOrigin === 'null' && parsed.protocol === 'file:') return true
    return false
  } catch {
    // Unparseable URL → treat as external (safe default).
    return false
  }
}

export function registerSecurityGuards(
  contents: WebContents,
  opts: SecurityGuardOptions,
): void {
  const { expectedOrigin, logger } = opts

  contents.setWindowOpenHandler(({ url }) => {
    logger.warn('security:window-open:blocked', { url, expectedOrigin })
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url, expectedOrigin)) {
      logger.warn('security:navigation:blocked', { url, expectedOrigin })
      event.preventDefault()
    }
  })

  // Defensive: also block will-redirect (which fires for HTTP redirects but is
  // a no-op for our file:// app; included so future protocol changes inherit
  // the guard).
  contents.on('will-redirect', (event, url) => {
    if (!isInternalUrl(url, expectedOrigin)) {
      logger.warn('security:redirect:blocked', { url, expectedOrigin })
      event.preventDefault()
    }
  })

  // Block attaching <webview> children (defense in depth — webPreferences
  // contextIsolation already prevents attaching, but if a future POC reopens
  // <webview>, this guard rejects the attach with secure defaults).
  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    // Force-strip any insecure flags before the webview attaches.
    delete (webPreferences as Record<string, unknown>).preload
    ;(webPreferences as Record<string, unknown>).nodeIntegration = false
    ;(webPreferences as Record<string, unknown>).contextIsolation = true
    ;(webPreferences as Record<string, unknown>).sandbox = true
    logger.warn('security:webview:normalized', {})
  })
}

/**
 * Denies every permission request from any session. L2's renderer is local
 * trusted code; it needs none of the permission-gated APIs.
 */
export function registerSessionPermissionHandler(session: Session, logger: Logger): void {
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('security:permission:denied', { permission })
    callback(false)
  })

  // The newer setPermissionCheckHandler is invoked for synchronous permission
  // checks like geolocation. Deny by default.
  session.setPermissionCheckHandler((_webContents, permission, _origin) => {
    logger.warn('security:permission:check-denied', { permission })
    return false
  })
}
