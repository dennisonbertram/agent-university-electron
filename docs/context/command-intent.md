# Command Intent — Start Degree: Electron

## User's Request (verbatim)

> Read /Users/dennison/develop/agent-university/start-degree.md and do it for Electron
>
> lets go with defaults, but make capstone harder and add poc progression: deepers system integration with advanced osx features (system/status bar, notifications, lifecyle events) that sort of thing, make it interesting.

## Interpreted Intent

Start a new Agent University degree for Electron, following the standard 11-phase doctrine at `/Users/dennison/develop/agent-university/instructions/instructions.md`. The first degree (`01-electron-overview`) covers the Electron platform end-to-end at moderate-to-deep depth, with the L4 POC and capstone specifically biased toward **rich macOS system integration** (status bar, notifications, app lifecycle, deep links, power management, auto-launch, native theme, etc.). The capstone should be **non-trivial** — combining every prior level's lessons into a coherent, realistic, polished application that an LLM agent could later use as a reference implementation.

## Audience

Autonomous LLM coding agents (not humans). Optimize artifacts for machine consumption, explicit invariants, evidence pointers, and clear "do this / don't do this" rules.

## Success Criteria

A degree is considered "done" when ALL of the following hold:

1. **Phase 0 (metadata)**: Target, scope, assumptions, environment, source inventory all written in `00_metadata/`.
2. **Phase 1 (research)**: At least 15 research files in `01_research/`, covering capabilities, mental model, setup, IPC, security, native integrations, packaging, code signing, auto-update, testing, observability, failure modes, version compatibility, and open questions. Sourced from official Electron docs (preferred), source code, GitHub issues, and runtime probes. Every claim cites evidence.
3. **Phases 2–5 (synthesis + strategy)**: Degree plan, risk register, test strategy, observability strategy written.
4. **Phases 6–8 (POCs, behavioral tests, deployment)**: All 6 POCs (L1–L5 + capstone) built test-first using bun:test or vitest (decide in Phase 1) with Given/When/Then behavioral tests. Each POC has a README, test plan, behavioral test file, implementation, observability instrumentation, and a POC report. Capstone "Pulse" is a packaged, runnable menu bar app demonstrating every subsystem.
5. **Phase 9 (distillation)**: 10+ distillation files in `05_distillation/` covering gotchas, patterns, anti-patterns, before-you-build, debugging playbooks, security checklist, production-readiness checklist, etc. Every claim cites a POC or log entry.
6. **Phase 10 (skill pack)**: `06_skill_pack/` is a navigable, self-contained guide an agent can use without reading raw research/logs. Includes index, quickstart, curriculum, agent-instructions, lessons/, labs/, recipes/, checklists/, troubleshooting/, reference/, examples/, assessments/.
7. **Phase 11 (evaluation)**: `07_evaluation/` contains final-report.md, skill-pack-readiness.md (scored 1–5 on 11 dimensions), known-limitations.md, future-work.md.
8. **Logs are complete**: Every ledger in `04_logs/` (expectation-gap, error, decision, test-results, debugging, deployment, command) has real entries. Expectation-gap ledger is non-empty — if there are zero entries, research was too shallow.
9. **Quality gates pass**: `evidence-auditor` formally evaluates the research gate, POC gate, distillation gate, skill-pack gate, and evidence-integrity gate. All pass before close.

## User's Mental Model

The user expects an LLM agent following this skill pack later to be able to:
- Build a polished macOS Electron app from scratch
- Avoid the classic security pitfalls (nodeIntegration, contextIsolation, missing CSP)
- Wire up tray, notifications, global shortcuts, deep links, auto-launch correctly the first time
- Understand the main/renderer/preload three-process model and IPC patterns
- Package, sign, notarize, and ship updates
- Debug common Electron failure modes (white screen, native module mismatch, sandbox surprises, etc.)
- Know when Electron is wrong vs. right for a job

## Constraints

- **Audience is LLM agents.** Optimize for machine readability.
- **macOS-first.** Windows and Linux are documented where free, but the deep system integration POC and capstone are macOS-specific. Cross-platform notes captured but not the primary target.
- **No Apple Developer account is assumed.** Code signing and notarization documented as a *simulated* flow with explicit notes on how production would differ. If user provides credentials later, real signing can be added.
- **Electron version**: latest stable at degree-start (pin exact version during Phase 0 environment probe).
- **Tooling**: prefer electron-forge over electron-builder unless Phase 1 research finds a blocker. Use TypeScript everywhere. Decide bun vs npm-based tooling during Phase 1 (note: many Electron native modules expect node-gyp / Node-based tooling; bun support may be incomplete).
- **Library documentation queries during research**: use the `ctx7` CLI (`npx ctx7@latest`) to fetch current Electron docs rather than relying on training data.

## What's Explicitly Out of Scope

- Building Electron from source
- Custom Chromium patches or distribution
- Linux-specific packaging (Snap, AppImage) beyond a passing mention
- Windows-specific code signing / MSIX
- Cross-runtime comparisons (Tauri, NW.js) except as expectation-gap entries
- Mobile / Capacitor variants
- Production CI/CD pipelines for shipping the app to users (the capstone is locally packaged)
- An actual update server (the L5 + capstone updater wiring uses local fixtures and `electron-updater` config validation)

## Assumptions

- Apple Silicon (arm64) primary dev machine, with universal binary as the packaging target.
- macOS >= 13 (Ventura) for current Electron API compatibility.
- Node toolchain available locally; will probe versions in Phase 0.
- GitHub CLI (`gh`) authenticated; repo `agent-university-electron` will be created public.
- All work happens inside `/Users/dennison/develop/agent-university/electron/`.

## Plan Summary (will be elaborated in Phase 2)

| Phase | Output |
|-------|--------|
| 0 | Metadata files |
| 1 | Research index + 15+ topic files in `01_research/` |
| 2 | Degree plan, risk register, success criteria in `02_planning/` |
| 3 | Refined POC selection scored against doctrine criteria |
| 4 | Test strategy (Given/When/Then framework, what we promise to test) |
| 5 | Observability strategy (structured logging conventions for main + renderer) |
| 6 | L1 → L5 POCs built test-first with TDD audit trail |
| 7 | Behavioral tests verified per POC |
| 8 | Packaging / signing / update simulation |
| 9 | Distillation files |
| 10 | Skill pack assembly |
| 11 | Final evaluation + readiness scoring |
