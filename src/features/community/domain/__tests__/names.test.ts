import { isValidCommunityName, isValidUsername, normalizeName } from '../names'

describe('normalizeName', () => {
  it('quita los espacios de los extremos', () => {
    expect(normalizeName('  Ana  ')).toBe('Ana')
  })

  it('colapsa los espacios interiores', () => {
    expect(normalizeName('Casa   del   pueblo')).toBe('Casa del pueblo')
  })
})

describe('isValidUsername', () => {
  it('acepta un nombre normal', () => {
    expect(isValidUsername('Ana')).toBe(true)
  })

  it('rechaza una sola letra', () => {
    expect(isValidUsername('A')).toBe(false)
  })

  it('rechaza el vacío', () => {
    expect(isValidUsername('')).toBe(false)
  })

  it('rechaza los nombres kilométricos', () => {
    expect(isValidUsername('a'.repeat(21))).toBe(false)
  })
})

describe('isValidCommunityName', () => {
  it('acepta un nombre de lista normal', () => {
    expect(isValidCommunityName('Casa')).toBe(true)
  })

  it('rechaza el vacío', () => {
    expect(isValidCommunityName('')).toBe(false)
  })

  it('rechaza más de cuarenta caracteres', () => {
    expect(isValidCommunityName('a'.repeat(41))).toBe(false)
  })
})
