# Future Work — 01-electron-overview

Prioritized items for follow-up degrees or extensions. Each item is self-contained.

---

## FW-01 — Add sibling degree: 02-electron-renderer-deep-dive

- **Priority**: high
- **Effort**: large
- **Rationale**: The current degree treats the renderer as a static HTML page. Real
  production Electron apps use React, Vue, or Svelte in the renderer with a bundler
  (Vite or esbuild). The IPC boundary becomes significantly more complex when the
  renderer has its own state management and component lifecycle. This gap was the
  main reason Dimension 1 (completeness of coverage) scored 4/5 rather than 5/5.
- **Dependencies**: This degree (`01-electron-overview`) must be complete; the new
  degree inherits all security and IPC patterns from L1-L2.
- **Successors-can-pick-up-from**: `06_skill_pack/lessons/03-ipc-patterns-and-validation.md`
  (the IPC registry pattern is the starting point); the L2 `ipc.ts` source tree is
  the preload baseline.

---

## FW-02 — Add sibling degree: 02-electron-windows-linux

- **Priority**: medium
- **Effort**: large
- **Rationale**: The deep-integration POC (L4) and capstone are macOS-specific.
  Windows taskbar progress, Jump Lists, MSIX packaging, Windows-specific notification
  APIs, and Linux Snap/AppImage/deb packaging are all researched but not exercised.
  A Windows + Linux sibling degree would close the cross-platform gap and let the
  skill pack claim multi-platform readiness.
- **Dependencies**: Windows test machine (physical or CI), Linux container for deb/AppImage build.
- **Successors-can-pick-up-from**: `01_research/01-capabilities-overview.md`
  (cross-platform notes); `06_skill_pack/lessons/08-packaging-with-electron-forge.md`
  (Windows/Linux makers are listed but not exercised).

---

## FW-03 — Real Apple Developer signing and notarization

- **Priority**: high
- **Effort**: small (given creds)
- **Rationale**: The signing and notarization walkthrough (PB-08, Lesson 09) is the
  only section of the skill pack that is documented-but-not-verified. A single signing
  run would promote PB-08 from "simulated" to "verified," raise the Packaging Coverage
  score from 4 to 5, and confirm whether the entitlements file, the `osxSign`
  conditional spread, and `xcrun notarytool submit` work end-to-end.
- **Dependencies**: Apple Developer Program membership ($99/yr); `APPLE_ID`,
  `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD` in the build environment.
- **Successors-can-pick-up-from**: `03_pocs/L5-packaging-signing-update/simulated-signing.md`
  (exact commands to run); `03_pocs/L5-packaging-signing-update/forge.config.ts`
  (the `HAS_APPLE_CREDS` conditional spread is already wired).

---

## FW-04 — Production auto-update server walk-through

- **Priority**: medium
- **Effort**: medium
- **Rationale**: BT-L5-6/7 prove the electron-updater wiring is correct against a
  local Node fixture. A production update path (S3 + CloudFront bucket or GitHub
  Releases with `provider: 'github'`) was not exercised. Agents building real
  products need verified patterns for the entire update cycle including binary
  download, integrity check, and install/relaunch.
- **Dependencies**: AWS account (for S3/CloudFront) or a GitHub repository with
  Releases enabled; Apple signing creds (FW-03) to produce a signed binary that
  can be downloaded and Gatekeeper-assessed.
- **Successors-can-pick-up-from**: `03_pocs/L5-packaging-signing-update/scripts/local-update-server.mjs`
  (the fixture server is a direct model for a real server); `06_skill_pack/lessons/10-auto-update.md`.

---

## FW-05 — Exercise universal binary build end-to-end

- **Priority**: medium
- **Effort**: small (30-minute build + verification)
- **Rationale**: BT-L5-4 was marked `@long-running` and skipped in all runs. The
  `forge.config.ts` has `arch: 'universal'` and the `AutoUnpackNativesPlugin` is
  wired, but whether `better-sqlite3`'s V8 14.x patch produces valid arm64 and x64
  objects that merge into a fat binary was never confirmed. This is a pure execution
  gap: the config is correct per static analysis; the actual build has never run.
- **Dependencies**: 30 minutes of machine time; no additional accounts needed. Requires
  running `npm run make -- --arch=universal` in the capstone directory on an arm64 macOS
  machine with Rosetta installed.
- **Successors-can-pick-up-from**: `03_pocs/L-capstone-pulse/forge.config.ts`
  (BT-L5-4 annotation); `05_distillation/open-questions.md` OQ-04, OQ-13;
  `03_pocs/L-capstone-pulse/scripts/patches/better-sqlite3-v8-tag.mjs`.

---

## FW-06 — Investigate electron-vite template integration

- **Priority**: low
- **Effort**: medium
- **Rationale**: The degree chose `tsc + esbuild + forge` (DR-11) over the
  `electron-vite` template because the rewrite cost exceeded the behavior payoff for
  the L5 packaging POC. However, `electron-vite` offers HMR for the main process and
  a tighter renderer-bundler integration that would benefit the FW-01 renderer-deep-
  dive degree. The current hybrid chain would need to be ported or replaced. Whether
  the `electron-vite` scaffold handles the sandbox preload bundling correctly (EG-1)
  in its default configuration is unverified.
- **Dependencies**: FW-01 (renderer framework degree) would benefit most from this
  investigation; can also be done standalone.
- **Successors-can-pick-up-from**: `04_logs/decision-log.md` DR-11 (decision rationale
  for the current hybrid chain); `05_distillation/open-questions.md` OQ-09.

---

## FW-07 — Electron security deep-dive degree

- **Priority**: medium
- **Effort**: large
- **Rationale**: The current degree establishes a secure-by-default baseline (fuses,
  CSP, contextIsolation, IPC validators, navigation guards). A dedicated security
  degree would cover: Electron CVE history and exploit patterns, automated static
  scanning (`electronegativity`), webview tag avoidance and migration, advanced CSP
  with nonce-based script loading, prototype pollution via contextBridge, and sandbox
  escape research. This is higher-value for agents shipping apps to untrusted users
  than for internal tooling.
- **Dependencies**: This degree (`01-electron-overview`) for the secure-baseline
  foundation.
- **Successors-can-pick-up-from**: `06_skill_pack/checklists/security-checklist.md`;
  `05_distillation/anti-patterns/AP-01-nodeintegration-true-in-renderer.md` through
  `AP-08`; `01_research/05-security-model.md`.

---

## FW-08 — Promote better-sqlite3 V8 14.x patch to upstream or a forge plugin

- **Priority**: low
- **Effort**: medium
- **Rationale**: Entry 12 (`04_logs/expectation-gap-ledger.md`) documents a
  `postinstall` patch script that adds `#if V8_MAJOR_VERSION >= 14` preprocessor
  guards to three sites in `better-sqlite3@12.10.0`. This is a brittle per-project
  workaround. The right long-term fix is either an upstream PR to `better-sqlite3`
  or a reusable forge plugin that auto-applies the patch. Agents who follow the
  skill pack's SQLite recipe will independently rediscover this issue every time they
  upgrade Electron.
- **Dependencies**: A `better-sqlite3` upstream PR would require the maintainers to
  accept the V8 14.x compatibility fix; alternatively a forge plugin can be published
  to npm independently.
- **Successors-can-pick-up-from**: `03_pocs/L-capstone-pulse/scripts/patches/better-sqlite3-v8-tag.mjs`
  (the exact patch source); `04_logs/expectation-gap-ledger.md` Entry 12
  (full root-cause analysis).

---

## FW-09 — Investigate WebContentsView migration patterns

- **Priority**: low
- **Effort**: medium
- **Rationale**: `BrowserView` was deprecated in Electron 30 and removed in Electron
  33. `WebContentsView` is the replacement. PB-10 in the distillation covers the
  migration at a surface level. The degree never exercised a multi-view layout (the
  capstone uses a single BrowserWindow). Agents migrating existing apps with split-
  pane or overlay-view patterns need verified migration patterns, not just API
  documentation.
- **Dependencies**: An app with an existing `BrowserView`-based layout to migrate.
- **Successors-can-pick-up-from**: `05_distillation/playbooks/PB-10-migrating-from-browserview-to-webcontentsview.md`;
  `01_research/22-version-compatibility.md` (breaking changes section).

---

## FW-10 — Performance and memory profiling lab

- **Priority**: low
- **Effort**: medium
- **Rationale**: The degree covers correctness (tests pass) and observability (logs
  emitted) but not performance. Electron apps are notorious for high memory footprints.
  A future lab could cover: renderer-side memory leak detection with Chromium DevTools
  heap snapshots, main-process CPU profiling, startup time measurement, `process.memoryUsage()`
  baselines, and asar read-performance for large apps.
- **Dependencies**: No new accounts needed; requires a representative app (the capstone
  Pulse app is a suitable test subject).
- **Successors-can-pick-up-from**: `06_skill_pack/lessons/11-crash-reporting-and-observability.md`
  (the observability baseline); the Pulse capstone as the profiling subject.
