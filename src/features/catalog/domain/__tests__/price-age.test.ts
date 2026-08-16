import { priceAge } from '../price-age'

const now = new Date('2026-08-16T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('priceAge', () => {
  it('devuelve null si la fecha no se puede leer', () => {
    expect(priceAge('ayer por la tarde', now)).toBeNull()
  })

  it('lo visto hace unas horas es de hoy', () => {
    expect(priceAge(daysAgo(0.5), now)).toEqual({ unit: 'today', count: 0 })
  })

  it('una fecha futura no cuenta hacia atrás, es de hoy', () => {
    expect(priceAge(daysAgo(-3), now)).toEqual({ unit: 'today', count: 0 })
  })

  it('cuenta días hasta la semana', () => {
    expect(priceAge(daysAgo(1), now)).toEqual({ unit: 'day', count: 1 })
    expect(priceAge(daysAgo(6), now)).toEqual({ unit: 'day', count: 6 })
  })

  it('cuenta semanas hasta el mes', () => {
    expect(priceAge(daysAgo(7), now)).toEqual({ unit: 'week', count: 1 })
    expect(priceAge(daysAgo(29), now)).toEqual({ unit: 'week', count: 4 })
  })

  it('a partir de treinta días cuenta meses', () => {
    expect(priceAge(daysAgo(30), now)).toEqual({ unit: 'month', count: 1 })
    expect(priceAge(daysAgo(59), now)).toEqual({ unit: 'month', count: 1 })
    expect(priceAge(daysAgo(400), now)).toEqual({ unit: 'month', count: 13 })
  })
})
