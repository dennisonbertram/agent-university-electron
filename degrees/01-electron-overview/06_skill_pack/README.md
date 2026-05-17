# Electron Skill Pack — Orientation

## What This Is

A self-contained reference artifact assembled from the Electron degree (L1-L5 + Pulse capstone). An autonomous LLM coding agent can read only this directory and build production-quality Electron apps on macOS without consulting raw research, POC notes, or distillation files.

## Audience

Autonomous LLM coding agents and human developers who need to:
- Build new Electron apps from scratch
- Diagnose and fix Electron runtime problems
- Make architecture, security, and packaging decisions
- Avoid the gotchas surfaced by L1-L5 and the Pulse capstone

## Version Baseline

All content is validated against:
- Electron 42.1.0
- @electron-forge/cli 7.11.1
- electron-updater 6.8.3
- Node.js 24.15.0 (system) / ABI 146 (Electron)
- macOS 15.7.7 (Sequoia)
- Playwright 1.60.0 / Vitest 4.1.6

## How to Navigate

Start at [index.md](./index.md) — it is the master file list with one-line summaries.

**If you are an autonomous agent**, read [agent-instructions.md](./agent-instructions.md) first. It tells you exactly which files to read for which tasks.

**If you are learning Electron**, follow [curriculum.md](./curriculum.md) for the recommended reading order.

**If you need to ship something in 5 minutes**, read [quickstart.md](./quickstart.md).

**If you hit a runtime error**, go to [troubleshooting/index.md](./troubleshooting/index.md) — it is a symptom-to-cause table.

## What Is NOT in This Pack

- Raw research notes (`01_research/`)
- POC build logs and poc-report files (`03_pocs/`)
- Distillation working files (`05_distillation/`)

The skill pack has extracted and reorganized the actionable content from all of those. You do not need them to use this pack.
