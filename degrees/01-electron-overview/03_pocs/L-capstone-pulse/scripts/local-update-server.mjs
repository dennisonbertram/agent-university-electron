// Carry-forward from L5: a local HTTP server that serves a latest-mac.yml
// manifest from scripts/fixtures/. Used by the updater spec.
//
// Entry 7 in expectation-gap-ledger applies: strip the query string before
// path matching, because electron-updater appends `?noCache=<token>`.
import http from 'node:http'
import path from 'node:path'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

const manifestFile = process.argv[2] ?? 'latest-mac.yml.current'
const port = Number(process.argv[3] ?? '8765')

const manifestPath = path.join(FIXTURES_DIR, manifestFile)

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 404
    res.end()
    return
  }
  const pathOnly = req.url.split('?')[0] ?? req.url
  if (pathOnly.endsWith('/latest-mac.yml')) {
    try {
      const body = readFileSync(manifestPath, 'utf8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/x-yaml')
      res.setHeader('Content-Length', Buffer.byteLength(body))
      res.end(body)
      return
    } catch (err) {
      res.statusCode = 500
      res.end((err && err.message) || 'unknown')
      return
    }
  }
  if (pathOnly.endsWith('.zip')) {
    const fakePath = pathOnly.split('/').pop() ?? 'fake.zip'
    const fakeArtifactPath = path.join(FIXTURES_DIR, fakePath)
    if (existsSync(fakeArtifactPath)) {
      const stat = statSync(fakeArtifactPath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Length', stat.size)
      res.end(readFileSync(fakeArtifactPath))
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/zip')
    res.end(Buffer.from('PK' + ' '.repeat(18)))
    return
  }
  res.statusCode = 404
  res.end()
})
server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[update-server] serving ${manifestPath} on http://127.0.0.1:${port}/updates/latest-mac.yml`)
})
