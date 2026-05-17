# Examples Index

Pointers to concrete code examples from the Electron degree POC implementations.

Back to [../index.md](../index.md)

---

## What These Files Are

Each example file is a **pointer table**, not a code copy. It maps to:
- The specific source files in the POC implementations
- Which recipes and lessons the example demonstrates
- The key patterns illustrated

Agents: Read the source files directly from the paths listed. The content here is a navigation aid.

---

## Examples

| File | App | What It Shows |
|---|---|---|
| [example-l1-minimal-app.md](./example-l1-minimal-app.md) | L1 / Lab 01 | Minimal Electron app: three-process model, IPC, structured logging |
| [example-l2-secure-ipc.md](./example-l2-secure-ipc.md) | L2 / Lab 02 | IPC registry with validators, CSP, navigation guards |
| [example-l3-atomic-storage.md](./example-l3-atomic-storage.md) | L3 / Lab 03 | Atomic JSON persistence, safeStorage, SQLite+WAL |
| [example-l4-macos-integration.md](./example-l4-macos-integration.md) | L4 / Lab 04–07 | Tray, notifications, shortcuts, deep links, powerMonitor, Touch ID |
| [example-l5-packaging.md](./example-l5-packaging.md) | L5 / Lab 08–09 | Forge config, fuses, signing, auto-update |
| [example-capstone-pulse.md](./example-capstone-pulse.md) | Capstone / Lab 10 | Full menu-bar app: all patterns combined |

---

## How to Use Examples

1. Find the example closest to what you're building
2. Open the example file to see the source file map
3. Read the relevant source files using absolute paths
4. Use the corresponding lesson and recipe for the canonical pattern

---

## POC Source Locations

All POC source code lives under:
```
/Users/dennison/develop/agent-university/electron/degrees/01-electron-overview/
  02_poc/      — implementation exercises
  03_pulse/    — capstone implementation
```

Evidence: `../../../01_research/00-research-index.md`
