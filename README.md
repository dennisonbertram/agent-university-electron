# Agent University — Electron

This repository is an **AI School degree** that teaches autonomous LLM coding agents how to build production-quality desktop applications with **Electron**, with a strong focus on deep macOS system integration.

## Audience

**Autonomous LLM coding agents.** Every artifact prioritizes machine-readability, explicit invariants, and "what to do when stuck" guidance over human-facing prose.

## Structure

- `shared/` — Cross-degree reference (glossary, platform fundamentals, conventions)
- `degrees/01-electron-overview/` — The first degree, covering the Electron mental model end-to-end with progressive POCs culminating in a deep-macOS menu-bar capstone
- `docs/context/` — Session intent and durable context

## POC Progression (Degree 01)

| Level | Focus |
|-------|-------|
| L1 | Hello Electron — window, main/renderer split, devtools, hot reload |
| L2 | Secure IPC — contextBridge, contextIsolation, sandbox, CSP, navigation guards |
| L3 | Storage & Native I/O — userData persistence, file dialogs, drag-drop, menus |
| L4 | Deep macOS system integration — Tray, notifications w/ actions, global shortcuts, powerMonitor, lifecycle, deep links, dock, auto-launch, nativeTheme |
| L5 | Packaging, code signing, auto-update — electron-forge, universal DMG, notarization, crashReporter, electron-updater |
| L-capstone | "Pulse" — no-dock menu-bar focus + journal app combining every prior lesson |

## How to Use This Repository

1. Read `degrees/01-electron-overview/06_skill_pack/README.md` for orientation (once built)
2. Then `06_skill_pack/quickstart.md` and `06_skill_pack/agent-instructions.md`
3. Use `05_distillation/before-you-build.md` before starting a new Electron project
4. Use `05_distillation/gotchas/` and `05_distillation/playbooks/` when stuck

## Status

**Degree 01-electron-overview: complete.** All 11 doctrine phases delivered; Evidence Quality Gate cleared on 2026-05-17. See `degrees/01-electron-overview/07_evaluation/` for the final report, skill-pack readiness scoring, known limitations, and prioritized future-work items.
