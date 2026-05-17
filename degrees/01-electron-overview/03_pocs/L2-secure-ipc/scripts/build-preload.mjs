// Bundles src/preload.ts into dist/preload.js as a single CommonJS file via esbuild.
//
// Why bundling: under `sandbox: true`, preload cannot `require()` arbitrary
// relative TS files at runtime (Electron's sandbox preload only resolves a
// whitelisted set of modules — see 01_research/05-security-model.md §
// "sandbox: true Implications for Preload"). L1 worked around this by
// inlining IPC channel string literals. At L2 the IPC surface grew enough
// (ping/echo/journalAppend/onTick/etc) that the inline workaround became
// fragile. esbuild bundles the preload into a single self-contained file,
// letting it `import { IPC_CHANNELS } from './ipc'` etc. cleanly.
// Decision logged in 04_logs/decision-log.md Entry 5.
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
  // Electron's whitelisted preload module list under sandbox: do NOT bundle
  // these — Electron resolves them at runtime.
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
})
