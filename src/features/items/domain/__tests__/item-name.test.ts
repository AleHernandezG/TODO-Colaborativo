import { isValidItemName, itemNameMaxLength, normalizeItemName } from '../item-name'

it('recorta y colapsa los espacios', () => {
  expect(normalizeItemName('  leche   entera ')).toBe('leche entera')
})

it('acepta un nombre de una sola letra', () => {
  expect(isValidItemName('x')).toBe(true)
})

it('rechaza un nombre vacío', () => {
  expect(isValidItemName('')).toBe(false)
})

it('acepta justo el máximo de longitud', () => {
  expect(isValidItemName('a'.repeat(itemNameMaxLength))).toBe(true)
})

it('rechaza pasarse del máximo', () => {
  expect(isValidItemName('a'.repeat(itemNameMaxLength + 1))).toBe(false)
})
