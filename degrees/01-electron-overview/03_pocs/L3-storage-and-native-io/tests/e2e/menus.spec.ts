/**
 * BT-L3-6: application menu contains "Toggle Dev Tools" under View with
 *          accelerator `Cmd+Alt+I` on darwin.
 * BT-L3-9: context menu listener is registered on the renderer's webContents
 *          (`contents.on('context-menu', ...)`) — proved by invoking it
 *          programmatically via app.evaluate and inspecting the menu items
 *          it builds.
 */
import { test, expect } from '@playwright/test'
import { launchApp, type LaunchedApp } from './helpers'

let launched: LaunchedApp | null = null

test.afterEach(async () => {
  if (launched) {
    try {
      await launched.app.close()
    } catch {
      // best-effort
    }
    launched = null
  }
})

interface MenuNode {
  label: string
  id?: string
  role?: string
  accelerator?: string
  type?: string
  submenu?: MenuNode[]
}

function findItem(
  tree: readonly MenuNode[],
  predicate: (node: MenuNode) => boolean,
): MenuNode | null {
  for (const node of tree) {
    if (predicate(node)) return node
    if (node.submenu) {
      const found = findItem(node.submenu, predicate)
      if (found) return found
    }
  }
  return null
}

test('BT-L3-6: application menu has a "Toggle Dev Tools" item with Cmd+Alt+I accelerator on darwin', async () => {
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const tree = (await win.evaluate(async () => {
    return await (window as unknown as {
      api: { getApplicationMenu: () => Promise<unknown> }
    }).api.getApplicationMenu()
  })) as readonly MenuNode[]

  expect(Array.isArray(tree)).toBe(true)
  expect(tree.length).toBeGreaterThan(0)

  const item = findItem(
    tree,
    (n) =>
      /toggle.*dev.*tools/i.test(n.label) ||
      n.role === 'toggleDevTools' ||
      n.id === 'toggle-devtools',
  )
  expect(item, `expected a Toggle Dev Tools menu item in ${JSON.stringify(tree)}`).not.toBeNull()
  if (process.platform === 'darwin') {
    expect(item?.accelerator).toBe('Cmd+Alt+I')
  }
})

test('BT-L3-9: context-menu listener is registered on the renderer\'s webContents and builds Copy/SelectAll', async () => {
  launched = await launchApp()
  const { app } = launched
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Probe: emit the 'context-menu' event programmatically on the renderer's
  // webContents and inspect what menu was popped up. Our test seam: when
  // CONTEXT_MENU_PROBE === '1' the listener stores the last built menu in a
  // global so we can read it back. We toggle the seam at runtime via env-var
  // override — but here we use a simpler probe: the menu module's
  // installation routes through Menu.popup, which we monkey-patch from the
  // test side before triggering the event.
  const probe = (await app.evaluate(async ({ BrowserWindow, Menu }) => {
    const captured: Array<{ label?: string; role?: string }> = []
    const originalPopup = Menu.prototype.popup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Menu.prototype as any).popup = function (this: Electron.Menu, ..._args: unknown[]): void {
      for (const item of this.items) {
        captured.push({ label: item.label, role: item.role })
      }
    }
    try {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return { captured, error: 'no-window', listenerCount: 0 }
      const listenerCount = win.webContents.listenerCount('context-menu')
      win.webContents.emit('context-menu', {}, { x: 10, y: 10 })
      return { captured, listenerCount }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Menu.prototype as any).popup = originalPopup
    }
  })) as { captured: Array<{ label?: string; role?: string }>; listenerCount: number }

  expect(probe.listenerCount, 'a context-menu listener must be registered on the renderer webContents').toBeGreaterThanOrEqual(1)

  const labelsOrRoles = probe.captured
    .map((i) => `${i.label ?? ''}|${i.role ?? ''}`.toLowerCase())
    .join(',')
  expect(labelsOrRoles).toMatch(/copy/)
  expect(labelsOrRoles).toMatch(/select.?all/)
})
