import { isValidPin, normalizePin, pinLength } from '../pin'

describe('pinLength', () => {
  it('is exactly 4 digits', () => {
    expect(pinLength).toBe(4)
  })
})

describe('isValidPin', () => {
  it('accepts valid 4 digit numeric PINs', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('0000')).toBe(true)
    expect(isValidPin('9876')).toBe(true)
    expect(isValidPin(' 1234 ')).toBe(true)
  })

  it('rejects PINs with length different than 4', () => {
    expect(isValidPin('')).toBe(false)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
  })

  it('rejects non-numeric characters', () => {
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('abcd')).toBe(false)
    expect(isValidPin('12.4')).toBe(false)
    expect(isValidPin('12-4')).toBe(false)
    expect(isValidPin('12 4')).toBe(false)
  })
})

describe('normalizePin', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizePin('  1234  ')).toBe('1234')
  })
})
