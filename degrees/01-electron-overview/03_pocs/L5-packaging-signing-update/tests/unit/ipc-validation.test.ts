/**
 * Unit tests for the L4 IPC validators — adds coverage for the new channels
 * introduced at L4: tray:set-state, notification:show, app:set-autolaunch,
 * app:set-theme, dock:set-badge, app:add-recent, test:fire-shortcut,
 * test:emit-power-event, test:emit-open-url, test:emit-second-instance.
 *
 * Carry-forward tests for the L3 validators are still asserted to prevent
 * regression.
 */
import { describe, it, expect } from 'vitest'
import { IpcValidationError, validators } from '../../src/ipc-validation'

describe('IpcValidationError', () => {
  it('has name === "IpcValidationError"', () => {
    const err = new IpcValidationError('hi')
    expect(err.name).toBe('IpcValidationError')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('hi')
  })
})

describe('validators.ping (no-arg)', () => {
  it('Given anything, when called, then returns void', () => {
    expect(() => validators.ping(undefined)).not.toThrow()
    expect(() => validators.ping(null)).not.toThrow()
  })
})

describe('validators.echo', () => {
  it('Given any JSON-cloneable value, then returns it verbatim', () => {
    expect(validators.echo('hello')).toBe('hello')
    expect(validators.echo({ x: 1 })).toEqual({ x: 1 })
  })
  it('Given undefined, throws', () => {
    expect(() => validators.echo(undefined)).toThrow(IpcValidationError)
  })
})

describe('validators.journalAppend (carry-forward)', () => {
  it('Given { text: "ok" }, returns parsed shape', () => {
    expect(validators.journalAppend({ text: 'ok' })).toEqual({ text: 'ok' })
  })
  it('Given { text: 123 }, throws', () => {
    expect(() => validators.journalAppend({ text: 123 })).toThrow(IpcValidationError)
  })
})

describe('validators.traySetState', () => {
  it('Given { state: "focused" }, returns parsed shape', () => {
    expect(validators.traySetState({ state: 'focused' })).toEqual({ state: 'focused' })
  })
  it.each(['idle', 'focused', 'break', 'paused'] as const)(
    'Given valid state "%s", does not throw',
    (s) => {
      expect(validators.traySetState({ state: s })).toEqual({ state: s })
    },
  )
  it('Given an unknown state, throws', () => {
    expect(() => validators.traySetState({ state: 'flying' })).toThrow(IpcValidationError)
  })
  it('Given a non-object, throws', () => {
    expect(() => validators.traySetState('focused')).toThrow(IpcValidationError)
    expect(() => validators.traySetState(null)).toThrow(IpcValidationError)
  })
  it('Given { state: 42 }, throws', () => {
    expect(() => validators.traySetState({ state: 42 })).toThrow(IpcValidationError)
  })
})

describe('validators.notificationShow', () => {
  it('Given a minimal valid payload, returns parsed shape', () => {
    const parsed = validators.notificationShow({ title: 'hi', body: 'there' })
    expect(parsed.title).toBe('hi')
    expect(parsed.body).toBe('there')
    expect(parsed.actions).toBeUndefined()
  })

  it('Given title === "", throws', () => {
    expect(() => validators.notificationShow({ title: '', body: 'b' })).toThrow(IpcValidationError)
  })

  it('Given missing body, throws', () => {
    expect(() => validators.notificationShow({ title: 'x' })).toThrow(IpcValidationError)
  })

  it('Given two button actions, returns them in order', () => {
    const parsed = validators.notificationShow({
      title: 't',
      body: 'b',
      actions: [
        { type: 'button', text: 'Reply' },
        { type: 'button', text: 'Dismiss' },
      ],
    })
    expect(parsed.actions).toEqual([
      { type: 'button', text: 'Reply' },
      { type: 'button', text: 'Dismiss' },
    ])
  })

  it('Given actions with wrong type field, throws', () => {
    expect(() =>
      validators.notificationShow({
        title: 't',
        body: 'b',
        actions: [{ type: 'submit', text: 'Reply' }],
      }),
    ).toThrow(IpcValidationError)
  })

  it('Given hasReply true + replyPlaceholder, returns both', () => {
    const parsed = validators.notificationShow({
      title: 't',
      body: 'b',
      hasReply: true,
      replyPlaceholder: 'reply...',
    })
    expect(parsed.hasReply).toBe(true)
    expect(parsed.replyPlaceholder).toBe('reply...')
  })

  it('Given hasReply: "yes", throws', () => {
    expect(() =>
      validators.notificationShow({ title: 't', body: 'b', hasReply: 'yes' }),
    ).toThrow(IpcValidationError)
  })
})

describe('validators.appSetAutoLaunch', () => {
  it('Given { enabled: true }, returns parsed', () => {
    expect(validators.appSetAutoLaunch({ enabled: true })).toEqual({ enabled: true })
    expect(validators.appSetAutoLaunch({ enabled: false })).toEqual({ enabled: false })
  })
  it('Given { enabled: 1 }, throws', () => {
    expect(() => validators.appSetAutoLaunch({ enabled: 1 })).toThrow(IpcValidationError)
  })
})

describe('validators.appSetTheme', () => {
  it.each(['system', 'light', 'dark'] as const)('Given source "%s", returns parsed', (s) => {
    expect(validators.appSetTheme({ source: s })).toEqual({ source: s })
  })
  it('Given an unknown source, throws', () => {
    expect(() => validators.appSetTheme({ source: 'sepia' })).toThrow(IpcValidationError)
  })
})

describe('validators.dockSetBadge', () => {
  it('Given { badge: "3" }, returns parsed', () => {
    expect(validators.dockSetBadge({ badge: '3' })).toEqual({ badge: '3' })
  })
  it('Given { badge: "" } (clear request), returns parsed (empty is allowed)', () => {
    expect(validators.dockSetBadge({ badge: '' })).toEqual({ badge: '' })
  })
  it('Given { badge: 3 }, throws', () => {
    expect(() => validators.dockSetBadge({ badge: 3 })).toThrow(IpcValidationError)
  })
})

describe('validators.appAddRecent', () => {
  it('Given a non-empty filePath, returns it', () => {
    expect(validators.appAddRecent({ filePath: '/tmp/x.md' })).toEqual({ filePath: '/tmp/x.md' })
  })
  it('Given filePath: "", throws', () => {
    expect(() => validators.appAddRecent({ filePath: '' })).toThrow(IpcValidationError)
  })
})

describe('validators.testFireShortcut', () => {
  it('Given a non-empty accelerator, returns it', () => {
    expect(validators.testFireShortcut({ accelerator: 'CmdOrCtrl+Shift+P' })).toEqual({
      accelerator: 'CmdOrCtrl+Shift+P',
    })
  })
  it('Given accelerator: "", throws', () => {
    expect(() => validators.testFireShortcut({ accelerator: '' })).toThrow(IpcValidationError)
  })
})

describe('validators.testEmitPower', () => {
  it.each(['suspend', 'resume', 'lock-screen', 'unlock-screen', 'on-ac', 'on-battery'] as const)(
    'Given valid event "%s", returns parsed',
    (e) => {
      expect(validators.testEmitPower({ event: e })).toEqual({ event: e })
    },
  )
  it('Given an unknown event, throws', () => {
    expect(() => validators.testEmitPower({ event: 'fart' })).toThrow(IpcValidationError)
  })
})

describe('validators.testEmitOpenUrl', () => {
  it('Given a URL string, returns it', () => {
    expect(validators.testEmitOpenUrl({ url: 'electron-l5://action' })).toEqual({
      url: 'electron-l5://action',
    })
  })
  it('Given url: "", throws', () => {
    expect(() => validators.testEmitOpenUrl({ url: '' })).toThrow(IpcValidationError)
  })
})

describe('validators.testEmitSecondInstance', () => {
  it('Given an array of strings, returns a copy', () => {
    const args = ['app', 'electron-l5://action?x=1']
    const parsed = validators.testEmitSecondInstance({ argv: args })
    expect(parsed.argv).toEqual(args)
  })
  it('Given argv containing a non-string, throws', () => {
    expect(() => validators.testEmitSecondInstance({ argv: ['a', 42] })).toThrow(IpcValidationError)
  })
  it('Given non-array argv, throws', () => {
    expect(() => validators.testEmitSecondInstance({ argv: 'nope' })).toThrow(IpcValidationError)
  })
})
