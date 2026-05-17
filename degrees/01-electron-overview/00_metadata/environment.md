# Environment — 01-electron-overview

Machine, runtime, and tool versions in use. Probe at Phase 0 start and pin.

## To Probe (run during Phase 1 kickoff)

```
sw_vers                              # macOS version
uname -m                             # arch
node --version
npm --version
pnpm --version 2>/dev/null
bun --version 2>/dev/null
gh --version
xcode-select -p                      # for native builds
xcrun --show-sdk-version 2>/dev/null
codesign --version 2>/dev/null
```

Once probed, write the captured values into a table here and pin them as the environment of record for this degree.

## Captured (fill in during Phase 1)

| Tool | Version | Notes |
|------|---------|-------|
| macOS | TBD | TBD |
| Arch | TBD | TBD |
| node | TBD | TBD |
| npm | TBD | TBD |
| bun | TBD | TBD |
| gh | TBD | TBD |
| Xcode CLT | TBD | TBD |
| codesign | TBD | TBD |
| electron (target) | TBD | TBD |
| electron-forge | TBD | TBD |

## Apple Developer Account

- Default assumption: **NOT available**. Signing + notarization are documented as a *simulated* flow.
- If credentials become available, update this file and `05_distillation/playbooks/code-signing-real.md`.
