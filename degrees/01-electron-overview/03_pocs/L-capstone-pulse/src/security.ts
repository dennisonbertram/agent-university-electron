/**
 * Navigation + window-open guards + permission-handler registration.
 * Carry-forward from L2/L5 — unchanged semantics. The expected origin for
 * Pulse's popover window is the file:// origin ("null").
 */
import type { Session, WebContents } from 'electron'
import { URL } from 'node:url'
import type { Logger } from './log'

export interface SecurityGuardOptions {
  expectedOrigin: string
  logger: Logger
}

function isInternalUrl(urlString: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.origin === expectedOrigin) return true
    if (expectedOrigin === 'null' && parsed.protocol === 'file:') return true
    return false
  } catch {
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

  contents.on('will-redirect', (event, url) => {
    if (!isInternalUrl(url, expectedOrigin)) {
      logger.warn('security:redirect:blocked', { url, expectedOrigin })
      event.preventDefault()
    }
  })

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    delete (webPreferences as Record<string, unknown>).preload
    ;(webPreferences as Record<string, unknown>).nodeIntegration = false
    ;(webPreferences as Record<string, unknown>).contextIsolation = true
    ;(webPreferences as Record<string, unknown>).sandbox = true
    logger.warn('security:webview:normalized', {})
  })
}

export function registerSessionPermissionHandler(session: Session, logger: Logger): void {
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('security:permission:denied', { permission })
    callback(false)
  })
  session.setPermissionCheckHandler((_webContents, permission, _origin) => {
    logger.warn('security:permission:check-denied', { permission })
    return false
  })
}
