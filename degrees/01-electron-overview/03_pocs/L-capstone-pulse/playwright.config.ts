import { defineConfig } from '@playwright/test'

/**
 * Playwright config for the Pulse capstone.
 *
 * Packaging (`npm run package`) takes 30-90s; `npm run make` adds DMG (60-180s).
 * better-sqlite3 rebuild adds another 30-60s on first run. We raise the default
 * test timeout to 5 minutes and rely on a session-scoped fixture in
 * `helpers.ts` to memoize `npm run package` so multiple specs share the same
 * `out/<platform>-<arch>/` bundle.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
