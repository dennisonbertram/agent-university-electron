# G-18 — contextBridge strips class prototypes (only plain objects + functions survive)

**Severity**: medium
**Surface**: contextBridge serialization
**Discovered in**: Research review (`01_research/21-failure-modes.md#FM-14`)

## Symptom

```typescript
// main / preload:
class Config { getValue() { return 42 } }
contextBridge.exposeInMainWorld('api', { config: new Config() })

// renderer:
window.api.config.getValue() // TypeError: getValue is not a function
```

The `config` object is present but lost its methods. Properties that were getters or computed via prototype chain are also missing.

## Root cause

contextBridge clones objects across the V8 isolated-world boundary using a structured-clone-like algorithm. Custom prototypes are stripped: only own enumerable data properties (and bound functions at the top level of the exposed object) survive.

## Fix

Expose individual functions instead of class instances. Methods become top-level functions that close over the class instance in preload:

```typescript
// src/preload.ts
const config = new Config()

contextBridge.exposeInMainWorld('api', {
  config: {
    getValue: () => config.getValue(), // extract method as bound function
    setValue: (v: number) => config.setValue(v),
  },
})
```

## Test that catches a regression

`tests/e2e/api-shape.spec.ts` — asserts `typeof window.api.config.getValue === 'function'` and `typeof window.api.config.getValue() === 'number'`. If the future preload accidentally exposes a class instance, the test fails.

## Evidence

- `01_research/21-failure-modes.md#FM-14`
- `01_research/04-ipc-patterns.md` lines 142-162 (serialization rules)
- `01_research/05-security-model.md` lines 132-154
