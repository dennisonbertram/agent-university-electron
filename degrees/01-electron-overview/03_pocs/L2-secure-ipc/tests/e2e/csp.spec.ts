/**
 * BT-L2-6 — CSP forbids inline scripts.
 *
 * Strategy: inject a <script> tag whose source attempts to set a known global
 * `window.__cspInlineRan = true`. Under the strict CSP (`script-src 'self'`,
 * no `'unsafe-inline'`), Chromium must refuse to execute the inline script.
 * We then poll the global and assert it remains undefined.
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

test('BT-L2-6: CSP blocks DOM-injected inline scripts (window.__cspInlineRan stays undefined)', async () => {
  launched = await launchApp()
  const { app } = launched
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Attempt to inject an inline script via DOM. createElement('script') with
  // textContent is the classic inline-script vector that strict CSP must block.
  await window.evaluate(() => {
    const s = document.createElement('script')
    s.textContent = '(window).__cspInlineRan = true'
    document.head.appendChild(s)
  })

  // Wait a moment, then poll: the global must NOT be set.
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    const ran = await window.evaluate(
      () => (window as unknown as { __cspInlineRan?: unknown }).__cspInlineRan,
    )
    if (ran === true) {
      throw new Error('CSP failed: inline script executed and set window.__cspInlineRan')
    }
    await new Promise((r) => setTimeout(r, 50))
  }

  const final = await window.evaluate(
    () => typeof (window as unknown as { __cspInlineRan?: unknown }).__cspInlineRan,
  )
  expect(final).toBe('undefined')
})
