/**
 * Creates the L1 BrowserWindow with the secure defaults mandated by
 * shared/conventions.md "Security" and 01_research/05-security-model.md.
 *
 * - contextIsolation: true (default since Electron 12; kept explicit)
 * - sandbox:          true (default since Electron 20; kept explicit)
 * - nodeIntegration:  false (default since Electron 5; kept explicit)
 * - preload:          dist/preload.js
 *
 * Loads dist/renderer/index.html via loadFile (file:// origin).
 */
import { BrowserWindow } from 'electron'
import path from 'node:path'

export interface CreateMainWindowOptions {
  /** Width in pixels. Default 900. */
  width?: number
  /** Height in pixels. Default 600. */
  height?: number
}

export function createMainWindow(opts: CreateMainWindowOptions = {}): BrowserWindow {
  const width = opts.width ?? 900
  const height = opts.height ?? 600

  // __dirname at runtime is .../dist when compiled.
  const preloadPath = path.join(__dirname, 'preload.js')
  const indexHtml = path.join(__dirname, 'renderer', 'index.html')

  const win = new BrowserWindow({
    width,
    height,
    show: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  })

  void win.loadFile(indexHtml)
  return win
}
