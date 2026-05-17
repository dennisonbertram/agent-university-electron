/**
 * Electron Forge configuration — RED skeleton.
 *
 * The GREEN commit will replace this skeleton with the real configuration:
 *   - packagerConfig: appBundleId, asar, protocols (electron-l5), extendInfo
 *     (CFBundleURLTypes, CFBundleShortVersionString, NSHumanReadableCopyright),
 *     `osxSign` + `osxNotarize` guarded by `process.env.APPLE_ID`, hooks.
 *   - makers: MakerDMG, MakerZIP (both arches when --arch=universal).
 *   - plugins: FusesPlugin with the full hardening matrix
 *     (RunAsNode:false, EnableNodeOptionsEnvironmentVariable:false, etc.).
 *
 * In RED, the file is parseable (so `forge-config.test.ts` can import it)
 * but has empty arrays and no fuses, so the test's assertions all fail.
 */
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    // Intentionally empty in RED.
  },
  rebuildConfig: {},
  makers: [], // RED — GREEN adds MakerDMG, MakerZIP.
  plugins: [], // RED — GREEN adds FusesPlugin.
  hooks: {},
}

export default config
