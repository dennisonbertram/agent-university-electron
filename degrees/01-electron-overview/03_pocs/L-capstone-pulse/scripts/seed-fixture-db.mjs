// Seed-fixture-DB script — creates an empty Pulse journal SQLite DB at the
// given path. Used by Playwright tests that need a clean DB seed.
//
// Usage: `node scripts/seed-fixture-db.mjs /path/to/journal.db`
//
// We deliberately avoid loading better-sqlite3 here so this script runs in
// system Node without rebuilding for Electron's ABI. Instead, the journal
// store inside the Electron process creates the schema lazily on first open.
// This script's job is just to make sure the parent directory exists and the
// file is absent so the store's init path is exercised.
import path from 'node:path'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'

const target = process.argv[2]
if (!target) {
  // eslint-disable-next-line no-console
  console.error('[seed-fixture-db] usage: seed-fixture-db.mjs <db-path>')
  process.exit(1)
}
const abs = path.resolve(target)
mkdirSync(path.dirname(abs), { recursive: true })
if (existsSync(abs)) unlinkSync(abs)
// eslint-disable-next-line no-console
console.log(`[seed-fixture-db] ready: ${abs}`)
