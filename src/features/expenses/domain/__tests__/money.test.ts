import { formatCents, isValidAmountCents, parseCurrencyToCents, splitEvenly } from '../money'

describe('isValidAmountCents', () => {
  it('valida céntimos positivos y enteros', () => {
    expect(isValidAmountCents(100)).toBe(true)
    expect(isValidAmountCents(1)).toBe(true)
    expect(isValidAmountCents(0)).toBe(false)
    expect(isValidAmountCents(-50)).toBe(false)
    expect(isValidAmountCents(10.5)).toBe(false)
  })
})

describe('parseCurrencyToCents', () => {
  it('convierte texto con coma o punto a céntimos enteros', () => {
    expect(parseCurrencyToCents('12,50')).toBe(1250)
    expect(parseCurrencyToCents('12.50')).toBe(1250)
    expect(parseCurrencyToCents('5')).toBe(500)
    expect(parseCurrencyToCents('0,99 €')).toBe(99)
    expect(parseCurrencyToCents(' 100,00 ')).toBe(10000)
  })

  it('rechaza entradas no numéricas o inválidas', () => {
    expect(parseCurrencyToCents('')).toBeNull()
    expect(parseCurrencyToCents('abc')).toBeNull()
    expect(parseCurrencyToCents('-5')).toBeNull()
    expect(parseCurrencyToCents('0')).toBeNull()
    expect(parseCurrencyToCents('12.345')).toBeNull()
  })
})

describe('formatCents', () => {
  it('formatea céntimos a euros en formato español', () => {
    expect(formatCents(1250)).toBe('12,50 €')
    expect(formatCents(99)).toBe('0,99 €')
    expect(formatCents(500)).toBe('5,00 €')
  })
})

describe('splitEvenly', () => {
  it('divide 10,00 € (1000 céntimos) entre 3 miembros de forma exacta (334 + 333 + 333 = 1000)', () => {
    const result = splitEvenly(1000, ['m1', 'm2', 'm3'])
    const total = Object.values(result).reduce((sum, v) => sum + v, 0)

    expect(total).toBe(1000)
    expect(result).toEqual({
      m1: 334,
      m2: 333,
      m3: 333,
    })
  })

  it('divide 10,00 € entre 2 miembros de forma exacta (500 + 500)', () => {
    const result = splitEvenly(1000, ['m1', 'm2'])
    expect(result).toEqual({
      m1: 500,
      m2: 500,
    })
  })

  it('devuelve objeto vacío si no hay miembros o el importe no es válido', () => {
    expect(splitEvenly(1000, [])).toEqual({})
    expect(splitEvenly(0, ['m1'])).toEqual({})
  })
})
