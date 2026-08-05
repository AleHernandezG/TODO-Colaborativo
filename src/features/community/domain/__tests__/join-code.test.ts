import { isValidJoinCode, joinCodeExpiry, normalizeJoinCode } from '../join-code'

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

describe('joinCodeExpiry', () => {
  const now = new Date('2026-08-05T10:00:00Z')

  it('cuenta los días completos que quedan', () => {
    expect(joinCodeExpiry('2026-08-12T10:00:00Z', now)).toEqual({ status: 'valid', daysLeft: 7 })
  })

  it('redondea hacia abajo: día y medio son un día', () => {
    expect(joinCodeExpiry('2026-08-06T22:00:00Z', now)).toEqual({ status: 'valid', daysLeft: 1 })
  })

  it('da cero días cuando caduca hoy mismo', () => {
    expect(joinCodeExpiry('2026-08-05T23:00:00Z', now)).toEqual({ status: 'valid', daysLeft: 0 })
  })

  it('caduca justo al llegar la hora', () => {
    expect(joinCodeExpiry('2026-08-05T10:00:00Z', now)).toEqual({ status: 'expired' })
  })

  it('trata como caducado lo que ya pasó', () => {
    expect(joinCodeExpiry('2026-08-04T10:00:00Z', now)).toEqual({ status: 'expired' })
  })

  it('no se cree una fecha que no lo es', () => {
    expect(joinCodeExpiry('mañana', now)).toEqual({ status: 'expired' })
  })
})
