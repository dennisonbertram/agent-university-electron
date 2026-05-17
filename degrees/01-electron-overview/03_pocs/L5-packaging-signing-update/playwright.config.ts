import { defineConfig } from '@playwright/test'

/**
 * Playwright config for L5.
 *
 * Packaging (`npm run package`) takes 30-90s; `npm run make` adds DMG (60-180s).
 * Universal builds can push past 5 minutes. We therefore raise the default test
 * timeout to 5 minutes and rely on a session-scoped fixture in `helpers.ts` to
 * memoize the result of `npm run package` so multiple specs in one run share
 * the same `out/<platform>-<arch>/` bundle.
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
