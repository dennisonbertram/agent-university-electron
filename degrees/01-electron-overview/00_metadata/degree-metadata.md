# Degree Metadata — 01-electron-overview

| Field | Value |
|-------|-------|
| Degree slug | `01-electron-overview` |
| Target | Electron (latest stable) with strong macOS deep-integration focus |
| Audience | Autonomous LLM coding agents |
| Created | 2026-05-16 |
| Doctrine version | `instructions/instructions.md` as of session start |
| Primary platform | macOS (Apple Silicon; universal binary at packaging) |
| Secondary platforms | Windows + Linux documented where free; not actively built for the capstone |
| Deployment context | Local packaging via electron-forge; auto-update simulated against a local fixture; no production update server in scope |
| Capstone goal | "Pulse" — no-dock macOS menu-bar focus & journal companion combining tray, notifications, global shortcuts, powerMonitor, deep links, SQLite + safeStorage, Touch ID gate, auto-launch, native theme tracking, packaged with electron-forge and wired for auto-update |
| Status | In progress (Phase 0 just complete) |

## Version Pins (to be confirmed in Phase 0 environment probe)

| Package | Target version |
|---------|---------------|
| electron | latest stable (probe during environment.md) |
| electron-forge | latest stable |
| typescript | >= 5.x |
| better-sqlite3 | latest (capstone) |
| playwright | latest (capstone e2e) |
| Node toolchain | system default during dev; Electron's bundled Node version determines native module ABI |

Exact versions pin in each POC's `package.json` once Phase 1 research determines compatibility.

## Operating Doctrine

This degree follows `/Users/dennison/develop/agent-university/instructions/instructions.md` strictly. Phase advancement is gated by `evidence-auditor` runs against the documented quality gates.
