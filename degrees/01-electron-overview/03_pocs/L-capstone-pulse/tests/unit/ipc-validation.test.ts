/**
 * Validator unit tests. Cover the new capstone shapes:
 *   - focus:start, focus:extend
 *   - journal:append (with 10_000-char DoS cap — R-C-6)
 *   - journal:unlock-with-passphrase (with 4_096-char cap)
 *   - test:advance-clock, test:trigger-notification-action, test:fire-deep-link
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({}))

import { validators, IpcValidationError, JOURNAL_TEXT_MAX, PASSPHRASE_MAX } from '../../src/ipc-validation'

describe('focus:start', () => {
  it('accepts a positive number', () => {
    expect(validators.focusStart({ durationMs: 1000 }).durationMs).toBe(1000)
  })
  it('rejects 0 or negative', () => {
    expect(() => validators.focusStart({ durationMs: 0 })).toThrow(IpcValidationError)
    expect(() => validators.focusStart({ durationMs: -1 })).toThrow(IpcValidationError)
  })
  it('rejects >24h', () => {
    expect(() => validators.focusStart({ durationMs: 25 * 60 * 60 * 1000 })).toThrow(IpcValidationError)
  })
})

describe('focus:extend', () => {
  it('rejects >60min', () => {
    expect(() => validators.focusExtend({ bonusMs: 60 * 60 * 1000 + 1 })).toThrow(IpcValidationError)
  })
})

describe('journal:append — DoS cap (R-C-6)', () => {
  it('accepts boundary length JOURNAL_TEXT_MAX', () => {
    const t = 'x'.repeat(JOURNAL_TEXT_MAX)
    expect(validators.journalAppend({ text: t }).text.length).toBe(JOURNAL_TEXT_MAX)
  })
  it('rejects JOURNAL_TEXT_MAX + 1', () => {
    const t = 'x'.repeat(JOURNAL_TEXT_MAX + 1)
    expect(() => validators.journalAppend({ text: t })).toThrow(IpcValidationError)
  })
  it('rejects empty', () => {
    expect(() => validators.journalAppend({ text: '' })).toThrow(IpcValidationError)
  })
})

describe('journal:unlock-with-passphrase — passphrase cap (R-C-6)', () => {
  it('rejects passphrase > PASSPHRASE_MAX', () => {
    const t = 'x'.repeat(PASSPHRASE_MAX + 1)
    expect(() => validators.journalUnlockWithPassphrase({ passphrase: t })).toThrow(IpcValidationError)
  })
})

describe('test:advance-clock', () => {
  it('accepts a non-negative number', () => {
    expect(validators.testAdvanceClock({ toMs: 0 }).toMs).toBe(0)
    expect(validators.testAdvanceClock({ toMs: 1_000_000 }).toMs).toBe(1_000_000)
  })
  it('rejects negative', () => {
    expect(() => validators.testAdvanceClock({ toMs: -1 })).toThrow(IpcValidationError)
  })
})

describe('test:trigger-notification-action', () => {
  it('requires non-empty id and non-negative integer actionIndex', () => {
    expect(validators.testTriggerNotificationAction({ id: 'a', actionIndex: 0 }).id).toBe('a')
    expect(() => validators.testTriggerNotificationAction({ id: '', actionIndex: 0 })).toThrow(IpcValidationError)
    expect(() => validators.testTriggerNotificationAction({ id: 'a', actionIndex: -1 })).toThrow(IpcValidationError)
    expect(() => validators.testTriggerNotificationAction({ id: 'a', actionIndex: 1.5 })).toThrow(IpcValidationError)
  })
})

describe('test:fire-deep-link', () => {
  it('requires non-empty url', () => {
    expect(validators.testFireDeepLink({ url: 'pulse://x' }).url).toBe('pulse://x')
    expect(() => validators.testFireDeepLink({ url: '' })).toThrow(IpcValidationError)
  })
})
