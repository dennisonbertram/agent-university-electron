# Troubleshooting — IPC Validation Error Shape

Back to [index.md](./index.md) | [../index.md](../index.md)

---

## Symptom

An IPC call rejects but the renderer receives an error object with:
- `message: "An object could not be cloned"` instead of your custom message
- `code` field is missing
- All custom properties are stripped — only `message` survives

Or: IPC handler throws but the renderer receives `undefined` instead of an Error.

---

## Root Cause

Electron's IPC serialization uses the Structured Clone Algorithm. Plain `Error` objects round-trip correctly (`message` survives). But:

1. Custom subclass properties (`code`, `details`, etc.) are NOT cloned — they are stripped in transit
2. `Error` subclasses lose their constructor chain — `instanceof IpcValidationError` is false on the renderer side
3. `throw new Error(...)` inside an `ipcMain.handle` callback is serialized to `{ message }` only — extra fields are dropped

---

## Cause → Diagnostic → Fix

### Cause 1: Custom error class with extra properties

```typescript
// Main process throws:
class IpcValidationError extends Error {
  code = 'VALIDATION_FAILED'
  details: unknown
  constructor(msg: string, details?: unknown) {
    super(msg)
    this.code = 'VALIDATION_FAILED'
    this.details = details
  }
}

throw new IpcValidationError('invalid arg', { field: 'foo' })
```

```typescript
// Renderer receives:
// { message: 'invalid arg' }  — code and details are MISSING
```

**Fix**

Encode extra fields INTO the message string, OR use a structured result object instead of throwing:

**Option A — encode in message:**
```typescript
throw new Error(`VALIDATION_FAILED: invalid arg (field=foo)`)
```

**Option B — structured result (recommended):**
```typescript
// Return a discriminated union instead of throwing
type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string }

// Handler returns result; never throws for validation errors
handler: (arg): IpcResult<string> => {
  if (!isValid(arg)) {
    return { ok: false, code: 'VALIDATION_FAILED', message: `invalid: ${arg}` }
  }
  return { ok: true, value: processArg(arg) }
}
```

**Option C — serialize to plain object before throwing:**
```typescript
// In ipcMain.handle wrapper:
try {
  const result = await entry.handler(validated, ctx)
  return result
} catch (err) {
  if (err instanceof IpcValidationError) {
    // Re-throw as plain Error with encoded fields
    throw Object.assign(new Error(`[${err.code}] ${err.message}`), {
      // Note: these still won't survive — but message is recoverable
    })
  }
  throw err
}
```

---

### Cause 2: Handler returns `undefined` on thrown error

If the `ipcMain.handle` callback throws synchronously without returning, some Electron versions deliver `undefined` to the caller rather than rejecting the Promise.

**Diagnostic**

In renderer DevTools console:
```javascript
const result = await window.api.someChannel('invalid-arg')
console.log(result)  // undefined? or throws?
```

**Fix**

Always use `ipcMain.handle` (not `ipcMain.on`) for request-response patterns. The `handle` callback's rejected Promise propagates to the caller.

Make sure the handler is `async` or returns a Promise:
```typescript
ipcMain.handle(channel, async (_event, arg) => {
  // async function: exceptions become rejected Promises
  const validated = entry.validate(arg)
  return entry.handler(validated, ctx)
})
```

---

### Cause 3: Renderer side not awaiting the Promise

If the renderer calls `ipcRenderer.invoke(...)` but doesn't `await` it, rejections are unhandled.

**Diagnostic**

```typescript
// WRONG — fire and forget
window.api.someChannel('bad-arg')  

// Correct
try {
  const result = await window.api.someChannel('bad-arg')
} catch (e) {
  console.error('IPC error:', e.message)
}
```

---

### Cause 4: `sendSync` used instead of `invoke`

`ipcRenderer.sendSync` has different error semantics. Errors in the main handler do NOT propagate to the caller — the call returns `undefined` instead.

**Diagnostic**

```bash
grep -n 'sendSync' src/
# Expected: 0 results
```

**Fix**

Replace all `sendSync` with `invoke`:
```typescript
// Never: ipcRenderer.sendSync('channel', arg)
// Always: await ipcRenderer.invoke('channel', arg)
```

---

## Recommended IPC Error Contract

The cleanest approach for agents building new apps:

```typescript
// Define a standard result type
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }

// Preload exposes: invoke<T>(channel, arg?) => Promise<IpcResult<T>>
// Renderer: const r = await api.invoke('echo', {msg:'hi'})
//           if (!r.ok) { logger.error(r.code, r.message); return }
//           // use r.data
```

This avoids the round-trip serialization problem entirely — errors become data, not exceptions.

---

## Related

- [../lessons/03-ipc-patterns-and-validation.md](../lessons/03-ipc-patterns-and-validation.md) — error round-trip problem (G-03)
- [../recipes/recipe-ipc-handler-with-validator.md](../recipes/recipe-ipc-handler-with-validator.md) — complete IPC registry
- [../labs/lab-02-secure-ipc-roundtrip.md](../labs/lab-02-secure-ipc-roundtrip.md) — hands-on exercise
- [../checklists/security-checklist.md](../checklists/security-checklist.md) — IPC section (items 11–15)

Evidence: `../../../05_distillation/patterns/P-02-ipc-registry-with-validators.md`
