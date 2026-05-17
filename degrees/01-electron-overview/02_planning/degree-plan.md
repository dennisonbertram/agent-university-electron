# Degree Plan — 01-electron-overview

Target: Electron 42.1.0 on macOS 15 (Sequoia), arm64 primary, universal binary packaging target.

---

## Objective

An agent completing this curriculum can build a production-shaped, polished macOS Electron application from scratch — including the three-process architecture (main/preload/renderer), secure contextBridge IPC, native SQLite persistence, all major macOS system surfaces (tray, notifications, global shortcuts, deep links, power events, dock, auto-launch, nativeTheme), packaging via Electron Forge into a universal `.dmg`, auto-update wiring against a local fixture, crash reporting, and structured logging — while avoiding the documented failure modes, security pitfalls, and expectation gaps that LLMs commonly encounter.

---

## Audience

**Primary audience**: Autonomous LLM coding agents consuming this degree programmatically.

**Optimized for**: Dense, declarative prose; explicit invariants; evidence pointers; "do this / not this" rules; Given/When/Then test framing.

**Non-audience**: Human developers seeking a step-by-step tutorial. Humans may read this material but it is not formatted for narrative learning.

---

## Prerequisites

An agent beginning this degree must already possess:

- JavaScript/TypeScript fluency (ES2022+, strict mode, module resolution, async/await, generics)
- Node.js fundamentals (event loop, `fs`, `path`, `process`, npm workspaces, native C addons at a conceptual level)
- Browser DOM basics (event model, fetch, structured clone algorithm, Web APIs)
- npm package management (install, scripts, lock files, `postinstall` hooks)
- Command-line fluency on macOS (shell scripts, environment variables, `xcode-select`, `codesign`)
- Git basics (clone, branch, commit — degree artifacts are git-tracked but agent need not understand advanced git)

---

## Deliverables

1. **L1 POC** — Minimal Electron boot: main+preload+renderer, BrowserWindow, devtools, hot reload (`03_pocs/L1-hello-electron/`)
2. **L2 POC** — Secure IPC baseline: contextBridge, contextIsolation, sandbox, CSP, navigation guards, typed invoke/handle (`03_pocs/L2-secure-ipc/`)
3. **L3 POC** — Storage and native I/O: `userData` persistence, atomic writes, file dialog, drag-drop, file watcher, application menu (`03_pocs/L3-storage-native-io/`)
4. **L4 POC** — Deep macOS integration: tray, notifications, global shortcuts, powerMonitor, app lifecycle, deep links, dock, auto-launch, nativeTheme, recent docs (`03_pocs/L4-macos-integration/`)
5. **L5 POC** — Packaging, code signing, auto-update: Forge DMG+ZIP+universal, hardened runtime, notarization (simulated), electron-updater against local fixture, crashReporter (`03_pocs/L5-packaging-update/`)
6. **Capstone POC** — "Pulse": menu-bar focus + journal companion combining all prior levels (`03_pocs/L-capstone-pulse/`)
7. **10+ distillation files** in `05_distillation/` (gotchas, patterns, anti-patterns, before-you-build, debugging playbooks, security checklist, production-readiness checklist, etc.)
8. **Skill pack** in `06_skill_pack/` — navigable by an agent without reading raw research
9. **Evaluation** in `07_evaluation/` — final report, readiness scoring (1–5 on 11 dimensions), known limitations, future work
10. **Ledgers** in `04_logs/` — expectation-gap, error, decision, test-results, debugging, deployment, command — all populated with real entries

---

## Phase Timeline

| Phase | Name | Status | Gating Criterion |
|-------|------|--------|-----------------|
| 0 | Initialize degree | Done | `00_metadata/` has degree-metadata, assumptions, environment, source-inventory |
| 1 | Deep research | Done | 23 research files in `01_research/`; every claim cites source |
| 2 | Degree plan + risk register + success criteria | In-progress | `02_planning/degree-plan.md`, `risk-register.md`, `success-criteria.md` exist and are non-trivial |
| 3 | POC selection | In-progress | `02_planning/poc-selection.md` with scoring table and refinements vs initial plan |
| 4 | Test strategy | In-progress | `02_planning/test-strategy.md` with Given/When/Then per layer |
| 5 | Observability strategy | In-progress | `02_planning/observability-strategy.md` with structured log schema and per-POC requirements |
| 6 | Build POCs (TDD) | Pending | All 6 POCs built test-first; behavioral tests pass; POC reports written |
| 7 | Behavioral testing | Pending | All Given/When/Then assertions verified; test results logged |
| 8 | Packaging/signing/update simulation | Pending | `.dmg` artifact produced; local update server test passes |
| 9 | Distillation | Pending | 10+ files in `05_distillation/`; every claim cites POC or log |
| 10 | Skill pack | Pending | `06_skill_pack/` navigable without raw research; has index, quickstart, agent-instructions |
| 11 | Evaluation | Pending | All quality gates pass; readiness scored 1–5 on 11 dimensions |

---

## POC Progression at a Glance

| Level | Name | Primary Surface |
|-------|------|----------------|
| L1 | Hello Electron | Boot, BrowserWindow, devtools, hot reload |
| L2 | Secure IPC | contextBridge, contextIsolation, sandbox, CSP, nav guards |
| L3 | Storage & Native I/O | `userData`, atomic writes, file dialog, drag-drop, menu |
| L4 | macOS System Integration | Tray, notifications, shortcuts, power, deep links, dock, auto-launch |
| L5 | Packaging & Auto-Update | Forge makers, universal binary, notarize (sim), electron-updater |
| Capstone | Pulse | All prior levels combined in a polished menu-bar app |

---

## Cross-POC Inheritance Map

```
L1 (boot skeleton)
  └─ L2 (inherits: project layout, main.ts, preload.ts)
       └─ L3 (inherits: L2 secure IPC scaffold; adds: storage, menus)
            └─ L4 (inherits: L2 IPC + L3 storage; adds: tray, notifs, shortcuts, power, deep links)
                 └─ L5 (inherits: L4 app shell; wraps in packaging/signing/updater)
                      └─ Capstone "Pulse" (inherits ALL; adds: SQLite, safeStorage, Touch ID, Playwright e2e)

Files/patterns that carry forward:
  src/main.ts          L1 → L2 → L3 → L4 → L5 → Capstone (extended each level)
  src/preload.ts       L1 → L2 → L3 → L4 → L5 → Capstone
  src/ipc.ts           L2 → L3 → L4 → L5 → Capstone
  forge.config.ts      L1 (minimal) → L5 (full) → Capstone (with makers + plugins)
  vitest.config.ts     L1 → all (extended per level)
  tsconfig.json        L1 → all (strict mode, paths aliases)
  Security hardening   L2 → all subsequent (never regress)
  Logger (electron-log) L1 (stub) → full structured logging from L2 onward
```

---

## Tooling Decisions

### Toolchain: electron-forge (primary)

**Rationale**: Electron Forge is the official, actively maintained toolchain. It integrates `@electron/rebuild` automatically, supports the Vite plugin for dev-mode hot reload, produces DMG/ZIP/NSIS makers, and is the recommended approach in the official Electron docs. [`../01_research/16-packaging-electron-forge.md`]

**Fallback**: electron-builder — documented in `../01_research/16-packaging-electron-forge.md` as a viable alternative with more configuration flexibility but less integration with the official Electron tooling. Only use if Forge shows a blocking bug for the universal binary workflow in L5.

### Language: TypeScript strict

**Rationale**: `strict: true` in `tsconfig.json` catches IPC channel typos (a named failure mode — FM-07) and `contextBridge` serialization errors at compile time. Every POC uses TypeScript; no plain JavaScript. [`../01_research/22-version-compatibility.md`]

### Test runner: vitest (unit + integration) + Playwright `_electron` (e2e)

**Rationale**: `vitest` runs in Node without launching Electron, making unit and integration tests fast. Business logic is separated from IPC wiring via dependency injection (see `../01_research/20-testing-strategies.md`), enabling thorough coverage without a running app. `Playwright _electron` is the only viable full-app e2e option; `bun:test` is explicitly rejected because bun's native module support (node-gyp / `@electron/rebuild`) is documented as incomplete for Electron projects as of May 2026 [`../01_research/22-version-compatibility.md`]. `electron-mocha` is held as a fallback for IPC-handler tests that cannot be adequately mocked.

### SQLite: better-sqlite3 with @electron/rebuild

**Rationale**: `better-sqlite3` is synchronous (simpler error handling in main process, no promise chains around DB calls), ships prebuilt binaries for common Electron ABIs, and is the most widely used SQLite binding in Electron apps. `@electron/rebuild` handles ABI mismatch automatically via Forge's postinstall hook. [`../01_research/14-native-modules.md`]

### Logging: electron-log

**Rationale**: `electron-log` is the community standard for structured logging in Electron. It supports file rotation, console transport, renderer→main log forwarding, and is compatible with sourcemaps. No blocking issues found in research. [`../01_research/19-crash-reporting-and-observability.md`]

### Package manager: npm (not bun, not pnpm)

**Rationale**: Bun's support for node-gyp and native module builds is incomplete as of research date. pnpm hoisting issues with native modules are documented community complaints. npm 11.x is verified working with Electron 42. [`../01_research/22-version-compatibility.md`]

---

## Definition of Done

The degree is complete when ALL of the following hold:

- [ ] Phase 0 complete: `00_metadata/` contains degree-metadata, assumptions, environment, source-inventory
- [ ] Phase 1 complete: ≥15 research files in `01_research/`; sources cited per claim (DONE: 23 files)
- [ ] Phase 2–5 complete: all 6 planning files in `02_planning/` are non-trivial
- [ ] All 6 POCs built test-first with Given/When/Then behavioral tests
- [ ] Each POC has README, test-plan, behavioral test file, implementation, observability instrumentation, POC report
- [ ] Capstone "Pulse" is a packaged, runnable menu-bar app demonstrating every subsystem
- [ ] ≥10 distillation files in `05_distillation/`; every claim cites a POC or log entry
- [ ] `06_skill_pack/` is navigable without reading raw research; has index, quickstart, curriculum, agent-instructions, lessons/, labs/, recipes/, checklists/, troubleshooting/, reference/, examples/, assessments/
- [ ] `07_evaluation/` has final-report, skill-pack-readiness (scored), known-limitations, future-work
- [ ] Every ledger in `04_logs/` has real entries; expectation-gap ledger is non-empty
- [ ] Research quality gate passes (per doctrine)
- [ ] POC quality gate passes (per doctrine)
- [ ] Distillation quality gate passes (per doctrine)
- [ ] Skill pack quality gate passes (per doctrine)
- [ ] Evidence quality gate passes — final report distinguishes verified facts from assumptions

---

## What Gets Cut If Time-Pressed

Priority triage list (cut in order shown; stop cutting when time allows):

1. **L5 update-server test roundtrip** — keep the updater wiring and config; drop the test that actually downloads from the local fixture server (document as "wired but download round-trip not exercised").
2. **Capstone Touch ID gate** — keep the `promptTouchID` call path and the fallback; mark Touch ID as "future work" if unavailable on review machine (OQ-09); document the entitlement requirements.
3. **Cross-platform notes** — Linux Snap / Windows NSIS documentation is documented only as passing mention; cut all elaboration.
4. **Capstone Playwright e2e for packaged binary** — keep Playwright e2e for unpackaged app; mark packaged-binary e2e as "smoke test documented, not automated."
5. **L4 `app.addRecentDocument`** — lowest-value surface; drop it; document in gotchas if it has interesting behavior.
6. **L3 file watcher test** — if `chokidar`/`fs.watch` timing makes the test flaky, replace with a synchronous assertion on the watcher registration, not the callback timing.

---

## References

| Claim | Source |
|-------|--------|
| Electron Forge recommended toolchain | `../01_research/16-packaging-electron-forge.md` |
| vitest + Playwright _electron recommendation | `../01_research/20-testing-strategies.md` |
| bun native module incompleteness | `../01_research/22-version-compatibility.md` |
| better-sqlite3 + @electron/rebuild | `../01_research/14-native-modules.md` |
| electron-log as logging standard | `../01_research/19-crash-reporting-and-observability.md` |
| FM-07 IPC channel typo risk | `../01_research/21-failure-modes.md` |
| Electron 42.1.0 version pin | `../01_research/22-version-compatibility.md` |
| Open questions driving POC design | `../01_research/23-open-questions.md` |
| macOS tray GC pitfall (FM-04) | `../01_research/21-failure-modes.md` |
| Security model defaults | `../01_research/05-security-model.md` |
