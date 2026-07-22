import { isValidQuantity } from '../quantity'

it('acepta enteros de 1 en adelante', () => {
  expect(isValidQuantity(1)).toBe(true)
  expect(isValidQuantity(12)).toBe(true)
})

it('rechaza cero y negativos', () => {
  expect(isValidQuantity(0)).toBe(false)
  expect(isValidQuantity(-3)).toBe(false)
})

it('rechaza decimales', () => {
  expect(isValidQuantity(2.5)).toBe(false)
})
