import { isValidJoinCode, normalizeJoinCode } from '../join-code'

describe('normalizeJoinCode', () => {
  it('pone el guion donde toca', () => {
    expect(normalizeJoinCode('pan42xk')).toBe('PAN-42XK')
  })

  it('acepta el código ya formateado', () => {
    expect(normalizeJoinCode('PAN-42XK')).toBe('PAN-42XK')
  })

  it('descarta los caracteres que nunca aparecen en un código', () => {
    expect(normalizeJoinCode('P0AN I42XK')).toBe('PAN-42XK')
  })

  it('no deja escribir más allá de los siete caracteres', () => {
    expect(normalizeJoinCode('PAN42XKZZZZ')).toBe('PAN-42XK')
  })

  it('no mete el guion mientras el código está a medias', () => {
    expect(normalizeJoinCode('PA')).toBe('PA')
  })
})

describe('isValidJoinCode', () => {
  it('acepta un código completo', () => {
    expect(isValidJoinCode('PAN-42XK')).toBe(true)
  })

  it('rechaza un código a medias', () => {
    expect(isValidJoinCode('PAN-42')).toBe(false)
  })

  it('rechaza los caracteres ambiguos', () => {
    expect(isValidJoinCode('PAN-42O1')).toBe(false)
  })

  it('rechaza el código sin guion', () => {
    expect(isValidJoinCode('PAN42XK')).toBe(false)
  })
})
