/**
 * Notification service for L4.
 *
 * CRITICAL: every call to `show()` MUST register a `failed` listener BEFORE
 * `show()` is invoked. In unsigned dev builds on macOS, notifications fail
 * silently — the only observation we get is the `failed` event (FM-05 / REF-04).
 *
 * Every `failed` event logs `notification:failed:unsigned` AND fires the
 * `onFailed` hook so the renderer can observe it via push IPC.
 *
 * R-L4-3 statically asserts this file always pairs a `failed` listener with
 * each show-call. The runtime BT-L4-3 asserts the dev-build failure path.
 */
import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Logger } from './log'

export interface NotificationButton {
  readonly type: 'button'
  readonly text: string
}

export interface ShowNotificationArgs {
  readonly title: string
  readonly body: string
  readonly actions?: readonly NotificationButton[]
  readonly hasReply?: boolean
  readonly replyPlaceholder?: string
}

export interface ShowResult {
  readonly ok: boolean
  readonly id: string
  readonly failed?: { readonly error: string }
}

export interface NotificationService {
  show(args: ShowNotificationArgs): Promise<ShowResult>
}

export interface InstallNotificationServiceOptions {
  readonly logger: Logger
  readonly onFailed?: (payload: { id: string; error: string }) => void
  /**
   * Bounded wait for either `show` or `failed` to fire. Defaults to 2000ms.
   * After that, we resolve with `{ ok: true, id }` and assume the OS
   * presented the notification (no observable failure).
   */
  readonly resolveTimeoutMs?: number
}

export function installNotificationService(
  opts: InstallNotificationServiceOptions,
): NotificationService {
  const { logger } = opts
  const timeoutMs = opts.resolveTimeoutMs ?? 2_000

  return {
    show: (args: ShowNotificationArgs): Promise<ShowResult> => {
      const id = randomUUID()
      // Build the Notification BEFORE we register `failed`.
      const notification = new Notification({
        title: args.title,
        body: args.body,
        actions: args.actions ? args.actions.map((a) => ({ type: 'button' as const, text: a.text })) : undefined,
        hasReply: args.hasReply,
        replyPlaceholder: args.replyPlaceholder,
      })

      return new Promise<ShowResult>((resolve) => {
        let settled = false
        const finish = (result: ShowResult): void => {
          if (settled) return
          settled = true
          resolve(result)
        }

        // R-L4-3 invariant: the `failed` listener is registered BEFORE
        // the notification is shown. Do not move this below the show-call.
        notification.on('failed', (_event, error) => {
          const message = typeof error === 'string' ? error : String(error)
          logger.warn('notification:failed:unsigned', { id, error: message })
          opts.onFailed?.({ id, error: message })
          finish({ ok: false, id, failed: { error: message } })
        })

        notification.on('show', () => {
          logger.info('notification:shown', { id })
          finish({ ok: true, id })
        })

        notification.on('close', () => {
          logger.info('notification:closed', { id })
        })

        notification.on('click', () => {
          logger.info('notification:click', { id })
        })

        notification.on('action', (_event, actionIndex) => {
          logger.info('notification:action', { id, actionIndex })
        })

        notification.on('reply', (_event, reply) => {
          logger.info('notification:reply', { id, reply })
        })

        try {
          notification.show()
          logger.info('notification:show:requested', { id, title: args.title })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          logger.error('notification:show:threw', { id, message })
          finish({ ok: false, id, failed: { error: message } })
          return
        }

        // Bounded wait — if neither `show` nor `failed` fires within the
        // timeout (which is the case on some non-darwin platforms where the
        // OS presents the notification without firing any of our listeners
        // before the IPC resolves), assume success and resolve.
        setTimeout(() => {
          finish({ ok: true, id })
        }, timeoutMs)
      })
    },
  }
}
