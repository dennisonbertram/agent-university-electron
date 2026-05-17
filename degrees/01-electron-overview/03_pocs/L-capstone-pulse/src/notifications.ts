/**
 * Notification service for Pulse.
 *
 * Carries forward L4/L5's R-L4-3 invariant: every show() pairs a `failed`
 * listener BEFORE the show() call. In unsigned dev builds on macOS,
 * notifications fail silently — the `failed` event is the only observable.
 *
 * NEW for capstone:
 *   - Tracks issued notification IDs so the test seam
 *     `test:trigger-notification-action({ id, action })` can invoke the
 *     registered action handler programmatically (BT-C-3).
 *   - The action-handler registry is keyed by notification id and action
 *     index/name. Tests assert the action handler runs.
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
  /**
   * Test seam: register a callback for a notification's action button. The
   * focus engine calls this BEFORE calling show() so the test IPC can resolve
   * it later.
   */
  registerActionHandler(id: string, handler: (actionIndex: number) => void): void
  triggerActionForTest(id: string, actionIndex: number): { ok: boolean; reason?: string }
}

export interface InstallNotificationServiceOptions {
  readonly logger: Logger
  readonly onFailed?: (payload: { id: string; error: string }) => void
  readonly resolveTimeoutMs?: number
}

export function installNotificationService(
  opts: InstallNotificationServiceOptions,
): NotificationService {
  const { logger } = opts
  const timeoutMs = opts.resolveTimeoutMs ?? 2_000
  const actionHandlers = new Map<string, (idx: number) => void>()
  let lastShownId: string | null = null

  return {
    show: (args: ShowNotificationArgs): Promise<ShowResult> => {
      const id = randomUUID()
      lastShownId = id
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

        // R-L4-3: `failed` listener registered BEFORE show().
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
          const handler = actionHandlers.get(id)
          if (handler) {
            try {
              handler(actionIndex)
            } catch (err) {
              logger.error('notification:action:handler-threw', {
                id, message: err instanceof Error ? err.message : String(err),
              })
            }
          }
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

        setTimeout(() => {
          finish({ ok: true, id })
        }, timeoutMs)
      })
    },
    registerActionHandler(id: string, handler: (actionIndex: number) => void): void {
      actionHandlers.set(id, handler)
      logger.info('notification:action-handler:registered', { id })
    },
    triggerActionForTest(id: string, actionIndex: number): { ok: boolean; reason?: string } {
      // The test seam may pass id === 'latest' meaning "the last issued id".
      const realId = id === 'latest' && lastShownId ? lastShownId : id
      const handler = actionHandlers.get(realId)
      if (!handler) {
        logger.warn('notification:trigger-action:no-handler', { id: realId, actionIndex })
        return { ok: false, reason: 'no-handler' }
      }
      try {
        handler(actionIndex)
        logger.info('notification:trigger-action:invoked', { id: realId, actionIndex })
        return { ok: true }
      } catch (err) {
        logger.error('notification:trigger-action:threw', {
          id: realId, message: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, reason: 'handler-threw' }
      }
    },
  }
}
