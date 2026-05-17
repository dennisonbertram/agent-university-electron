// Bundles src/preload.ts into dist/preload.js as a single CommonJS file via esbuild.
// Carried forward from L2 (Decision 5): under `sandbox: true` the preload cannot
// `require()` arbitrary relative TS files at runtime, so esbuild bundles channel
// constants + the `webUtils.getPathForFile` helper into one self-contained file.
// `external: ['electron']` preserves the runtime require('electron') so the
// sandbox preload whitelist (contextBridge, ipcRenderer, webUtils, ...) resolves
// normally.
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

await build({
  entryPoints: [path.join(root, 'src', 'preload.ts')],
  outfile: path.join(root, 'dist', 'preload.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node22'],
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
})
