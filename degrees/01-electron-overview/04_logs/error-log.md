# Error Log — 01-electron-overview

Every important error encountered during research or POC construction. Append-only.

## Entry Format

```
## Entry N — <short title>

- **Date**:
- **Error message** (verbatim):
- **Context** (what was being attempted):
- **Cause**:
- **Fix**:
- **Did this become a documented gotcha?** Yes / No — if yes, link
- **Regression test added?** Yes / No — if yes, path
```

## Entries

(none yet)

## Entry 1 — L3 — Readonly MenuTreeNode field assignments in serializer

- **Date**: 2026-05-17
- **POC / Phase**: Phase 6 / L3 (GREEN, `npm run build`)
- **Error message** (verbatim):
  ```
  src/menu.ts(164,21): error TS2540: Cannot assign to 'id' because it is a read-only property.
  src/menu.ts(165,23): error TS2540: Cannot assign to 'role' because it is a read-only property.
  src/menu.ts(172,40): error TS2540: Cannot assign to 'accelerator' because it is a read-only property.
  src/menu.ts(173,23): error TS2540: Cannot assign to 'type' because it is a read-only property.
  src/menu.ts(176,10): error TS2540: Cannot assign to 'submenu' because it is a read-only property.
  ```
- **Context**: `serializeItem` in `src/menu.ts` builds a `MenuTreeNode`
  by progressively assigning optional fields. The public exported
  `MenuTreeNode` interface marks every field `readonly` (so callers
  cannot mutate the returned tree). My first attempt used a mapped
  `-readonly` workaround at the declaration site, which did not
  survive strict-mode property assignment.
- **Cause**: TypeScript treats the assignments as writes to the
  readonly surface of the exported interface; the mapped-`-readonly`
  trick relaxes the property modifiers but the assignability still
  goes through the original `MenuTreeNode` declaration.
- **Fix**: build the node as a local mutable shape (a plain
  object-type literal) and cast once at return (`return node as
  MenuTreeNode`). Caller-visible type is still readonly; the
  construction site is unconstrained.
- **Did this become a documented gotcha?** No — straightforward TS
  ergonomics, not surprising Electron behavior.
- **Regression test added?** No — `tsc -p tsconfig.json` (which runs
  on every build via `npm run build`) is the regression check.
