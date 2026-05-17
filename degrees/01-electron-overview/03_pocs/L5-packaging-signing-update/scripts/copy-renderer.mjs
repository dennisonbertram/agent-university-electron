// Copies static renderer assets (HTML) into dist/.
// L3 keeps the bundler-free renderer (one HTML + tsc-compiled JS).
// The PRELOAD is bundled separately by scripts/build-preload.mjs (esbuild).
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcRenderer = path.join(root, 'src', 'renderer')
const dstRenderer = path.join(root, 'dist', 'renderer')

async function copyFile(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true })
  await fs.copyFile(from, to)
}

async function main() {
  await fs.mkdir(dstRenderer, { recursive: true })
  const entries = await fs.readdir(srcRenderer)
  for (const entry of entries) {
    if (entry.endsWith('.html')) {
      await copyFile(path.join(srcRenderer, entry), path.join(dstRenderer, entry))
    }
  }
}

main().catch((err) => {
  console.error('[copy-renderer] failed:', err)
  process.exit(1)
})
