#!/usr/bin/env node
// scripts/local-update-server.mjs
//
// Tiny HTTP server that serves an electron-updater `latest-mac.yml` manifest
// + a fake ZIP artifact. Used by `tests/e2e/updater.spec.ts` (the Playwright
// tests start/stop the server inline via `helpers.startUpdateServer`) and as
// a manual debugging tool.
//
// Manual use:
//   node scripts/local-update-server.mjs --manifest=update --port=8765
//   node scripts/local-update-server.mjs --manifest=current --port=8765
//
// Routes:
//   GET /updates/latest-mac.yml  → returns the chosen manifest fixture.
//   GET /updates/<anything>.zip  → returns a 200 with an empty-zip header.
//   anything else                → 404.

import http from 'node:http'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => a.slice(2).split('=')),
)
const manifestChoice = args.manifest === 'current' ? 'current' : 'update'
const PORT = Number(args.port ?? 8765)
const MANIFEST_FILE = path.join(FIXTURES_DIR, `latest-mac.yml.${manifestChoice}`)

if (!existsSync(MANIFEST_FILE)) {
  console.error(`[local-update-server] manifest not found: ${MANIFEST_FILE}`)
  process.exit(1)
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 404
    res.end()
    return
  }
  // electron-updater adds a `?noCache=...` token to bust caches.
  const pathOnly = req.url.split('?')[0] ?? req.url
  if (pathOnly.endsWith('/latest-mac.yml')) {
    const body = readFileSync(MANIFEST_FILE, 'utf8')
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/x-yaml')
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
    return
  }
  if (pathOnly.endsWith('.zip')) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/zip')
    res.end(Buffer.from('PK' + ' '.repeat(18)))
    return
  }
  res.statusCode = 404
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[local-update-server] listening on http://127.0.0.1:${PORT}/updates (manifest=${manifestChoice})`,
  )
})
