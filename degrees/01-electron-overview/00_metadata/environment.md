# Environment — 01-electron-overview

Machine, runtime, and tool versions in use. Probed 2026-05-16.

## Captured

| Tool | Version | Notes |
|------|---------|-------|
| macOS | 15.7.7 (Sequoia) | BuildVersion 24G720 |
| Arch | arm64 (Apple Silicon) | M-series chip |
| node | 24.15.0 | LTS, used for native module builds |
| npm | 11.12.1 | |
| pnpm | 10.33.4 | Available as alternative |
| bun | 1.3.14 | Available; caveat: native module support incomplete |
| gh | 2.92.0 | GitHub CLI authenticated |
| Xcode CLT | path: /Library/Developer/CommandLineTools | SDK 15.5 |
| macOS SDK | 15.5 | Via `xcrun --show-sdk-version` |
| codesign | available (system tool) | `--version` not a valid flag; tool present |
| electron-forge (global) | not installed globally | Use via npx or project devDep |
| electron (npm registry) | 42.1.0 | Latest stable at probe time; pin this |
| electron-forge (npm registry) | 5.2.4 | Note: this is @electron-forge legacy; see @electron-forge/cli |
| @electron-forge/cli | 7.11.1 | Correct package for current Forge |
| electron-updater | 6.8.3 | |
| @electron/notarize | 3.1.1 | |
| better-sqlite3 | 12.10.0 | Latest; needs rebuild for each Electron |
| playwright | 1.60.0 | |
| vitest | 4.1.6 | |

## Notes

- **bun caveat**: bun 1.3.14 is available but many Electron native modules (better-sqlite3, @electron/rebuild) use node-gyp and expect standard npm/node toolchain. Use npm for POC builds. bun may be used for unit tests that don't involve native modules.
- **codesign**: Present on system. Simulated signing path documented in `17-code-signing-notarization.md`.
- **Apple Developer Account**: NOT available. All code signing documented as simulated flow.
- **electron 42.1.0**: This is the version to pin for all POCs. Bundled with Chromium 130.x and Node 22.x (verify in POC probe).
- **@electron-forge/cli 7.11.1**: Use `npm create electron-app` or `npx create-electron-app` for project scaffolding.

## Probe Commands Run

```
sw_vers
uname -m
node --version
npm --version
pnpm --version
bun --version
gh --version
xcode-select -p
xcrun --show-sdk-version
codesign --version (note: flag not valid; presence confirmed)
npm view electron version
npm view @electron-forge/cli version
npm view electron-updater version
npm view @electron/notarize version
npm view better-sqlite3 version
npm view playwright version
npm view vitest version
```

Probed: 2026-05-16

## Apple Developer Account

- Default assumption: **NOT available**. Signing + notarization are documented as a *simulated* flow.
- If credentials become available, update this file and `05_distillation/playbooks/code-signing-real.md`.
