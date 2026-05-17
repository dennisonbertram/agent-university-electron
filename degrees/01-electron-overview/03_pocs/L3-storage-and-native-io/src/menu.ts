/**
 * Application menu + context menu wiring for L3.
 *
 * Application menu (BT-L3-6, BT-L3-8): macOS-flavored template with App /
 * File / Edit / View / Window / Help. "Toggle Dev Tools" lives under View
 * with accelerator `Cmd+Alt+I` on darwin. The "Quit" item routes through
 * `onQuitRequested` so main can flush pending journal writes before the
 * process exits.
 *
 * Context menu (BT-L3-9): a small Copy / Cut / Paste / Select All menu shown
 * on the renderer's `context-menu` event.
 *
 * Tree serialization (BT-L3-6 / IPC `app:get-menu-tree`): we deep-walk the
 * live application menu and emit a JSON-safe array of `MenuTreeNode`s so the
 * renderer / e2e harness can assert structure (label, role, accelerator).
 */
import { Menu, MenuItem, type WebContents } from 'electron'
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

function buildTemplate(opts: InstallApplicationMenuOptions): Electron.MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin'
  const quitClick = (): void => {
    opts.logger.info('menu:quit-clicked', {})
    if (opts.onQuitRequested) {
      opts.onQuitRequested()
    }
  }

  const appMenu: Electron.MenuItemConstructorOptions = {
    label: 'L3',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { id: 'quit', label: 'Quit', accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q', click: quitClick },
    ],
  }

  const fileMenu: Electron.MenuItemConstructorOptions = {
    label: 'File',
    submenu: [{ role: 'close' }],
  }

  const editMenu: Electron.MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  }

  const viewMenu: Electron.MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      {
        id: 'toggle-devtools',
        label: 'Toggle Dev Tools',
        accelerator: isMac ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
        role: 'toggleDevTools',
      },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  }

  const windowMenu: Electron.MenuItemConstructorOptions = {
    role: 'window',
    submenu: [{ role: 'minimize' }, { role: 'zoom' }],
  }

  const helpMenu: Electron.MenuItemConstructorOptions = {
    role: 'help',
    submenu: [],
  }

  const template: Electron.MenuItemConstructorOptions[] = isMac
    ? [appMenu, fileMenu, editMenu, viewMenu, windowMenu, helpMenu]
    : [fileMenu, editMenu, viewMenu, windowMenu, helpMenu]

  return template
}

export function installApplicationMenu(opts: InstallApplicationMenuOptions): void {
  const template = buildTemplate(opts)
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  opts.logger.info('menu:installed', { rootCount: menu.items.length })
}

export interface AttachContextMenuOptions {
  readonly contents: WebContents
  readonly logger: Logger
}

export function attachContextMenu(opts: AttachContextMenuOptions): void {
  const { contents, logger } = opts
  contents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      new MenuItem({ role: 'copy' }),
      new MenuItem({ role: 'cut' }),
      new MenuItem({ role: 'paste' }),
      new MenuItem({ type: 'separator' }),
      new MenuItem({ role: 'selectAll' }),
    ])
    logger.info('menu:context:built', {
      itemCount: menu.items.length,
      x: typeof params?.x === 'number' ? params.x : null,
      y: typeof params?.y === 'number' ? params.y : null,
    })
    try {
      menu.popup()
    } catch (err) {
      // popup() can fail in headless contexts (no parent window);
      // log + swallow so the listener still satisfies the regression check.
      logger.warn('menu:context:popup-failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })
  logger.info('menu:context:attached', {})
}

function serializeItem(item: Electron.MenuItem): MenuTreeNode {
  const node: {
    label: string
    id?: string
    role?: string
    accelerator?: string
    type?: string
    submenu?: MenuTreeNode[]
  } = {
    label: item.label,
  }
  if (item.id) node.id = item.id
  if (item.role) node.role = item.role
  // Electron's MenuItem exposes `accelerator` as `string | undefined`; some
  // role-based items have an implicit accelerator that lives on
  // `commandsMap` and is not surfaced via the public `accelerator` field, so
  // we accept the public field only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAcc = (item as any).accelerator
  if (typeof rawAcc === 'string') node.accelerator = rawAcc
  if (item.type) node.type = item.type
  const sub = item.submenu
  if (sub) {
    node.submenu = sub.items.map(serializeItem)
  }
  return node as MenuTreeNode
}

export function getApplicationMenuTree(): readonly MenuTreeNode[] {
  const root = Menu.getApplicationMenu()
  if (!root) return []
  return root.items.map(serializeItem)
}
