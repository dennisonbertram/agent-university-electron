/**
 * Notification service for L4.
 *
 * CRITICAL: every call to `show()` MUST register a `failed` listener BEFORE
 * `show()` is invoked. In unsigned dev builds on macOS, notifications fail
 * silently — the only observation we get is the `failed` event (FM-05 / REF-04).
 *
 * Every `failed` event is logged with `notification:failed:unsigned` and (in
 * test mode) surfaced via the IPC push so the e2e harness can assert.
 *
 * R-L4-3 statically asserts this file always pairs a `failed` listener with
 * each `.show()` call.
 *
 * RED commit: the service throws on construction so BT-L4-3 fails on real
 * runtime behavior.
 */
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
  /** Called from the failed listener so the renderer can observe it. */
  readonly onFailed?: (payload: { id: string; error: string }) => void
}

export function installNotificationService(
  _opts: InstallNotificationServiceOptions,
): NotificationService {
  return {
    show: async (_args: ShowNotificationArgs): Promise<ShowResult> => {
      // CRITICAL: this stub does NOT yet register the failed listener path;
      // GREEN commit will implement: build Notification, attach `failed`,
      // call .show(), resolve on either show or failed.
      throw new Error('NotificationService.show: not implemented (RED)')
    },
  }
}
