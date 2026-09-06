import { isValidPushToken, parsePushToken } from '../push-token'

describe('push-token', () => {
  it('valida tokens válidos con prefijo ExponentPushToken', () => {
    const valid = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    expect(isValidPushToken(valid)).toBe(true)
    expect(parsePushToken(valid)).toBe(valid)
  })

  it('valida tokens válidos con prefijo ExpoPushToken', () => {
    const valid = 'ExpoPushToken[abc-123_XYZ]'
    expect(isValidPushToken(valid)).toBe(true)
    expect(parsePushToken(valid)).toBe(valid)
  })

  it('rechaza tokens con formatos inválidos o caracteres erróneos', () => {
    expect(isValidPushToken('')).toBe(false)
    expect(isValidPushToken('invalid-token')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[]')).toBe(false)
    expect(isValidPushToken('ExponentPushToken[has space]')).toBe(false)
    expect(isValidPushToken(null)).toBe(false)
    expect(isValidPushToken(12345)).toBe(false)
  })

  it('hace trim en parsePushToken', () => {
    expect(parsePushToken('  ExponentPushToken[abc-123]  ')).toBe('ExponentPushToken[abc-123]')
  })
})
