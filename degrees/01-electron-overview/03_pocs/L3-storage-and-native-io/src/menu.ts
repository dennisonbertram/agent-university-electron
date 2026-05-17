/**
 * Application menu + context menu wiring for L3.
 *
 * Application menu (BT-L3-6): standard macOS template — App / File / Edit /
 * View / Window / Help. "Toggle Dev Tools" lives under View with accelerator
 * `Cmd+Alt+I` on darwin.
 *
 * Context menu (BT-L3-9): a small Copy / Cut / Paste / Select All menu shown
 * on the renderer's `context-menu` event.
 *
 * Quit flush (BT-L3-8): the "Quit" menu item's click handler triggers
 * `app.quit()`, after which `before-quit` listeners run; main awaits any
 * in-flight journal writes before allowing the quit to complete.
 *
 * NOTE — RED commit: stub only; throws on `installApplicationMenu` and
 * `attachContextMenu`. GREEN commit will build the real menus via
 * `Menu.buildFromTemplate` and wire the IPC `app:get-menu-tree` accessor.
 */
import type { WebContents } from 'electron'
import type { Logger } from './log'

export interface MenuTreeNode {
  readonly label: string
  readonly id?: string
  readonly role?: string
  readonly accelerator?: string
  readonly type?: string
  readonly submenu?: readonly MenuTreeNode[]
}

export interface InstallApplicationMenuOptions {
  readonly logger: Logger
  /**
   * Called when the user activates the "Quit" item. The main process should
   * use this hook to flush pending state (BT-L3-8) before letting `app.quit()`
   * complete.
   */
  readonly onQuitRequested?: () => void
}

export function installApplicationMenu(_opts: InstallApplicationMenuOptions): void {
  throw new Error('menu.installApplicationMenu: not implemented (RED commit stub)')
}

export interface AttachContextMenuOptions {
  readonly contents: WebContents
  readonly logger: Logger
}

export function attachContextMenu(_opts: AttachContextMenuOptions): void {
  throw new Error('menu.attachContextMenu: not implemented (RED commit stub)')
}

/**
 * Serialize the live application menu into a JSON-safe tree. Used by the
 * `app:get-menu-tree` IPC channel so e2e tests can assert menu shape from
 * the renderer / test harness.
 */
export function getApplicationMenuTree(): readonly MenuTreeNode[] {
  throw new Error('menu.getApplicationMenuTree: not implemented (RED commit stub)')
}
